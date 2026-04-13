import { test, expect } from "@playwright/test";

test.describe("UI loads", () => {
  test("renders the app shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=hance")).toBeVisible();
  });

  test("shows the upload drop zone", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Drop image or video here")).toBeVisible();
  });

  test("has no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });
});
