import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:4801",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run build:ui && bun run src/cli.ts ui --port 4801",
    port: 4801,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
