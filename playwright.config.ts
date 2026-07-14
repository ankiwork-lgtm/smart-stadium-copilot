/**
 * playwright.config.ts
 *
 * Playwright e2e configuration for Smart Stadium Copilot.
 * Starts the Next.js dev server automatically before the suite runs.
 *
 * Run:  npm run test:e2e
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    /**
     * Use the dev server for local development (reused if already running).
     * In CI use a production build so all routes are pre-compiled.
     */
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
