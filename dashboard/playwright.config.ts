import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, 'e2e', '.auth', 'user.json');

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

  // Global setup - authenticates once before all tests
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://console.volaticloud.loc',
    screenshot: 'only-on-failure',
    trace: 'off',
    // Use system Chrome which has the CA certificate installed
    channel: 'chrome',
    // Run in headed mode for visibility
    headless: false,
    // Reuse auth state from global setup
    storageState: AUTH_FILE,
  },
  projects: [
    //
    // === PIPELINE: Run `npx playwright test` or `npx playwright test --project=pipeline` ===
    // Full E2E flow with dependencies. Setup runs first, then all tests reuse state.
    //
    {
      name: 'setup',
      testMatch: 'specs/00-setup.spec.ts',
      // Setup doesn't need pre-existing auth - it creates the org
      use: { storageState: AUTH_FILE },
    },
    {
      name: 'smoke',
      testMatch: 'specs/01-smoke.spec.ts',
      dependencies: ['setup'],
    },
    {
      name: 'organization',
      testMatch: 'specs/02-organization-billing.spec.ts',
      dependencies: ['setup'],
    },
    {
      name: 'runner',
      testMatch: 'specs/03-runner-data.spec.ts',
      dependencies: ['setup'],
    },
    {
      name: 'strategy',
      testMatch: 'specs/04-strategy-builder.spec.ts',
      dependencies: ['setup'],
    },
    {
      name: 'bot',
      testMatch: 'specs/05-bot-management.spec.ts',
      dependencies: ['setup'],
    },
    // Run full pipeline (setup + all tests)
    {
      name: 'pipeline',
      testMatch: 'specs/*.spec.ts',
    },

    //
    // === STANDALONE: Run individual projects without setup ===
    // Use these when you have existing state or want to debug specific tests.
    //
    {
      name: 'organization-standalone',
      testMatch: 'specs/02-organization-billing.spec.ts',
    },
    {
      name: 'runner-standalone',
      testMatch: 'specs/03-runner-data.spec.ts',
    },
    {
      name: 'strategy-standalone',
      testMatch: 'specs/04-strategy-builder.spec.ts',
    },
    {
      name: 'bot-standalone',
      testMatch: 'specs/05-bot-management.spec.ts',
    },

    //
    // === LEGACY: Old test files (to be deprecated) ===
    //
    {
      name: 'legacy-smoke',
      testMatch: 'smoke-test.spec.ts',
    },
    {
      name: 'legacy-strategy',
      testMatch: 'strategy-scenarios.spec.ts',
    },
    {
      name: 'debug',
      testMatch: 'debug-*.spec.ts',
    },
  ],
});
