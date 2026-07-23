import { test, expect } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const MANAGER_COOKIE = process.env.E2E_MANAGER_AUTH_COOKIE || "";
const EMPLOYEE_COOKIE = process.env.E2E_EMPLOYEE_AUTH_COOKIE || "";
const RESTRICTED_QUERY = process.env.E2E_RESTRICTED_QUERY || "";
const RESTRICTED_DOCUMENT_ID = process.env.E2E_RESTRICTED_DOCUMENT_ID || "";
const RESTRICTED_DOCUMENT_TITLE =
  process.env.E2E_RESTRICTED_DOCUMENT_TITLE || "";
const PUBLIC_QUERY = process.env.E2E_PUBLIC_QUERY || "";

interface RagResponse {
  mode: "grounded_rag";
  grounded: boolean;
  answer: string;
  sources: Array<{ id: string; title: string; source: string }>;
}

async function searchRag(
  query: string,
  cookie?: string,
  extraBody: Record<string, unknown> = {},
): Promise<{ status: number; body: RagResponse }> {
  const response = await fetch(`${BASE_URL}/api/rag-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ query, ...extraBody }),
  });
  return { status: response.status, body: await response.json() };
}

function requireRestrictedFixture() {
  test.skip(
    !MANAGER_COOKIE ||
      !EMPLOYEE_COOKIE ||
      !RESTRICTED_QUERY ||
      !RESTRICTED_DOCUMENT_ID,
    "Optional FGA E2E requires manager/employee sessions and a restricted fixture",
  );
}

test.describe("FGA 文档权限控制测试（可选真实服务）", () => {
  test("4.1 manager 可读取获准 restricted document", async () => {
    requireRestrictedFixture();
    const result = await searchRag(RESTRICTED_QUERY, MANAGER_COOKIE);

    expect(result.status).toBe(200);
    expect(result.body.sources.map((source) => source.id)).toContain(
      RESTRICTED_DOCUMENT_ID,
    );
  });

  test("4.2 employee 对同一 restricted document 被拒绝", async () => {
    requireRestrictedFixture();
    const result = await searchRag(RESTRICTED_QUERY, EMPLOYEE_COOKIE);

    expect(result.status).toBe(200);
    expect(result.body.sources.map((source) => source.id)).not.toContain(
      RESTRICTED_DOCUMENT_ID,
    );
    if (RESTRICTED_DOCUMENT_TITLE) {
      expect(JSON.stringify(result.body)).not.toContain(
        RESTRICTED_DOCUMENT_TITLE,
      );
    }
  });

  test("4.3 anonymous 只能收到 explicit public sources", async () => {
    test.skip(!PUBLIC_QUERY, "Optional FGA E2E requires E2E_PUBLIC_QUERY");
    const result = await searchRag(PUBLIC_QUERY);

    expect(result.status).toBe(200);
    expect(result.body.grounded).toBe(true);
    expect(result.body.sources.map((source) => source.id)).not.toContain(
      RESTRICTED_DOCUMENT_ID,
    );
  });

  test("4.4 伪造 body userId 不能提升 anonymous 权限", async () => {
    test.skip(
      !RESTRICTED_QUERY || !RESTRICTED_DOCUMENT_ID,
      "Optional FGA E2E requires a restricted fixture",
    );
    const result = await searchRag(RESTRICTED_QUERY, undefined, {
      userId: "forged-manager",
    });

    expect(result.status).toBe(200);
    expect(result.body.sources.map((source) => source.id)).not.toContain(
      RESTRICTED_DOCUMENT_ID,
    );
  });
});
