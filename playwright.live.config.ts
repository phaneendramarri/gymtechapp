import { defineConfig, devices } from '@playwright/test';

// Live E2E against a real running worker (API + SPA on one origin).
// Start it first:
//   pnpm db:migrate:local && pnpm db:seed:local && pnpm build:web
//   npx wrangler dev -c wrangler.jsonc --port 8787   (from apps/api)
// Then:  npx playwright test -c playwright.live.config.ts
export default defineConfig({
  testDir: './tests/e2e-live',
  timeout: 90000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'tests/e2e-live/report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1366, height: 850 },
    actionTimeout: 25000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
