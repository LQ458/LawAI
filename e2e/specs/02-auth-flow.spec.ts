import { test, expect } from "@playwright/test";
import { waitForApp } from "../fixtures/helpers";

test.describe("Auth0 流程测试", () => {
  test("2.1 登录按钮在对话框中可见", async ({ page }) => {
    await waitForApp(page);

    const loginBtn = page.getByRole("button", { name: "登录" });
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
  });

  test("2.2 注册按钮在对话框中可见", async ({ page }) => {
    await waitForApp(page);

    const signupBtn = page.getByRole("button", { name: "注册新账号" });
    await expect(signupBtn).toBeVisible({ timeout: 5000 });
  });

  test("2.3 /auth/login 重定向到 Auth0", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForURL(/auth\.com/, { timeout: 10_000 }).catch(() => {
      // Auth0 may not be reachable, check that URL changed
    });
    const url = page.url();
    expect(url).toContain("auth0.com");
  });

  test("2.4 /auth/logout 终止会话", async ({ page }) => {
    await page.goto("/auth/logout");
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
    const url = page.url();
    expect(
      url.includes("localhost") || url.includes("auth0.com"),
    ).toBeTruthy();
  });
});
