/**
 * Minimal server-side FGA client for standalone maintenance scripts.
 *
 * Application code uses lib/fga.ts. Standalone tsx scripts cannot resolve
 * Next.js's `server-only` package condition, so they share the identity helper
 * while keeping their network client isolated here.
 */

const DEFAULT_FGA_API_URL = "https://api.us1.fga.dev";
const DEFAULT_TIMEOUT_MS = 5_000;
let cachedAccessToken: string | undefined;
let cachedAccessTokenExpiry = 0;

export interface ScriptFgaTuple {
  user: string;
  relation: string;
  object: string;
}

function config() {
  return {
    storeId: process.env.AUTH0_FGA_STORE_ID || "",
    clientId: process.env.AUTH0_FGA_CLIENT_ID || "",
    clientSecret: process.env.AUTH0_FGA_CLIENT_SECRET || "",
    auth0Domain: process.env.AUTH0_DOMAIN || "",
    apiUrl: process.env.AUTH0_FGA_API_URL || DEFAULT_FGA_API_URL,
    audience:
      process.env.AUTH0_FGA_AUDIENCE ||
      process.env.AUTH0_FGA_API_URL ||
      DEFAULT_FGA_API_URL,
  };
}

export function isScriptFgaConfigured(): boolean {
  const value = config();
  return Boolean(
    value.storeId &&
    value.clientId &&
    value.clientSecret &&
    value.auth0Domain &&
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
    `https://${value.auth0Domain}/oauth/token`,
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
    const { response, payload } = await fetchJsonWithTimeout(
      `${value.apiUrl}/stores/${value.storeId}/check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
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
  const response = await fetchWithTimeout(
    `${value.apiUrl}/stores/${value.storeId}/write`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
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
