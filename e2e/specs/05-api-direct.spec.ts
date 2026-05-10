import { test, expect } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

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
    const res = await request.post(`${BASE_URL}/api/summary`, {
      data: { text: "今天天气很好，适合出去玩。" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("summary");
    expect(typeof data.summary).toBe("string");
    expect(data.summary.length).toBeGreaterThan(0);
  });

  test("5.4 GET /api/rag-search 返回相关案例", async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/rag-search?search=工伤&userId=test-user`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("cases");
    expect(data).toHaveProperty("data");
  });

  test("5.5 GET /api/getCase 返回案例搜索结果", async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/getCase?search=工伤`,
    );
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("cases");
    expect(data).toHaveProperty("data");
  });

  test("5.6 POST /api/fetchAi 返回 SSE 流式回复", async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/fetchAi`, {
      data: {
        userId: `test-api-${Date.now()}`,
        chatId: "",
        message: "什么是劳动合同？",
      },
    });

    expect(res.status()).toBe(200);

    const text = await res.text();
    expect(text).toContain("data:");
  });
});
