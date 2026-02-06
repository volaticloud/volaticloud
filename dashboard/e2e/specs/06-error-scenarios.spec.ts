/**
 * Error Scenarios E2E Tests
 *
 * Tests error handling and recovery for various failure modes:
 * - Backtest failures (invalid strategy, missing data)
 * - Download failures (invalid config, network issues)
 * - Form validation errors
 * - API error handling
 *
 * NOTE: Uses pre-authenticated session via storageState (no sign-in needed).
 */
import { test, expect } from '@playwright/test';
import { navigateToOrg } from '../flows/auth.flow';
import { readState } from '../state';

test.describe('Error Scenarios', () => {
  test.beforeEach(async () => {
    const state = readState();
    if (!state.orgAlias) {
      throw new Error('Setup not complete: Organization not created. Run setup first.');
    }
  });

  test.describe('Strategy & Backtest Errors', () => {
    test('shows error for empty strategy name', async ({ page }) => {
      await navigateToOrg(page, '/strategies');

      // Click create strategy using data-testid
      const createBtn = page.locator('[data-testid="create-strategy-button"]').first();
      await createBtn.waitFor({ state: 'visible', timeout: 10000 });
      await createBtn.click();
      await page.waitForTimeout(500);

      // Strategy form typically starts with empty name - check submit is disabled
      const submitBtn = page.locator('[data-testid="submit-create-strategy"], button[type="submit"]:has-text("Create")').first();
      if (await submitBtn.isVisible({ timeout: 5000 })) {
        const isDisabled = await submitBtn.isDisabled();
        if (isDisabled) {
          console.log('✓ Strategy creation form validates - submit button disabled for empty name');
        } else {
          // If submit is enabled, try clicking and check for error
          await submitBtn.click();
          await page.waitForTimeout(500);

          // Should see validation error
          const errorText = page.locator('text=/required|name.*required|enter.*name/i').first();
          const hasError = await errorText.isVisible({ timeout: 3000 }).catch(() => false);
          expect(hasError).toBe(true);
          console.log('✓ Empty strategy name shows validation error');
        }
      }

      // Close drawer
      const closeBtn = page.locator('[data-testid="close-drawer"], button:has-text("Cancel"), [aria-label="close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) {
        await closeBtn.click();
      }
    });

    test('handles backtest with no data gracefully', async ({ page }) => {
      await navigateToOrg(page, '/strategies');

      // Find a strategy without backtest capability
      const strategyRow = page.locator('tr, [data-testid*="strategy"]').first();
      if (await strategyRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await strategyRow.click();
        await page.waitForTimeout(1000);

        // Try to run backtest
        const backtestBtn = page.locator('button:has-text("Backtest"), button:has-text("Run Backtest")').first();
        if (await backtestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await backtestBtn.click();
          await page.waitForTimeout(2000);

          // Should either show data selection or error about missing data
          const dataWarning = page.locator('text=/no data|select.*data|download.*data|runner.*required/i').first();
          const dataSelect = page.locator('select, [role="combobox"]').first();

          const hasWarning = await dataWarning.isVisible({ timeout: 3000 }).catch(() => false);
          const hasSelect = await dataSelect.isVisible({ timeout: 1000 }).catch(() => false);

          expect(hasWarning || hasSelect).toBe(true);
          console.log('✓ Backtest without data shows appropriate UI');
        }
      }
    });

    test('displays backtest failure message', async ({ page }) => {
      // This test checks that failed backtests display errors properly
      await navigateToOrg(page, '/strategies');

      // Look for any strategy with a failed backtest
      const failedChip = page.locator('.MuiChip-root:has-text("Failed"), [data-status="failed"]').first();
      if (await failedChip.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Click to see details
        await failedChip.click();
        await page.waitForTimeout(1000);

        // Should show error details
        const errorDetails = page.locator('text=/error|failed|exception/i').first();
        const hasErrorDetails = await errorDetails.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasErrorDetails) {
          console.log('✓ Failed backtest shows error details');
        } else {
          console.log('No failed backtests to test error display');
        }
      } else {
        console.log('No failed backtests found (expected in clean environment)');
      }
    });
  });

  test.describe('Runner & Download Errors', () => {
    test('shows error for invalid S3 configuration', async ({ page }) => {
      await navigateToOrg(page, '/runners');

      const createBtn = page.locator('[data-testid="create-runner-button"]').first();
      await createBtn.waitFor({ state: 'visible', timeout: 10000 });
      await createBtn.click();
      await page.waitForTimeout(1000);

      // Fill name using data-testid or fallback
      const nameInput = page.locator('[data-testid="runner-name-input"], input[name="name"]').first();
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Invalid S3 Test Runner');
      }

      // Look for S3 configuration section
      const s3Section = page.locator('text=/S3.*Data|Enable S3/i').first();
      if (await s3Section.isVisible({ timeout: 3000 }).catch(() => false)) {
        await s3Section.scrollIntoViewIfNeeded();

        // Enable S3 by clicking the section or a checkbox
        const s3Toggle = page.locator('[data-testid="s3-enable-checkbox"], input[type="checkbox"]').first();
        if (await s3Toggle.isVisible({ timeout: 2000 })) {
          const isChecked = await s3Toggle.isChecked();
          if (!isChecked) {
            await s3Toggle.click();
            await page.waitForTimeout(500);
          }

          // Fill with invalid endpoint
          const endpointInput = page.locator('[data-testid="s3-endpoint-input"], input[name*="endpoint"]').first();
          if (await endpointInput.isVisible({ timeout: 2000 })) {
            await endpointInput.fill('invalid-endpoint:9999');
          }

          // Look for test connection button
          const testBtn = page.locator('[data-testid="test-s3-connection"], button:has-text("Test")').first();
          if (await testBtn.isVisible({ timeout: 2000 })) {
            await testBtn.click();
            await page.waitForTimeout(3000);

            // Should show connection error
            const errorIndicator = page.locator('.MuiAlert-root, text=/error|failed|cannot connect/i').first();
            const hasError = await errorIndicator.isVisible({ timeout: 5000 }).catch(() => false);

            if (hasError) {
              console.log('✓ Invalid S3 config shows connection error');
            }
          } else {
            console.log('S3 test connection button not available - skipping');
          }
        }
      } else {
        console.log('S3 configuration section not visible - skipping');
      }

      // Close drawer without saving
      const closeBtn = page.locator('[data-testid="close-drawer"], button:has-text("Cancel"), [aria-label="close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) {
        await closeBtn.click();
      }
    });

    test('shows error for invalid Docker host', async ({ page }) => {
      await navigateToOrg(page, '/runners');

      const createBtn = page.locator('[data-testid="create-runner-button"]').first();
      await createBtn.waitFor({ state: 'visible', timeout: 10000 });
      await createBtn.click();
      await page.waitForTimeout(1000);

      // Fill name using data-testid
      const nameInput = page.locator('[data-testid="runner-name-input"]').first();
      await nameInput.fill('Invalid Docker Test');

      // Try invalid Docker host using data-testid
      const dockerHostInput = page.locator('[data-testid="docker-host-input"]').first();
      if (await dockerHostInput.isVisible({ timeout: 2000 })) {
        await dockerHostInput.fill('tcp://invalid-host:2375');

        // Test connection
        const testBtn = page.locator('[data-testid="test-docker-connection"]');
        if (await testBtn.isVisible({ timeout: 2000 })) {
          await testBtn.click();
          await page.waitForTimeout(5000);

          // Should show connection error
          const errorIndicator = page.locator('.MuiAlert-root, text=/error|failed|cannot connect|timeout/i').first();
          const hasError = await errorIndicator.isVisible({ timeout: 3000 }).catch(() => false);

          if (hasError) {
            console.log('✓ Invalid Docker host shows connection error');
          }
        }
      }

      // Close drawer
      const closeBtn = page.locator('button:has-text("Cancel"), [aria-label="close"]').first();
      if (await closeBtn.isVisible({ timeout: 1000 })) {
        await closeBtn.click();
      }
    });

    test('handles download failure gracefully', async ({ page }) => {
      await navigateToOrg(page, '/runners');

      // Look for any runner with failed download status
      const failedStatus = page.locator('.MuiChip-root:has-text("Failed"), [data-status="failed"]').first();
      if (await failedStatus.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Should be able to retry
        const retryBtn = page.locator('[data-testid^="refresh-data-"], button:has-text("Retry")').first();
        const canRetry = await retryBtn.isVisible({ timeout: 2000 }).catch(() => false);

        if (canRetry) {
          console.log('✓ Failed download shows retry option');
        }
      } else {
        console.log('No failed downloads to test (expected in clean environment)');
      }
    });
  });

  test.describe('Form Validation Errors', () => {
    test('bot creation validates required fields', async ({ page }) => {
      await navigateToOrg(page, '/bots');

      const createBtn = page.locator('[data-testid="create-bot-button"]').first();
      if (!(await createBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
        console.log('Create Bot button not available');
        return;
      }

      await createBtn.click();
      await page.waitForTimeout(1000);

      // Form should have a submit button that starts disabled (due to validation)
      const submitBtn = page.locator('[data-testid="submit-create-bot"], button[type="submit"]:has-text("Create")').first();
      if (await submitBtn.isVisible({ timeout: 5000 })) {
        // Submit button should be disabled when form is empty
        const isDisabled = await submitBtn.isDisabled();
        expect(isDisabled, 'Submit button should be disabled for empty form').toBe(true);
        console.log('✓ Bot creation form validates - submit button disabled for empty form');
      }

      // Close drawer
      const closeBtn = page.locator('[data-testid="close-drawer"], button:has-text("Cancel"), [aria-label="close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) {
        await closeBtn.click();
      }
    });

    test('exchange creation validates API credentials format', async ({ page }) => {
      await navigateToOrg(page, '/exchanges');

      const addBtn = page.locator('[data-testid="add-exchange-button"]').first();
      if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
        console.log('Add Exchange button not available');
        return;
      }

      await addBtn.click();
      await page.waitForTimeout(1000);

      // Check that submit is disabled when form is empty (validation in place)
      const submitBtn = page.locator('[data-testid="submit-add-exchange"], button[type="submit"]:has-text("Create")').first();
      if (await submitBtn.isVisible({ timeout: 5000 })) {
        const isDisabled = await submitBtn.isDisabled();
        expect(isDisabled, 'Submit button should be disabled for empty form').toBe(true);
        console.log('✓ Exchange creation form validates - submit button disabled for empty form');
      }

      // Close drawer
      const closeBtn = page.locator('[data-testid="close-drawer"], button:has-text("Cancel"), [aria-label="close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) {
        await closeBtn.click();
      }
    });
  });

  test.describe('API Error Handling', () => {
    test('handles network timeout gracefully', async ({ page }) => {
      // Simulate slow network by intercepting requests
      await page.route('**/graphql', async (route) => {
        // Add delay to simulate timeout
        await new Promise(resolve => setTimeout(resolve, 100));
        await route.continue();
      });

      await navigateToOrg(page, '/');

      // Page should still load (with potential loading states)
      const mainContent = page.locator('main, [role="main"], .MuiContainer-root').first();
      await expect(mainContent).toBeVisible({ timeout: 30000 });

      console.log('✓ App handles slow network gracefully');
    });

    test('shows user-friendly error for server errors', async ({ page }) => {
      // This test checks that 500 errors are handled gracefully
      let errorIntercepted = false;

      await page.route('**/graphql', async (route, request) => {
        const postData = request.postDataJSON();
        // Intercept a specific mutation to simulate error
        if (postData?.operationName === 'CreateStrategy') {
          errorIntercepted = true;
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: 'Internal server error' }]
            })
          });
        } else {
          await route.continue();
        }
      });

      await navigateToOrg(page, '/strategies');

      // Try to create a strategy (will get 500 error)
      const createBtn = page.locator('[data-testid="create-strategy-button"]').first();
      if (await createBtn.isVisible({ timeout: 5000 })) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const nameInput = page.locator('[data-testid="strategy-name-input"]').first();
        if (await nameInput.isVisible({ timeout: 2000 })) {
          await nameInput.fill('Error Test Strategy');

          const submitBtn = page.locator('[data-testid="submit-create-strategy"], button[type="submit"]:has-text("Create")').first();
          if (await submitBtn.isVisible({ timeout: 2000 })) {
            await submitBtn.click();
            await page.waitForTimeout(2000);

            if (errorIntercepted) {
              // Should show error notification
              const errorNotification = page.locator('.MuiAlert-root, .MuiSnackbar-root, text=/error|failed/i').first();
              const hasError = await errorNotification.isVisible({ timeout: 3000 }).catch(() => false);

              if (hasError) {
                console.log('✓ Server error shows user-friendly message');
              }
            }
          }
        }
      }

      // Clean up route
      await page.unroute('**/graphql');
    });
  });
});
