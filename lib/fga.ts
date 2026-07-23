import "server-only";

const DEFAULT_FGA_API_URL = "https://api.us1.fga.dev";
const DEFAULT_FGA_TIMEOUT_MS = 5_000;

interface FgaCheckRequest {
  user: string;
  relation: string;
  object: string;
}

interface FgaTuple {
  user: string;
  relation: string;
  object: string;
}

let fgaAccessToken: string | null = null;
let fgaTokenExpiry = 0;

function fgaConfig() {
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

function timeoutMs(): number {
  const configured = Number(process.env.AUTH0_FGA_TIMEOUT_MS);
  return Number.isFinite(configured) &&
    configured >= 500 &&
    configured <= 15_000
    ? configured
    : DEFAULT_FGA_TIMEOUT_MS;
}

function isConfigured(
  config: ReturnType<typeof fgaConfig>,
): config is ReturnType<typeof fgaConfig> {
  return Boolean(
    config.storeId &&
    config.clientId &&
    config.clientSecret &&
    config.auth0Domain &&
    config.apiUrl,
  );
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

async function getFgaToken(): Promise<string> {
  const config = fgaConfig();
  if (!isConfigured(config)) {
    throw new Error("FGA is not configured");
  }

  if (fgaAccessToken && Date.now() < fgaTokenExpiry) {
    return fgaAccessToken;
  }

  const { response, payload } = await fetchJsonWithTimeout(
    `https://${config.auth0Domain}/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        audience: config.audience,
        grant_type: "client_credentials",
      }),
    },
  );

  if (!response.ok) {
    throw new Error("FGA token request failed");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as Record<string, unknown>).access_token !== "string"
  ) {
    throw new Error("FGA token response was invalid");
  }

  const accessToken = (payload as Record<string, unknown>)
    .access_token as string;
  const expiresIn = Number(
    (payload as Record<string, unknown>).expires_in ?? 300,
  );
  const safeExpiresIn =
    Number.isFinite(expiresIn) && expiresIn > 60 ? expiresIn : 300;

  fgaAccessToken = accessToken;
  fgaTokenExpiry = Date.now() + (safeExpiresIn - 60) * 1_000;
  return accessToken;
}

function normalizeDocumentObject(object: string): string {
  return object.startsWith("document:") ? object : `document:${object}`;
}

/**
 * Restricted-document checks fail closed for missing configuration, token
 * failures, timeouts, non-2xx responses, and malformed responses.
 */
export async function fgaCheck({
  user,
  relation,
  object,
}: FgaCheckRequest): Promise<boolean> {
  const config = fgaConfig();
  if (!isConfigured(config)) {
    return false;
  }

  try {
    const token = await getFgaToken();
    const { response, payload } = await fetchJsonWithTimeout(
      `${config.apiUrl}/stores/${config.storeId}/check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tuple_key: {
            user,
            relation,
            object: normalizeDocumentObject(object),
          },
        }),
      },
    );

    if (!response.ok) {
      return false;
    }

    return Boolean(
      payload &&
      typeof payload === "object" &&
      (payload as Record<string, unknown>).allowed === true,
    );
  } catch {
    return false;
  }
}

export async function fgaWriteTuples(tuples: FgaTuple[]): Promise<void> {
  const config = fgaConfig();
  if (!isConfigured(config)) {
    throw new Error("FGA is not configured");
  }
  if (tuples.length === 0) {
    return;
  }

  const token = await getFgaToken();
  const response = await fetchWithTimeout(
    `${config.apiUrl}/stores/${config.storeId}/write`,
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

  if (!response.ok) {
    throw new Error("FGA tuple write failed");
  }
}

export function resetFgaTokenCache(): void {
  fgaAccessToken = null;
  fgaTokenExpiry = 0;
}
