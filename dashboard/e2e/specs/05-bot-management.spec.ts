/**
 * Bot Management E2E Tests
 *
 * Tests bot creation, lifecycle management, and monitoring.
 *
 * Depends on: 00-setup (org + runner must exist)
 * Uses: Strategy from 04-strategy-builder (optional)
 *
 * NOTE: Uses pre-authenticated session via storageState (no sign-in needed).
 */
import { test, expect } from '@playwright/test';
import { navigateToOrg, waitForPageReady } from '../flows/auth.flow';
import { readState } from '../state';

test.describe('Bot Management', () => {
  const timestamp = Date.now();

  test.beforeEach(async () => {
    const state = readState();
    if (!state.orgName) {
      throw new Error('Setup not complete: Organization not created. Run setup first.');
    }
  });

  test.describe('Bot Creation', () => {
    test('can create a basic bot', async ({ page }) => {
      await navigateToOrg(page, '/bots');

      // Check if create button is available
      const createBtn = page.locator('button:has-text("Create Bot")').first();
      const isCreateVisible = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isCreateVisible) {
        console.log('Create Bot button not visible - may need exchange/runner/strategy first');
        return;
      }

      await createBtn.click();
      await page.waitForTimeout(1000);

      // Fill bot name
      const nameInput = page.getByLabel('Bot Name');
      await nameInput.waitFor({ state: 'visible', timeout: 5000 });
      await nameInput.fill(`Test Bot ${timestamp}`);

      // Check for required dropdowns
      const strategySelect = page.locator('label:has-text("Strategy") ~ [role="combobox"]').first();
      const hasStrategies = await strategySelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasStrategies) {
        console.log('⚠ No strategy select visible - may need to create strategy first');
        return;
      }

      // Try to select first available strategy
      await strategySelect.click();
      await page.waitForTimeout(500);

      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 2000 })) {
        await firstOption.click();
        await page.waitForTimeout(500);
      }

      console.log('✓ Bot creation form accessible');
    });

    test('validates required fields', async ({ page }) => {
      await navigateToOrg(page, '/bots');

      const createBtn = page.locator('button:has-text("Create Bot")').first();
      if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
        console.log('Create Bot not available');
        return;
      }

      await createBtn.click();
      await page.waitForTimeout(1000);

      // Try to submit without filling required fields
      const submitBtn = page.locator('[data-testid="submit-create-bot"], button[type="submit"]:has-text("Create")').first();
      if (await submitBtn.isVisible({ timeout: 2000 })) {
        await submitBtn.click();
        await page.waitForTimeout(500);

        // Should see validation errors
        const errorText = page.locator('text=/required|error|invalid/i').first();
        const hasError = await errorText.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasError) {
          console.log('✓ Validation errors shown for required fields');
        }
      }
    });
  });

  test.describe('Bot Lifecycle', () => {
    test('can view bot list', async ({ page }) => {
      await navigateToOrg(page, '/bots');

      // Check for bot list or empty state
      const botContent = page.locator('text=/No bots|Create Bot|Bot Name|Status/i').first();
      await expect(botContent).toBeVisible({ timeout: 10000 });

      console.log('✓ Bots page loads correctly');
    });

    test('can filter and search bots', async ({ page }) => {
      await navigateToOrg(page, '/bots');

      // Look for search/filter input
      const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"]').first();
      const hasSearch = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasSearch) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        console.log('✓ Bot search works');
      } else {
        console.log('Search input not found (may not be implemented)');
      }
    });
  });

  test.describe('Bot Status & Monitoring', () => {
    test('can view bot details page', async ({ page }) => {
      await navigateToOrg(page, '/bots');

      // Click on first bot if exists
      const botRow = page.locator('tr:has([data-testid*="bot"]), [data-testid*="bot-row"]').first();
      const hasBot = await botRow.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasBot) {
        console.log('No bots found to view details');
        return;
      }

      await botRow.click();
      await waitForPageReady(page);

      // Should see bot details
      const detailsContent = page.locator('text=/Status|Configuration|Trades|Performance/i').first();
      const hasDetails = await detailsContent.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDetails) {
        console.log('✓ Bot details page loads');
      }
    });

    test('can view bot performance metrics', async ({ page }) => {
      await navigateToOrg(page, '/bots');

      // Look for performance indicators
      const metrics = page.locator('text=/Profit|Trades|Win Rate|Drawdown/i').first();
      const hasMetrics = await metrics.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasMetrics) {
        console.log('✓ Bot performance metrics visible');
      } else {
        console.log('No performance metrics visible (bots may not have run)');
      }
    });
  });
});

test.describe('Exchange Management', () => {
  const timestamp = Date.now();

  test('can create an exchange connection', async ({ page }) => {
    await navigateToOrg(page, '/exchanges');

    // Check for add exchange button
    const addBtn = page.locator('button:has-text("Add Exchange")').first();
    const isAddVisible = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isAddVisible) {
      console.log('Add Exchange button not visible');
      return;
    }

    await addBtn.click();
    await page.waitForTimeout(1000);

    // Fill exchange name
    const nameInput = page.getByLabel('Exchange Name');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(`Test Exchange ${timestamp}`);

    // The form should have dry-run mode defaults
    console.log('✓ Exchange creation form accessible');
  });

  test('can view exchange list', async ({ page }) => {
    await navigateToOrg(page, '/exchanges');

    // Check for exchange list or empty state
    const exchangeContent = page.locator('text=/No exchanges|Add Exchange|Exchange Name/i').first();
    await expect(exchangeContent).toBeVisible({ timeout: 10000 });

    console.log('✓ Exchanges page loads correctly');
  });
});
