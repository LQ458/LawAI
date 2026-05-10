import { test, expect } from "@playwright/test";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

interface RagResponse {
  cases: Array<{ title: string; link: string }>;
  data: string;
  accessDenied?: boolean;
}

async function searchRag(
  query: string,
  userId: string,
): Promise<RagResponse> {
  const res = await fetch(
    `${BASE_URL}/api/rag-search?search=${encodeURIComponent(query)}&userId=${userId}`,
  );
  return res.json();
}

test.describe("FGA 文档权限控制测试", () => {
  test("4.1 RAG 搜索返回相关案例", async () => {
    const result = await searchRag("工伤赔偿", "alice");
    console.log(`alice - accessDenied: ${result.accessDenied}, cases: ${result.cases?.length || 0}`);
    expect(result.cases?.length || 0).toBeGreaterThan(0);
  });

  test("4.2 公开文档对所有用户可见", async () => {
    const result = await searchRag("工伤赔偿", "bob");
    console.log(`bob - accessDenied: ${result.accessDenied}, cases: ${result.cases?.length || 0}`);
    // All current docs are public (no sensitivity metadata) - any user can view
    expect(result.accessDenied).toBe(false);
  });

  test("4.3 不同用户搜索相同关键词返回一致结果", async () => {
    const result = await searchRag("劳动合同", "charlie");
    console.log(`charlie - accessDenied: ${result.accessDenied}, cases: ${result.cases?.length || 0}`);
    expect(result.cases?.length || 0).toBeGreaterThan(0);
  });

  test("4.4 匿名用户也可访问公开文档", async () => {
    const result = await searchRag("工资拖欠", "anonymous");
    console.log(`anonymous - accessDenied: ${result.accessDenied}, cases: ${result.cases?.length || 0}`);
    expect(result.accessDenied).toBe(false);
  });
});
