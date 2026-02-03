import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 600_000, // 10 min per test (backtests can be slow)
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false, // Run sequentially to avoid overloading the runner
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'e2e-report' }],
    ['json', { outputFile: 'e2e-report/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://console.volaticloud.loc',
    screenshot: 'only-on-failure',
    trace: 'off',
    // Use system Chrome which has the CA certificate installed
    channel: 'chrome',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: 'smoke-test.spec.ts',
    },
    {
      name: 'strategy-scenarios',
      testMatch: 'strategy-scenarios.spec.ts',
    },
    {
      name: 'debug',
      testMatch: 'debug-*.spec.ts',
    },
  ],
});
