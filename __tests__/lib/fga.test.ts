/** @jest-environment node */

import { fgaCheck, resetFgaTokenCache } from "@/lib/fga";
import { REQUIRED_FGA_MODEL } from "@/lib/fgaModel";

const fgaEnvKey = (suffix: string) => ["AUTH0", "FGA", suffix].join("_");
const config = {
  storeId: fgaEnvKey("STORE_ID"),
  clientId: fgaEnvKey("CLIENT_ID"),
  clientSecret: fgaEnvKey("CLIENT_SECRET"),
  apiUrl: fgaEnvKey("API_URL"),
  audience: fgaEnvKey("AUDIENCE"),
  tokenIssuer: fgaEnvKey("TOKEN_ISSUER"),
} as const;
const configKeys = Object.values(config);

function modelResponse() {
  return Response.json({
    authorization_models: [
      {
        id: "model-placeholder",
        ...REQUIRED_FGA_MODEL,
      },
    ],
    continuation_token: "",
  });
}

describe("FGA fail-closed behavior", () => {
  const original: Partial<Record<string, string>> = {};

  beforeAll(() => {
    for (const key of configKeys) {
      original[key] = process.env[key];
    }
  });

  beforeEach(() => {
    resetFgaTokenCache();
    global.fetch = jest.fn();
    process.env[config.storeId] = "test";
    process.env[config.clientId] = "test";
    process.env[config.clientSecret] = "test";
    process.env[config.apiUrl] = "https://fga.example.invalid";
    process.env[config.audience] = "https://fga.example.invalid";
    process.env[config.tokenIssuer] = "auth.example.invalid";
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.AUTH0_FGA_TIMEOUT_MS;
  });

  afterAll(() => {
    for (const key of configKeys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it("denies when FGA configuration is incomplete", async () => {
    delete process.env[config.storeId];

    await expect(
      fgaCheck({
        user: "user:auth0_test",
        relation: "viewer",
        object: "document:restricted",
      }),
    ).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("denies when token acquisition fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(null, { status: 503 }),
    );

    await expect(
      fgaCheck({
        user: "user:auth0_test",
        relation: "viewer",
        object: "document:restricted",
      }),
    ).resolves.toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://auth.example.invalid/oauth/token",
      expect.objectContaining({
        body: expect.stringContaining(
          '"audience":"https://fga.example.invalid/"',
        ),
      }),
    );
  });

  it("denies malformed check responses", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        Response.json({ access_token: "token", expires_in: 300 }),
      )
      .mockResolvedValueOnce(modelResponse())
      .mockResolvedValueOnce(Response.json({ allowed: "yes" }));

    await expect(
      fgaCheck({
        user: "user:auth0_test",
        relation: "viewer",
        object: "document:restricted",
      }),
    ).resolves.toBe(false);
  });

  it("denies when an FGA response body exceeds the timeout", async () => {
    jest.useFakeTimers();
    process.env.AUTH0_FGA_TIMEOUT_MS = "500";
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        Response.json({ access_token: "token", expires_in: 300 }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: () => new Promise(() => undefined),
      });

    const decision = fgaCheck({
      user: "user:auth0_test",
      relation: "viewer",
      object: "document:restricted",
    });
    await jest.advanceTimersByTimeAsync(501);
    await expect(decision).resolves.toBe(false);
  });

  it("denies when the store model is missing or ambiguous", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        Response.json({ access_token: "token", expires_in: 300 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          authorization_models: [],
          continuation_token: "",
        }),
      );

    await expect(
      fgaCheck({
        user: "user:auth0_test",
        relation: "viewer",
        object: "document:restricted",
      }),
    ).resolves.toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("pins a successful check to the verified model", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        Response.json({ access_token: "token", expires_in: 300 }),
      )
      .mockResolvedValueOnce(modelResponse())
      .mockResolvedValueOnce(Response.json({ allowed: true }));

    await expect(
      fgaCheck({
        user: "user:auth0_test",
        relation: "viewer",
        object: "restricted",
      }),
    ).resolves.toBe(true);

    const checkRequest = (global.fetch as jest.Mock).mock.calls[2][1] as {
      body: string;
    };
    expect(JSON.parse(checkRequest.body)).toMatchObject({
      authorization_model_id: "model-placeholder",
      tuple_key: {
        user: "user:auth0_test",
        relation: "viewer",
        object: "document:restricted",
      },
    });
  });
});
