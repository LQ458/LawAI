/**
 * Minimal server-side FGA client for standalone maintenance scripts.
 *
 * Application code uses lib/fga.ts. Standalone tsx scripts cannot resolve
 * Next.js's `server-only` package condition, so they share the identity helper
 * while keeping their network client isolated here.
 */

import { getFgaModelStoreState } from "../../lib/fgaModel";

const DEFAULT_FGA_API_URL = "https://api.us1.fga.dev";
const DEFAULT_FGA_TOKEN_ISSUER = "auth.fga.dev";
const DEFAULT_TIMEOUT_MS = 5_000;
let cachedAccessToken: string | undefined;
let cachedAccessTokenExpiry = 0;
let cachedAuthorizationModelId: string | undefined;

export interface ScriptFgaTuple {
  user: string;
  relation: string;
  object: string;
}

export interface ScriptFgaAuthorizationModel {
  id?: string;
  schema_version: string;
  type_definitions: unknown[];
}

function config() {
  const apiUrl = (process.env.AUTH0_FGA_API_URL || DEFAULT_FGA_API_URL).replace(
    /\/+$/,
    "",
  );
  const tokenIssuer = (
    process.env.AUTH0_FGA_TOKEN_ISSUER || DEFAULT_FGA_TOKEN_ISSUER
  )
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const configuredAudience = process.env.AUTH0_FGA_AUDIENCE || apiUrl;
  return {
    storeId: process.env.AUTH0_FGA_STORE_ID || "",
    clientId: process.env.AUTH0_FGA_CLIENT_ID || "",
    clientSecret: process.env.AUTH0_FGA_CLIENT_SECRET || "",
    tokenIssuer,
    apiUrl,
    audience: configuredAudience.endsWith("/")
      ? configuredAudience
      : `${configuredAudience}/`,
  };
}

export function isScriptFgaConfigured(): boolean {
  const value = config();
  return Boolean(
    value.storeId &&
    value.clientId &&
    value.clientSecret &&
    value.tokenIssuer &&
    value.apiUrl,
  );
}

function timeoutMs(): number {
  const configured = Number(process.env.AUTH0_FGA_TIMEOUT_MS);
  return Number.isFinite(configured) &&
    configured >= 500 &&
    configured <= 15_000
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithTimeout(
  input: string,
  init: RequestInit,
): Promise<{ response: Response; payload: unknown }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        const payload = response.ok ? await response.json() : null;
        return { response, payload };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("FGA request timed out"));
        }, timeoutMs());
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function accessToken(): Promise<string> {
  const value = config();
  if (!isScriptFgaConfigured()) throw new Error("FGA is not configured");
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry) {
    return cachedAccessToken;
  }
  const { response, payload } = await fetchJsonWithTimeout(
    `https://${value.tokenIssuer}/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: value.clientId,
        client_secret: value.clientSecret,
        audience: value.audience,
        grant_type: "client_credentials",
      }),
    },
  );
  if (!response.ok) throw new Error("FGA token request failed");
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as Record<string, unknown>).access_token !== "string"
  ) {
    throw new Error("FGA token response was invalid");
  }
  cachedAccessToken = (payload as Record<string, string>).access_token;
  const expiresIn = Number(
    (payload as Record<string, unknown>).expires_in ?? 300,
  );
  const safeExpiresIn =
    Number.isFinite(expiresIn) && expiresIn > 60 ? expiresIn : 300;
  cachedAccessTokenExpiry = Date.now() + (safeExpiresIn - 60) * 1000;
  return cachedAccessToken;
}

function documentObject(object: string): string {
  return object.startsWith("document:") ? object : `document:${object}`;
}

export async function scriptFgaCheck(tuple: ScriptFgaTuple): Promise<boolean> {
  if (!isScriptFgaConfigured()) return false;
  try {
    const value = config();
    const token = await accessToken();
    const authorizationModelId = await requiredAuthorizationModelId();
    const { response, payload } = await fetchJsonWithTimeout(
      `${value.apiUrl}/stores/${value.storeId}/check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          authorization_model_id: authorizationModelId,
          tuple_key: {
            user: tuple.user,
            relation: tuple.relation,
            object: documentObject(tuple.object),
          },
        }),
      },
    );
    if (!response.ok) return false;
    return Boolean(
      payload &&
      typeof payload === "object" &&
      (payload as Record<string, unknown>).allowed === true,
    );
  } catch {
    return false;
  }
}

