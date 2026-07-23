import { test, expect } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const AUTH_COOKIE = process.env.E2E_AUTH_COOKIE || "";
const PUBLIC_QUERY = process.env.E2E_PUBLIC_QUERY || "劳动";

test.describe("直接 API 端点测试", () => {
  test("5.1 GET /api/recommend 返回推荐数据", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/recommend`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("recommendations");
    expect(Array.isArray(data.recommendations)).toBe(true);
  });

  test("5.2 POST /api/cases 返回案例列表", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/cases`, {
      data: { page: 1, pageSize: 5, sort: "latest" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("cases");
    expect(Array.isArray(data.cases)).toBe(true);
  });

  test("5.3 POST /api/summary 返回文本总结", async ({ request }) => {
    test.skip(!AUTH_COOKIE, "Optional external suite requires E2E_AUTH_COOKIE");
    const res = await request.post(`${BASE_URL}/api/summary`, {
      headers: { Cookie: AUTH_COOKIE },
      data: { text: "今天天气很好，适合出去玩。" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("summary");
    expect(typeof data.summary).toBe("string");
    expect(data.summary.length).toBeGreaterThan(0);
  });

  test("5.4 POST /api/rag-search 返回结构化 grounded 结果", async ({
    request,
  }) => {
    const res = await request.post(`${BASE_URL}/api/rag-search`, {
      data: { query: PUBLIC_QUERY, userId: "forged-user" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("grounded_rag");
    expect(data.grounded).toBe(true);
    expect(Array.isArray(data.sources)).toBe(true);
  });

  test("5.5 普通登录用户读取 admin activity 返回 403", async ({ request }) => {
    test.skip(
      !AUTH_COOKIE,
      "Optional external suite requires a non-admin E2E_AUTH_COOKIE",
    );
    const res = await request.get(`${BASE_URL}/api/admin/activity`, {
      headers: { Cookie: AUTH_COOKIE },
    });
    expect(res.status()).toBe(403);
  });

  test("5.6 POST /api/fetchAi 返回 SSE 流式回复", async ({ request }) => {
    test.skip(!AUTH_COOKIE, "Optional external suite requires E2E_AUTH_COOKIE");
    const res = await request.post(`${BASE_URL}/api/fetchAi`, {
      headers: { Cookie: AUTH_COOKIE },
      data: {
        chatId: "",
        message: "什么是劳动合同？",
      },
    });

    expect(res.status()).toBe(200);

    const text = await res.text();
    expect(text).toContain("data:");
  });
});
