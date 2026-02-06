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
  fullyParallel: process.env.E2E_PARALLEL === 'true',
  retries: 0,
  workers: process.env.E2E_WORKERS ? parseInt(process.env.E2E_WORKERS) : 1,
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
    // Use system Chrome locally, bundled Chromium in CI
    channel: process.env.CI === 'true' ? undefined : 'chrome',
    // Headless mode (default: false for local dev, true for CI)
    headless: process.env.E2E_HEADLESS !== 'false',
    // Trust self-signed certs in E2E
    ignoreHTTPSErrors: true,
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
    // Run full pipeline (all tests except setup - setup runs via dependencies)
    {
      name: 'pipeline',
      testMatch: 'specs/*.spec.ts',
      testIgnore: 'specs/00-setup.spec.ts', // Exclude setup - it runs via dependencies
      dependencies: ['setup'],
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
