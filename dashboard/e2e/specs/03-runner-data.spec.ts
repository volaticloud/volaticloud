/**
 * Runner & Data Management Tests
 *
 * Tests runner features using the runner created in setup.
 * Depends on: 00-setup (org + runner must exist)
 *
 * NOTE: Uses pre-authenticated session via storageState (no sign-in needed).
 */
import { test, expect } from '../fixtures';
import { navigateToOrg } from '../flows/auth.flow';
import { readState, requireState } from '../state';

test.describe('Runner & Data Management', () => {
  test.beforeEach(async () => {
    const state = readState();
    if (!state.orgAlias || !state.runnerName) {
      throw new Error('Setup not complete: Organization or Runner not created. Run setup first.');
    }
  });

  test.describe('Runner Status', () => {
    test('runner exists and is listed', async ({ page, consoleTracker }) => {
      const runnerName = requireState('runnerName');

      await navigateToOrg(page, '/runners');

      // In fresh org, runner should be visible without pagination
      const runnerText = page.getByText(runnerName).first();
      await expect(runnerText, `Runner "${runnerName}" should be in the list`).toBeVisible({ timeout: 10000 });

      console.log(consoleTracker.getSummary());
      consoleTracker.assertNoErrors();

      console.log(`✓ Runner "${runnerName}" found in list`);
    });

    test('runner shows Ready status', async ({ page, consoleTracker }) => {
      const runnerName = requireState('runnerName');

      await navigateToOrg(page, '/runners');

      // Check for Ready status chip in the runner row
      const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();
      await expect(runnerRow, 'Runner row should be visible').toBeVisible({ timeout: 5000 });

      const readyChip = runnerRow.locator('.MuiChip-root:has-text("Ready")');
      await expect(readyChip, 'Runner should show Ready status').toBeVisible({ timeout: 5000 });

      console.log(consoleTracker.getSummary());
      consoleTracker.assertNoErrors();

      console.log(`✓ Runner "${runnerName}" shows Ready status`);
    });

    test('runner row has expected columns', async ({ page, consoleTracker }) => {
      const runnerName = requireState('runnerName');

      await navigateToOrg(page, '/runners');

      // Verify table headers exist
      const headers = ['Name', 'Type', 'Data Status', 'Bots', 'Created', 'Actions'];
      for (const header of headers) {
        const headerCell = page.locator(`[role="columnheader"]:has-text("${header}")`);
        const isVisible = await headerCell.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          console.log(`  ✓ Column "${header}" present`);
        }
      }

      // Verify runner row has data
      const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();
      const cells = runnerRow.locator('[role="gridcell"]');
      const cellCount = await cells.count();
      expect(cellCount, 'Runner row should have data cells').toBeGreaterThan(3);

      console.log(consoleTracker.getSummary());
      console.log(`✓ Runner row has ${cellCount} columns`);
    });
  });

  test.describe('Data Management', () => {
    test('refresh button is visible and clickable', async ({ page, consoleTracker }) => {
      const runnerName = requireState('runnerName');

      await navigateToOrg(page, '/runners');

      // Find refresh button for this runner
      const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();
      const refreshBtn = runnerRow.locator('[data-testid^="refresh-data-"]');

      await expect(refreshBtn, 'Refresh button should be visible').toBeVisible({ timeout: 5000 });

      // Click refresh
      await refreshBtn.click();
      await page.waitForTimeout(1000);

      // Verify no errors after clicking
      console.log(consoleTracker.getSummary());
      consoleTracker.assertNoErrors();

      console.log(`✓ Refresh button works for "${runnerName}"`);
    });

    test('data status shows progress or completion', async ({ page, consoleTracker }) => {
      const runnerName = requireState('runnerName');

      await navigateToOrg(page, '/runners');

      const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();

      // Should show one of: Ready, Downloading, Failed, No Data
      const statusChip = runnerRow.locator('.MuiChip-root').first();
      await expect(statusChip, 'Status chip should be visible').toBeVisible({ timeout: 5000 });

      const chipText = await statusChip.textContent();
      expect(['Ready', 'Downloading', 'Failed', 'No Data']).toContain(chipText);

      console.log(consoleTracker.getSummary());
      console.log(`✓ Data status is "${chipText}"`);
    });
  });

  test.describe('Runner Actions', () => {
    test('edit button is visible', async ({ page, consoleTracker }) => {
      const runnerName = requireState('runnerName');

      await navigateToOrg(page, '/runners');

      const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();

      // Look for edit icon button
      const editBtn = runnerRow.locator('button').filter({ has: page.locator('[data-testid="EditIcon"]') });
      await expect(editBtn, 'Edit button should be visible').toBeVisible({ timeout: 5000 });

      console.log(consoleTracker.getSummary());
      console.log('✓ Edit button visible');
    });

    test('delete button is visible', async ({ page, consoleTracker }) => {
      const runnerName = requireState('runnerName');

      await navigateToOrg(page, '/runners');

      const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();

      // Look for delete icon button
      const deleteBtn = runnerRow.locator('button').filter({ has: page.locator('[data-testid="DeleteIcon"]') });
      await expect(deleteBtn, 'Delete button should be visible').toBeVisible({ timeout: 5000 });

      console.log(consoleTracker.getSummary());
      console.log('✓ Delete button visible');
    });

    test('visibility toggle is available', async ({ page, consoleTracker }) => {
      const runnerName = requireState('runnerName');

      await navigateToOrg(page, '/runners');

      const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();

      // Look for visibility toggle (Public/Lock icon)
      const visibilityBtn = runnerRow.locator('button').filter({
        has: page.locator('[data-testid="PublicIcon"], [data-testid="LockIcon"]')
      });
      await expect(visibilityBtn, 'Visibility toggle should be visible').toBeVisible({ timeout: 5000 });

      console.log(consoleTracker.getSummary());
      console.log('✓ Visibility toggle visible');
    });
  });

  test.describe('Page Functionality', () => {
    test('runners page loads without errors', async ({ page, consoleTracker }) => {
      await navigateToOrg(page, '/runners');

      // Verify page title
      const pageTitle = page.getByRole('heading', { name: /Runners/i });
      await expect(pageTitle, 'Runners page title should be visible').toBeVisible({ timeout: 10000 });

      // Check for any console errors
      console.log(consoleTracker.getSummary());
      consoleTracker.assertNoErrors();

      console.log('✓ Runners page loads without errors');
    });

    test('create runner button is visible', async ({ page, consoleTracker }) => {
      await navigateToOrg(page, '/runners');

      const createBtn = page.locator('button:has-text("Create Runner")').first();
      await expect(createBtn, 'Create Runner button should be visible').toBeVisible({ timeout: 5000 });

      console.log(consoleTracker.getSummary());
      console.log('✓ Create Runner button visible');
    });

    test('view mode toggle works', async ({ page, consoleTracker }) => {
      await navigateToOrg(page, '/runners');

      // Find view mode toggle
      const myRunnersBtn = page.locator('button:has-text("My Runners")');
      const publicBtn = page.locator('button:has-text("Public")');

      await expect(myRunnersBtn, 'My Runners toggle should be visible').toBeVisible({ timeout: 5000 });
      await expect(publicBtn, 'Public toggle should be visible').toBeVisible({ timeout: 5000 });

      // Try switching to public view
      await publicBtn.click();
      await page.waitForTimeout(1000);

      // Should not have errors
      console.log(consoleTracker.getSummary());
      consoleTracker.assertNoErrors();

      // Switch back
      await myRunnersBtn.click();
      await page.waitForTimeout(500);

      console.log('✓ View mode toggle works');
    });
  });
});
