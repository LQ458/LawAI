/** @jest-environment node */

import OpenAI from "openai";
import { NextRequest } from "next/server";
import { getServerIdentity } from "@/lib/serverAuth";
import { POST } from "@/app/api/summary/route";

jest.mock("@/lib/serverAuth", () => ({
  getServerIdentity: jest.fn(),
}));

jest.mock("@/lib/rateLimit", () => ({
  consumeRateLimit: jest.fn().mockResolvedValue(true),
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedIdentity = jest.mocked(getServerIdentity);
const MockedOpenAI = jest.mocked(OpenAI);
const create = jest.fn();

function request(body: string) {
  return new NextRequest("http://localhost/api/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/summary", () => {
  beforeEach(() => {
    mockedIdentity.mockResolvedValue({
      subject: "auth0|alice",
      user: { sub: "auth0|alice" },
    });
    process.env.DEEPSEEK_API_KEY = "test-placeholder";
    MockedOpenAI.mockImplementation(
      () =>
        ({
          chat: { completions: { create } },
        }) as unknown as OpenAI,
    );
    create.mockResolvedValue({
      choices: [{ message: { content: "受控摘要" } }],
    });
  });

  afterAll(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("requires authentication", async () => {
    mockedIdentity.mockResolvedValue(null);

    const response = await POST(request(JSON.stringify({ text: "hello" })));

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects illegal JSON and overlong text", async () => {
    const invalid = await POST(request("{"));
    const overlong = await POST(
      request(JSON.stringify({ text: "x".repeat(20_001) })),
    );

    expect(invalid.status).toBe(400);
    expect(overlong.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("maps upstream failures to a controlled 502", async () => {
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new Error("upstream private detail"));

    const response = await POST(
      request(JSON.stringify({ text: "summarize this" })),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Summary service is unavailable",
    });
    errorLog.mockRestore();
  });

  it("returns a bounded summary on success", async () => {
    const response = await POST(
      request(JSON.stringify({ text: "summarize this" })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ summary: "受控摘要" });
  });
});