export async function scriptFgaWriteTuples(
  tuples: ScriptFgaTuple[],
): Promise<void> {
  if (tuples.length === 0) return;
  const value = config();
  const token = await accessToken();
  const authorizationModelId = await requiredAuthorizationModelId();
  const response = await fetchWithTimeout(
    `${value.apiUrl}/stores/${value.storeId}/write`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        authorization_model_id: authorizationModelId,
        writes: tuples.map((tuple) => ({
          tuple_key: {
            user: tuple.user,
            relation: tuple.relation,
            object: tuple.object,
          },
        })),
      }),
    },
  );
  if (!response.ok) throw new Error("FGA tuple write failed");
}

export async function scriptFgaReadAuthorizationModels(): Promise<
  ScriptFgaAuthorizationModel[]
> {
  const value = config();
  const token = await accessToken();
  const models: ScriptFgaAuthorizationModel[] = [];
  let continuationToken = "";

  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ page_size: "100" });
    if (continuationToken) {
      query.set("continuation_token", continuationToken);
    }
    const { response, payload } = await fetchJsonWithTimeout(
      `${value.apiUrl}/stores/${encodeURIComponent(
        value.storeId,
      )}/authorization-models?${query.toString()}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) throw new Error("FGA model read failed");
    if (!payload || typeof payload !== "object") {
      throw new Error("FGA model read response was invalid");
    }

    const parsed = payload as Record<string, unknown>;
    if (!Array.isArray(parsed.authorization_models)) {
      throw new Error("FGA model read response was invalid");
    }
    for (const model of parsed.authorization_models) {
      if (
        !model ||
        typeof model !== "object" ||
        typeof (model as Record<string, unknown>).schema_version !== "string" ||
        !Array.isArray((model as Record<string, unknown>).type_definitions)
      ) {
        throw new Error("FGA model read response was invalid");
      }
      models.push(model as ScriptFgaAuthorizationModel);
    }

    continuationToken =
      typeof parsed.continuation_token === "string"
        ? parsed.continuation_token
        : "";
    if (!continuationToken) return models;
  }

  throw new Error("FGA model read exceeded the pagination safety limit");
}

async function requiredAuthorizationModelId(): Promise<string> {
  if (cachedAuthorizationModelId) return cachedAuthorizationModelId;
  const models = await scriptFgaReadAuthorizationModels();
  if (
    getFgaModelStoreState(models) !== "ready" ||
    typeof models[0]?.id !== "string" ||
    !models[0].id
  ) {
    throw new Error("FGA authorization model is missing or unsafe");
  }
  cachedAuthorizationModelId = models[0].id;
  return cachedAuthorizationModelId;
}

export async function scriptFgaWriteAuthorizationModel(
  model: ScriptFgaAuthorizationModel,
): Promise<string> {
  const value = config();
  const token = await accessToken();
  const { response, payload } = await fetchJsonWithTimeout(
    `${value.apiUrl}/stores/${encodeURIComponent(
      value.storeId,
    )}/authorization-models`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        schema_version: model.schema_version,
        type_definitions: model.type_definitions,
      }),
    },
  );
  if (!response.ok) throw new Error("FGA model write failed");
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as Record<string, unknown>).authorization_model_id !==
      "string"
  ) {
    throw new Error("FGA model write response was invalid");
  }
  return (payload as Record<string, string>).authorization_model_id;
}
