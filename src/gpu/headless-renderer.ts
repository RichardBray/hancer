import { chromium, type Browser, type Page } from "playwright";
import { join } from "node:path";

export interface HeadlessRenderer {
  init(width: number, height: number): Promise<void>;
  renderFrame(
    rgba: Uint8Array,
    width: number,
    height: number,
    params: Record<string, unknown>
  ): Promise<Uint8Array>;
  close(): Promise<void>;
}

class HeadlessRendererImpl implements HeadlessRenderer {
  private browser: Browser;
  private page: Page;

  constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.page = page;
  }

  async init(width: number, height: number): Promise<void> {
    await this.page.evaluate(
      ({ w, h }: { w: number; h: number }) => window.__initRenderer(w, h),
      { w: width, h: height }
    );
  }

  async renderFrame(
    rgba: Uint8Array,
    width: number,
    height: number,
    params: Record<string, unknown>
  ): Promise<Uint8Array> {
    await this.page.evaluate(
      ({
        data,
        w,
        h,
        p,
      }: {
        data: number[];
        w: number;
        h: number;
        p: Record<string, unknown>;
      }) => window.__renderFrame(new Uint8Array(data), w, h, p as never),
      { data: Array.from(rgba), w: width, h: height, p: params }
    );

    const pixelArray = await this.page.evaluate(() => window.__readPixels());
    return new Uint8Array(pixelArray as unknown as number[]);
  }

  async close(): Promise<void> {
    await this.page.evaluate(() => window.__destroy());
    await this.browser.close();
  }
}

async function setupPage(page: Page): Promise<void> {
  await page.setContent(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body><canvas id="c"></canvas></body>
</html>`);

  const scriptPath = join(import.meta.dir, "dist", "render-worker-entry.js");
  await page.addScriptTag({ path: scriptPath });

  await page.waitForFunction(() => typeof window.__initRenderer === "function", {
    timeout: 10000,
  });
}

export async function createHeadlessRenderer(): Promise<HeadlessRenderer> {
  const browser = await chromium.launch({
    args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"],
  });

  const page = await browser.newPage();
  await setupPage(page);
  return new HeadlessRendererImpl(browser, page);
}
