import { defineConfig, devices } from "@playwright/test";

const FRONTEND_URL = "http://127.0.0.1:4173";
const BACKEND_URL = "http://127.0.0.1:5001";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    [process.env.CI ? "github" : "line"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: FRONTEND_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      grepInvert: /@mobile/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      grep: /@mobile/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command: "node ../backend/test/e2e/server.js",
      env: {
        ...process.env,
        E2E_BACKEND_PORT: "5001",
        E2E_FRONTEND_URL: FRONTEND_URL,
        MONGOMS_VERSION: "8.2.6",
      },
      reuseExistingServer: !process.env.CI,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 240_000,
      url: `${BACKEND_URL}/live`,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 4173 --strictPort",
      env: {
        ...process.env,
        VITE_API_BASE_URL: BACKEND_URL,
      },
      reuseExistingServer: !process.env.CI,
      stderr: "pipe",
      stdout: "pipe",
      timeout: 60_000,
      url: FRONTEND_URL,
    },
  ],
});
