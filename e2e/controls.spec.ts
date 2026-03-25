import { test, expect } from "@playwright/test";
import { uploadTestImage, waitForCanvas, TEST_IMAGE } from "./helpers";

test.describe("Controls panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await uploadTestImage(page, TEST_IMAGE);
    await waitForCanvas(page);
  });

  test("renders all effect group headers", async ({ page }) => {
    const groups = [
      "Color Settings", "Halation", "Chromatic Aberration", "Bloom",
      "Grain", "Vignette", "Split Tone", "Camera Shake",
    ];
    for (const group of groups) {
      await expect(page.locator(`text=${group}`).first()).toBeVisible();
    }
  });

  test("sliders update displayed values", async ({ page }) => {
    const exposureSlider = page.locator('input[type="range"]').first();
    await exposureSlider.fill("1.5");
    await expect(page.locator("text=1.5").first()).toBeVisible();
  });

  test("toggling an effect group disables its controls", async ({ page }) => {
    const colorToggle = page.locator("text=Color Settings").locator("..").locator('input[type="checkbox"]');
    await colorToggle.uncheck();
    await expect(page.locator("text=Exposure")).not.toBeVisible();
  });
});
