/** @jest-environment node */

import { NextRequest } from "next/server";
import { getServerIdentity } from "@/lib/serverAuth";
import { RagServiceError, runGroundedRag } from "@/lib/rag";
import { POST } from "@/app/api/rag-search/route";

jest.mock("@/lib/serverAuth", () => ({
  getServerIdentity: jest.fn(),
}));

jest.mock("@/lib/rag", () => {
  class MockRagServiceError extends Error {
    constructor(
      public service: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    runGroundedRag: jest.fn(),
    RagServiceError: MockRagServiceError,
  };
});

const mockedIdentity = jest.mocked(getServerIdentity);
const mockedRag = jest.mocked(runGroundedRag);

function request(body: string, contentType = "application/json") {
  return new NextRequest("http://localhost/api/rag-search", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
}

describe("POST /api/rag-search", () => {
  beforeEach(() => {
    mockedIdentity.mockResolvedValue({
      subject: "auth0|alice",
      user: { sub: "auth0|alice" },
    });
    mockedRag.mockResolvedValue({
      mode: "grounded_rag",
      grounded: true,
      answer: "回答 [DOC:public-1]",
      sources: [
        {
          id: "public-1",
          title: "公开资料",
          source: "CAIL2018",
        },
      ],
    });
  });

  it("ignores a forged client userId and uses the server-side identity", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          query: "劳动争议",
          userId: "auth0|bob",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedRag).toHaveBeenCalledWith("劳动争议", "auth0|alice");
  });

  it("uses anonymous identity when there is no session", async () => {
    mockedIdentity.mockResolvedValue(null);
    await POST(request(JSON.stringify({ query: "公开资料" })));

    expect(mockedRag).toHaveBeenCalledWith("公开资料", null);
  });

  it.each([
    ["illegal JSON", "{", 400, "invalid_json"],
    [
      "non-string query",
      JSON.stringify({ query: 123 }),
      400,
      "query_must_be_a_non_empty_string",
    ],
    [
      "overlong query",
      JSON.stringify({ query: "x".repeat(1_001) }),
      400,
      "query_must_be_a_non_empty_string",
    ],
  ])("rejects %s", async (_, body, status, error) => {
    const response = await POST(request(body));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error });
    expect(mockedRag).not.toHaveBeenCalled();
  });

  it("maps external service failures to a controlled response", async () => {
    mockedRag.mockRejectedValue(
      new RagServiceError("pinecone", "private upstream detail"),
    );

    const response = await POST(request(JSON.stringify({ query: "劳动争议" })));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "rag_upstream_unavailable",
      upstream: "pinecone",
    });
  });
});
