/**
 * Run this script to capture auth state from the browser.
 * Usage: npx playwright test e2e/setup-auth.ts --headed
 *
 * It will open a browser, navigate to the dashboard, and wait for you to log in.
 * Once logged in, it saves the auth state to e2e/auth.json.
 */
import { test as setup } from '@playwright/test';

setup('capture auth state', async ({ page }) => {
  await page.goto('/');

  // Wait for the user to be logged in (strategies page loads)
  await page.waitForURL('**/strategies**', { timeout: 120_000 });

  // Save auth state
  await page.context().storageState({ path: './e2e/auth.json' });
  console.log('Auth state saved to e2e/auth.json');
});
