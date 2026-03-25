import { type Page } from "@playwright/test";

export async function uploadTestImage(page: Page, fixturePath: string) {
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("text=Drop image or video here").click(),
  ]);
  await fileChooser.setFiles(fixturePath);
}

export async function waitForCanvas(page: Page) {
  await page.waitForSelector("canvas", { timeout: 10000 });
}
