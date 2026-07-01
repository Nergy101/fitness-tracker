import { defineConfig, devices } from "@playwright/test";

// Dedicated test ports + an isolated, freshly-seeded SQLite DB so E2E runs
// never touch dev data and are deterministic.
const FRONTEND_PORT = 5299;
const BACKEND_PORT = 8100;
const BASE_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
const API_URL = `http://127.0.0.1:${BACKEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests mutate the shared DB — run serially
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // Fresh e2e.db each run: wipe → seed → serve.
      command:
        "rm -f e2e.db && .venv/bin/python seed.py && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port " +
        BACKEND_PORT,
      cwd: "../backend",
      url: `${API_URL}/api/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: "sqlite:///./e2e.db",
        CORS_ORIGINS: `${BASE_URL},http://localhost:${FRONTEND_PORT}`,
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT} --strictPort`,
      url: BASE_URL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
