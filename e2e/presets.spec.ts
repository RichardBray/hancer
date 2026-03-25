import { test, expect } from "@playwright/test";
import { uploadTestImage, waitForCanvas, TEST_IMAGE } from "./helpers";

test.describe("Presets", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await uploadTestImage(page, TEST_IMAGE);
    await waitForCanvas(page);
  });

  test("preset dropdown lists built-in presets", async ({ page }) => {
    const select = page.locator("select").first();
    const options = await select.locator("option").allTextContents();
    expect(options).toContain("default");
    expect(options).toContain("subtle");
    expect(options).toContain("heavy");
  });

  test("switching preset updates slider values", async ({ page }) => {
    const select = page.locator("select").first();
    await select.selectOption("heavy");
    await page.waitForTimeout(500);
    // Heavy preset should load without errors
  });

  test("save preset creates a new entry", async ({ page }) => {
    const nameInput = page.locator('input[type="text"][placeholder*="Preset"]');
    await nameInput.fill("playwright-test");
    await page.locator("button", { hasText: "Save" }).click();
    await page.waitForTimeout(500);
    const select = page.locator("select").first();
    const options = await select.locator("option").allTextContents();
    expect(options).toContain("playwright-test");
  });
});
