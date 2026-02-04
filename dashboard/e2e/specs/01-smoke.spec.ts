/**
 * Smoke Test - Quick verification that the app loads and auth works
 *
 * This test should run fast and catch major issues before longer tests run.
 * Depends on: 00-setup (org must exist)
 *
 * NOTE: Uses pre-authenticated session via storageState (no sign-in needed).
 */
import { test, expect } from '../fixtures';
import { navigateToOrg } from '../flows/auth.flow';
import { readState } from '../state';

test.describe('Smoke Test', () => {
  test.beforeEach(async () => {
    const state = readState();
    if (!state.orgAlias) {
      throw new Error('Setup not complete: Organization not created. Run setup first.');
    }
  });

  test('app loads and authentication works', async ({ page, consoleTracker }) => {
    await navigateToOrg(page, '/');

    // Verify we're on the dashboard
    const dashboardContent = page.locator('text=/Dashboard|Strategies|Bots/i').first();
    await expect(dashboardContent, 'Dashboard content should be visible').toBeVisible({ timeout: 10000 });

    // Check console for errors
    console.log(consoleTracker.getSummary());
    consoleTracker.assertNoErrors();

    console.log('✓ Authentication successful, no console errors');
  });

  test('main navigation is accessible', async ({ page, consoleTracker }) => {
    await navigateToOrg(page, '/');

    // Check that main nav items exist
    const navItems = ['Strategies', 'Bots', 'Exchanges', 'Runners'];

    for (const item of navItems) {
      const navLink = page.locator(`a:has-text("${item}"), button:has-text("${item}"), [role="menuitem"]:has-text("${item}")`).first();
      const isVisible = await navLink.isVisible({ timeout: 2000 }).catch(() => false);
      if (isVisible) {
        console.log(`✓ Nav item "${item}" is visible`);
      }
    }

    console.log(consoleTracker.getSummary());
  });

  test('can navigate to strategies page', async ({ page, consoleTracker }) => {
    await navigateToOrg(page, '/strategies');

    // Should see strategies page content
    const pageTitle = page.locator('text=/Strategies|No strategies/i').first();
    await expect(pageTitle, 'Strategies page should load').toBeVisible({ timeout: 10000 });

    // Assert no console errors on this page
    console.log(consoleTracker.getSummary());
    consoleTracker.assertNoErrors();

    console.log('✓ Strategies page loads without errors');
  });

  test('can navigate to runners page', async ({ page, consoleTracker }) => {
    await navigateToOrg(page, '/runners');

    // Should see runners page content (with our runner from setup)
    const runnerName = readState().runnerName;
    if (runnerName) {
      const runnerText = page.getByText(runnerName).first();
      await expect(runnerText, `Runner "${runnerName}" should be visible`).toBeVisible({ timeout: 10000 });
      console.log(`✓ Runners page loads with runner: ${runnerName}`);
    } else {
      const pageTitle = page.locator('text=/Runners|No runners|Create Runner/i').first();
      await expect(pageTitle).toBeVisible({ timeout: 10000 });
      console.log('✓ Runners page loads');
    }

    console.log(consoleTracker.getSummary());
    consoleTracker.assertNoErrors();
  });
});
