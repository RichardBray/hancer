import { test, expect } from "@playwright/test";
import { uploadTestImage, waitForCanvas } from "./helpers";
import { join } from "node:path";

const TEST_IMAGE = join(import.meta.dirname, "..", "src", "__tests__", "e2e", "fixtures", "test.png");

test.describe("Upload and preview", () => {
  test("uploading an image shows the WebGPU canvas", async ({ page }) => {
    await page.goto("/");
    await uploadTestImage(page, TEST_IMAGE);
    await waitForCanvas(page);
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test("upload replaces drop zone with preview", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Drop image or video here")).toBeVisible();
    await uploadTestImage(page, TEST_IMAGE);
    await waitForCanvas(page);
    await expect(page.locator("text=Drop image or video here")).not.toBeVisible();
  });
});
