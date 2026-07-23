import { Page } from "@playwright/test";

export async function waitForApp(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);
}

export async function expectDialogVisible(page: Page): Promise<void> {
  const dialog = page.locator('[role="dialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 15000 });
}

export async function expectTextVisible(
  page: Page,
  text: string,
): Promise<void> {
  await page
    .getByText(text)
    .first()
    .waitFor({ state: "visible", timeout: 5000 });
}

export async function typeInChatInput(page: Page, text: string): Promise<void> {
  const textarea = page.locator("textarea").first();
  await textarea.click();
  await textarea.fill(text);
}

export async function submitChat(page: Page): Promise<void> {
  await page.locator("textarea").first().press("Enter");
}

export async function waitForAIResponse(page: Page): Promise<string> {
  const assistantBubble = page
    .locator(".bg-gray-100, [class*='bg-gray-100']")
    .last();

  await assistantBubble.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(2000);

  const content = await assistantBubble.textContent();
  return content?.trim() || "";
}

export function extractSSEData(chunk: string): string {
  const lines = chunk.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.content) return data.content;
      } catch {
        // skip invalid JSON
      }
    }
  }
  return "";
}
