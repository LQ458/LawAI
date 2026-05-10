function getFgaStoreId() { return process.env.AUTH0_FGA_STORE_ID || ""; }
function getFgaClientId() { return process.env.AUTH0_FGA_CLIENT_ID || ""; }
function getFgaClientSecret() { return process.env.AUTH0_FGA_CLIENT_SECRET || ""; }
function getFgaApiUrl() { return process.env.AUTH0_FGA_API_URL || "https://api.us1.fga.dev"; }

interface FgaCheckRequest {
  user: string;
  relation: string;
  object: string;
}

let fgaAccessToken: string | null = null;
let fgaTokenExpiry = 0;

async function getFgaToken(): Promise<string> {
  const token = fgaAccessToken;
  if (token && Date.now() < fgaTokenExpiry) {
    return token;
  }

  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getFgaClientId(),
      client_secret: getFgaClientSecret(),
      audience: "https://api.us1.fga.dev",
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    throw new Error(`FGA auth failed: ${res.statusText}`);
  }

  const data = await res.json();
  fgaAccessToken = data.access_token;
  fgaTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return data.access_token;
}

export async function fgaCheck({
  user,
  relation,
  object,
}: FgaCheckRequest): Promise<boolean> {
  if (!getFgaStoreId()) {
    console.warn("FGA store ID not configured, allowing all access");
    return true;
  }

  try {
    const token = await getFgaToken();

    const body = {
      tuple_key: {
        user,
        relation,
        object: `${object.startsWith("document:") ? object : `document:${object}`}`,
      },
    };

    const res = await fetch(
      `${getFgaApiUrl()}/stores/${getFgaStoreId()}/check`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      console.error("FGA check failed:", await res.text());
      return false;
    }

    const data = await res.json();
    return data.allowed ?? false;
  } catch (error) {
    console.error("FGA check error:", error);
    return false;
  }
}

export async function fgaWriteTuples(
  tuples: Array<{ user: string; relation: string; object: string }>,
): Promise<void> {
  if (!getFgaStoreId()) return;

  const token = await getFgaToken();

  const writes = tuples.map((t) => ({
    tuple_key: {
      user: t.user,
      relation: t.relation,
      object: t.object,
    },
  }));

  await fetch(`${getFgaApiUrl()}/stores/${getFgaStoreId()}/write`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ writes }),
  });
}
