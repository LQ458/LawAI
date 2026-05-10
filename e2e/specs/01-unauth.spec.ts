import { test, expect } from "@playwright/test";
import { waitForApp, expectDialogVisible, expectTextVisible } from "../fixtures/helpers";

test.describe("未登录状态 UI 测试", () => {
  test("1.1 首页加载，显示登录对话框", async ({ page }) => {
    await waitForApp(page);
    await expectDialogVisible(page);
    await expectTextVisible(page, "登录");
    await expectTextVisible(page, "注册新账号");
  });

  test("1.2 侧边栏头部渲染正确", async ({ page }) => {
    await waitForApp(page);
    await expect(page.getByText("法律AI").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("1.3 总结 API 测试 (绕过模态框)", async ({ request }) => {
    const res = await request.post("http://localhost:3000/api/summary", {
      data: {
        text: "根据《劳动合同法》规定，用人单位应当与劳动者签订书面劳动合同。未签订劳动合同的，应当支付双倍工资。",
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("summary");
    expect(typeof data.summary).toBe("string");
    expect(data.summary.length).toBeGreaterThan(10);
  });

  test("1.4 总结对话框在 UI 中存在", async ({ page }) => {
    await waitForApp(page);
    const summaryBtn = page.locator('[data-tour="summary"]').first();
    await expect(summaryBtn).toBeVisible({ timeout: 5000 });
  });

  test("1.5 推荐页面需要登录", async ({ page }) => {
    await page.goto("/recommend");
    await page.waitForLoadState("domcontentloaded");
    await expectTextVisible(page, "请先登录");
  });

  test("1.6 管理页面需要登录", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");
    await expectTextVisible(page, "请先登录");
  });
});
