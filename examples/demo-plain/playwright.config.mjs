// Cấu hình Playwright của dự án.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.mjs$/,
  outputDir: "./e2e/test-results/playwright",
  globalSetup: "./e2e/global-setup.mjs",
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:4310",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
