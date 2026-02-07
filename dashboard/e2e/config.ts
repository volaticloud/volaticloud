/**
 * E2E Test Configuration
 *
 * Centralized configuration for timeouts and other test settings.
 * Import these values instead of hardcoding timeouts in test files.
 */

/**
 * Timeout values for different test scenarios (in milliseconds).
 */
export const E2E_TIMEOUTS = {
  /** Default test timeout (10 minutes) */
  DEFAULT_TEST: 10 * 60 * 1000,

  /** Stripe subscription flow (2 minutes) */
  STRIPE_FLOW: 2 * 60 * 1000,

  /** Runner data download (5 minutes) */
  DATA_DOWNLOAD: 5 * 60 * 1000,

  /** Single backtest execution (4 minutes) */
  BACKTEST: 4 * 60 * 1000,

  /** Long backtest with multiple pairs (8 minutes) */
  BACKTEST_LONG: 8 * 60 * 1000,

  /** Strategy builder operations (3 minutes) */
  STRATEGY_BUILDER: 3 * 60 * 1000,

  /** Navigation and page load (30 seconds) */
  NAVIGATION: 30 * 1000,

  /** Element visibility check (10 seconds) */
  ELEMENT_VISIBLE: 10 * 1000,

  /** Form submission (5 seconds) */
  FORM_SUBMIT: 5 * 1000,

  /** WebSocket message wait (5 seconds) */
  WEBSOCKET_MESSAGE: 5 * 1000,
} as const;

/**
 * Polling intervals for status checks (in milliseconds).
 */
export const E2E_POLL_INTERVALS = {
  /** Data download progress check */
  DATA_DOWNLOAD_PROGRESS: 5 * 1000,

  /** Backtest status check */
  BACKTEST_STATUS: 3 * 1000,

  /** General status check */
  DEFAULT: 1 * 1000,
} as const;

/**
 * Retry configuration for flaky operations.
 */
export const E2E_RETRY = {
  /** Maximum retry attempts */
  MAX_ATTEMPTS: 3,

  /** Delay between retries (in milliseconds) */
  DELAY: 1 * 1000,
} as const;

/**
 * Base URLs for E2E environment.
 */
export const E2E_URLS = {
  /** Dashboard base URL */
  BASE_URL: process.env.E2E_BASE_URL || 'https://console.volaticloud.loc',

  /** Keycloak auth URL */
  KEYCLOAK_URL: process.env.E2E_KEYCLOAK_URL || 'https://auth.volaticloud.loc',
} as const;

/**
 * Test credentials (for E2E environment only).
 */
export const E2E_CREDENTIALS = {
  /** Test user email */
  EMAIL: process.env.E2E_TEST_EMAIL || 'test@test.com',

  /** Test user password */
  PASSWORD: process.env.E2E_TEST_PASSWORD || 'Test123!',
} as const;
