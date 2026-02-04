/**
 * E2E Test Fixtures
 *
 * Extended Playwright fixtures with console tracking and better assertions.
 */
import { test as base, expect } from '@playwright/test';
import { ConsoleTracker, trackConsole } from './utils/console-tracker';
import { signInToOrg } from './flows/auth.flow';

// Extend the base test with custom fixtures
export const test = base.extend<{
  consoleTracker: ConsoleTracker;
  signedInPage: void;
}>({
  // Console tracker fixture - automatically attached to each test
  consoleTracker: async ({ page }, callback) => {
    const tracker = trackConsole(page);
    await callback(tracker);

    // After test: report any errors found
    const summary = tracker.getSummary();
    if (tracker.hasCriticalErrors()) {
      console.error('Console errors detected during test:');
      console.error(summary);
    }
  },

  // Auto sign-in fixture (optional - use when needed)
  signedInPage: async ({ page }, callback) => {
    await signInToOrg(page, '/');
    await callback();
  },
});

// Re-export expect for convenience
export { expect };

// Custom assertions
export const assertions = {
  /**
   * Assert page loaded without JS errors
   */
  async assertPageHealthy(tracker: ConsoleTracker): Promise<void> {
    const errors = tracker.getErrors();
    const pageErrors = tracker.getPageErrors();

    if (errors.length > 0 || pageErrors.length > 0) {
      throw new Error(`Page has errors:\n${tracker.getSummary()}`);
    }
  },

  /**
   * Assert element is visible and page is healthy
   */
  async assertVisibleAndHealthy(
    tracker: ConsoleTracker,
    locator: ReturnType<typeof base['prototype']['page']['locator']>,
    timeout = 10000
  ): Promise<void> {
    await expect(locator).toBeVisible({ timeout });
    await assertions.assertPageHealthy(tracker);
  },

  /**
   * Assert navigation succeeded
   */
  async assertNavigationSucceeded(
    tracker: ConsoleTracker,
    page: ReturnType<typeof base['prototype']['page']>,
    expectedUrlPattern: RegExp | string
  ): Promise<void> {
    const url = page.url();
    if (typeof expectedUrlPattern === 'string') {
      if (!url.includes(expectedUrlPattern)) {
        throw new Error(`Expected URL to contain "${expectedUrlPattern}", got "${url}"`);
      }
    } else {
      if (!expectedUrlPattern.test(url)) {
        throw new Error(`Expected URL to match ${expectedUrlPattern}, got "${url}"`);
      }
    }
    await assertions.assertPageHealthy(tracker);
  },
};

// Helper to run test with console check at the end
export async function withConsoleCheck<T>(
  tracker: ConsoleTracker,
  fn: () => Promise<T>
): Promise<T> {
  const result = await fn();
  tracker.assertNoErrors();
  return result;
}
