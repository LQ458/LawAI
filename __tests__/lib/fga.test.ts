/** @jest-environment node */

import { fgaCheck, resetFgaTokenCache } from "@/lib/fga";

const configKeys = [
  "AUTH0_FGA_STORE_ID",
  "AUTH0_FGA_CLIENT_ID",
  "AUTH0_FGA_CLIENT_SECRET",
  "AUTH0_DOMAIN",
  "AUTH0_FGA_API_URL",
] as const;

describe("FGA fail-closed behavior", () => {
  const original: Partial<Record<(typeof configKeys)[number], string>> = {};

  beforeAll(() => {
    for (const key of configKeys) {
      original[key] = process.env[key];
    }
  });

  beforeEach(() => {
    resetFgaTokenCache();
    global.fetch = jest.fn();
    process.env.AUTH0_FGA_STORE_ID = "store-placeholder";
    process.env.AUTH0_FGA_CLIENT_ID = "client-placeholder";
    process.env.AUTH0_FGA_CLIENT_SECRET = "secret-placeholder";
    process.env.AUTH0_DOMAIN = "tenant.example.invalid";
    process.env.AUTH0_FGA_API_URL = "https://fga.example.invalid";
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
    delete process.env.AUTH0_FGA_STORE_ID;

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
  });

  it("denies malformed check responses", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        Response.json({ access_token: "token", expires_in: 300 }),
      )
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
});
