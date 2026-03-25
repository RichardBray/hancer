import { test, expect } from "@playwright/test";
import { uploadTestImage, waitForCanvas } from "./helpers";
import { join } from "node:path";

const TEST_IMAGE = join(import.meta.dirname, "..", "src", "__tests__", "e2e", "fixtures", "test.png");

test.describe("Export", () => {
  test("export button appears after upload", async ({ page }) => {
    await page.goto("/");
    await uploadTestImage(page, TEST_IMAGE);
    await waitForCanvas(page);
    await expect(page.locator("button", { hasText: /Export|Render/ })).toBeVisible();
  });

  test("clicking export shows progress then download link", async ({ page }) => {
    await page.goto("/");
    await uploadTestImage(page, TEST_IMAGE);
    await waitForCanvas(page);

    await page.locator("button", { hasText: /Export|Render/ }).click();

    await expect(page.locator("text=Download").or(page.locator("[role=progressbar]"))).toBeVisible({
      timeout: 30000,
    });
  });
});
