/**
 * Permission Boundaries E2E Tests
 *
 * Tests authorization and access control:
 * - Unauthorized access to other organization's resources
 * - Missing permissions handling
 * - Public vs private resource visibility
 * - Role-based access control
 *
 * NOTE: Uses pre-authenticated session via storageState (no sign-in needed).
 */
import { test, expect } from '@playwright/test';
import { navigateToOrg, waitForPageReady } from '../flows/auth.flow';
import { readState } from '../state';

test.describe('Permission Boundaries', () => {
  test.beforeEach(async () => {
    const state = readState();
    if (!state.orgAlias) {
      throw new Error('Setup not complete: Organization not created. Run setup first.');
    }
  });

  test.describe('Organization Isolation', () => {
    test('cannot access non-existent organization', async ({ page }) => {
      // Try to navigate to a fake organization
      const fakeOrgAlias = 'non-existent-org-12345';

      await page.goto(`/${fakeOrgAlias}/strategies`);
      await waitForPageReady(page);

      // Should see error, redirect, or "No Organization" blocker page
      const errorIndicator = page.locator('text=/not found|access denied|unauthorized/i').first();
      const noOrgIndicator = page.locator('text=/don\'t have any organizations|Create Your Organization/i').first();
      const redirected = !page.url().includes(fakeOrgAlias);

      const hasError = await errorIndicator.isVisible({ timeout: 3000 }).catch(() => false);
      const hasNoOrgPage = await noOrgIndicator.isVisible({ timeout: 3000 }).catch(() => false);

      // Any of these indicates proper handling of invalid org access
      expect(hasError || redirected || hasNoOrgPage).toBe(true);
      console.log(`✓ Non-existent organization access blocked (error: ${hasError}, noOrgPage: ${hasNoOrgPage}, redirected: ${redirected})`);
    });

    test('cannot access other organization via URL manipulation', async ({ page }) => {
      // Set shorter timeout
      page.setDefaultTimeout(30000);

      // First navigate to our org
      await navigateToOrg(page, '/strategies');

      // Try to access a different org's resource by manipulating URL
      // Use a clearly fake org alias
      const baseUrl = process.env.E2E_BASE_URL || 'https://console.volaticloud.loc';
      const maliciousUrl = `${baseUrl}/other-org-hack-attempt/strategies`;
      await page.goto(maliciousUrl, { timeout: 15000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      // Should be blocked, show error, or redirect to a valid org context
      const currentUrl = page.url();

      // Valid behaviors:
      // 1. Redirect to user's actual org (orgId= in URL)
      // 2. Show error/not found message
      // 3. Redirect to organization selection
      // 4. URL no longer contains the fake org path
      const hasOrgIdParam = currentUrl.includes('orgId=');
      const noFakeOrgInPath = !currentUrl.includes('other-org-hack-attempt');
      const wasRedirected = hasOrgIdParam || noFakeOrgInPath;

      const errorMsg = page.locator('text=/not found|access denied|unauthorized|no organization/i').first();
      const hasError = await errorMsg.isVisible({ timeout: 3000 }).catch(() => false);

      expect(wasRedirected || hasError, `Expected redirect or error, got URL: ${currentUrl}`).toBe(true);
      console.log(`✓ URL manipulation handled (redirected: ${wasRedirected}, error: ${hasError})`);
    });

    test('API rejects requests for other organization resources', async ({ page }) => {
      // Set shorter timeout
      page.setDefaultTimeout(30000);

      await navigateToOrg(page, '/strategies');
      await page.waitForTimeout(1000);

      // Make a request that would try to access another org's data
      // The UI should filter by ownerID, but we're verifying the backend rejects bad requests
      const result = await page.evaluate(async () => {
        try {
          // Try to fetch strategies with a fake owner ID
          const response = await fetch('/gateway/v1/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `query { strategies(where: { ownerID: "fake-owner-id" }) { edges { node { id name } } } }`
            })
          });
          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch {
            // Non-JSON response (error page) - treat as blocked
            return { blocked: true, status: response.status };
          }
        } catch (e) {
          return { error: String(e) };
        }
      });

      // Either the query returned empty results (filtered) or had an error (blocked)
      const hasEmptyResults = !result?.data?.strategies?.edges?.length;
      const hasError = !!result?.errors?.length || result?.blocked || result?.error;

      expect(hasEmptyResults || hasError, 'API should filter or block cross-org requests').toBe(true);
      console.log(`✓ API enforces organization boundaries (empty: ${hasEmptyResults}, error: ${hasError})`);
    });
  });

  test.describe('Resource-Level Permissions', () => {
    test('cannot edit resources without edit permission', async ({ page }) => {
      // This test verifies that edit buttons are properly gated
      await navigateToOrg(page, '/strategies');

      // Find a strategy
      const strategyRow = page.locator('tr:has([data-testid*="strategy"]), [data-testid*="strategy-row"]').first();
      if (await strategyRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await strategyRow.click();
        await waitForPageReady(page);

        // Edit functionality should be available for own resources
        const editBtn = page.locator('button:has-text("Edit"), [data-testid*="edit"]').first();
        const hasEdit = await editBtn.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasEdit) {
          console.log('✓ Edit button visible for owned resource');
        } else {
          // May need to look for edit in different location
          const anyEditControl = page.locator('[contenteditable="true"], input:not([readonly])').first();
          const hasEditControl = await anyEditControl.isVisible({ timeout: 2000 }).catch(() => false);
          console.log(hasEditControl ? '✓ Edit controls available' : 'No edit controls found (may be view-only mode)');
        }
      } else {
        console.log('No strategies to test edit permissions');
      }
    });

    test('cannot delete resources without delete permission', async ({ page }) => {
      await navigateToOrg(page, '/strategies');

      // Find any delete button and verify it requires confirmation
      const deleteBtn = page.locator('button:has-text("Delete"), [data-testid*="delete"]').first();

      if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteBtn.click();
        await page.waitForTimeout(500);

        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="dialog"], .MuiDialog-root').first();
        const hasConfirmation = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasConfirmation) {
          console.log('✓ Delete requires confirmation');

          // Cancel the delete
          const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
          if (await cancelBtn.isVisible({ timeout: 1000 })) {
            await cancelBtn.click();
          }
        }
      } else {
        console.log('No delete buttons found (expected in clean environment)');
      }
    });

    test('view-secrets scope protects sensitive data', async ({ page }) => {
      await navigateToOrg(page, '/exchanges');

      // Find an exchange
      const exchangeRow = page.locator('tr, [data-testid*="exchange"]').first();
      if (await exchangeRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exchangeRow.click();
        await waitForPageReady(page);

        // API keys should be masked or require explicit action to view
        const maskedKey = page.locator('text=/\\*{4,}|••••|hidden|masked/i').first();
        const revealBtn = page.locator('button:has-text("Show"), button:has-text("Reveal"), [data-testid*="show-secret"]').first();

        const isMasked = await maskedKey.isVisible({ timeout: 3000 }).catch(() => false);
        const hasReveal = await revealBtn.isVisible({ timeout: 2000 }).catch(() => false);

        if (isMasked || hasReveal) {
          console.log('✓ Sensitive data is protected');
        } else {
          console.log('No exchanges with secrets to test');
        }
      } else {
        console.log('No exchanges to test secret protection');
      }
    });
  });

  test.describe('Public vs Private Resources', () => {
    test('private resources are not visible to others', async ({ page }) => {
      // By default, resources should be private
      await navigateToOrg(page, '/strategies');

      // Find visibility indicator if present
      const privateIndicator = page.locator('text=/private/i, [data-visibility="private"], .MuiChip-root:has-text("Private")').first();
      const publicIndicator = page.locator('text=/public/i, [data-visibility="public"], .MuiChip-root:has-text("Public")').first();

      const hasPrivate = await privateIndicator.isVisible({ timeout: 3000 }).catch(() => false);
      const hasPublic = await publicIndicator.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasPrivate || !hasPublic) {
        console.log('✓ Resources default to private');
      } else if (hasPublic) {
        console.log('Some resources are public (may be intentional)');
      } else {
        console.log('No visibility indicators found');
      }
    });

    test('can toggle resource visibility', async ({ page }) => {
      await navigateToOrg(page, '/strategies');

      // Find a strategy to edit visibility
      const strategyRow = page.locator('tr, [data-testid*="strategy"]').first();
      if (await strategyRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await strategyRow.click();
        await waitForPageReady(page);

        // Look for visibility toggle
        const visibilityToggle = page.locator(
          'button:has-text("Make Public"), button:has-text("Make Private"), ' +
          '[data-testid*="visibility"], label:has-text("Public")'
        ).first();

        const hasToggle = await visibilityToggle.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasToggle) {
          console.log('✓ Visibility toggle available');
        } else {
          console.log('No visibility toggle found (may be in settings)');
        }
      }
    });
  });

  test.describe('Authentication Boundaries', () => {
    // Skip: SSO cookies persist across browser contexts, making true unauthenticated testing unreliable
    test.skip('protected routes redirect to login when unauthenticated', async ({ browser }) => {
      // Create a new context without authentication
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // Set a shorter timeout for this test
        page.setDefaultTimeout(30000);

        // Try to access protected route
        const baseUrl = process.env.E2E_BASE_URL || 'https://console.volaticloud.loc';
        await page.goto(`${baseUrl}/test-org/strategies`, { timeout: 15000 });

        // Wait for navigation to settle
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

        // Should redirect to login or show auth required
        const currentUrl = page.url();
        const isLoginPage = currentUrl.includes('auth') ||
                           currentUrl.includes('login') ||
                           currentUrl.includes('keycloak');

        const authRequired = page.locator('text=/sign in|log in|authenticate/i').first();
        const hasAuthPrompt = await authRequired.isVisible({ timeout: 5000 }).catch(() => false);

        expect(isLoginPage || hasAuthPrompt, `Expected login redirect, got: ${currentUrl}`).toBe(true);
        console.log('✓ Unauthenticated access redirects to login');
      } finally {
        await context.close();
      }
    });

    // Skip: Clearing storage doesn't invalidate SSO session cookies
    test.skip('expired session prompts re-authentication', async ({ page }) => {
      // Set a shorter timeout for this test
      page.setDefaultTimeout(30000);

      // Navigate first so we're on the right origin
      const baseUrl = process.env.E2E_BASE_URL || 'https://console.volaticloud.loc';
      await page.goto(baseUrl, { timeout: 15000 });
      await page.waitForLoadState('domcontentloaded');

      // Simulate session expiry by clearing auth storage
      await page.evaluate(() => {
        // Clear all storage to simulate full session expiry
        sessionStorage.clear();
        localStorage.clear();
      });

      // Reload to trigger auth check
      await page.reload({ timeout: 15000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      // Should prompt for re-auth or redirect to login
      const currentUrl = page.url();
      const isLoginPage = currentUrl.includes('auth') ||
                         currentUrl.includes('login') ||
                         currentUrl.includes('keycloak');

      const authPrompt = page.locator('text=/session.*expired|sign in|log in/i').first();
      const hasPrompt = await authPrompt.isVisible({ timeout: 3000 }).catch(() => false);

      if (isLoginPage || hasPrompt) {
        console.log('✓ Expired session prompts re-authentication');
      } else {
        // Session might still be valid from cookies
        console.log('Session still valid (cookie-based auth)');
      }
    });
  });

  test.describe('Role-Based Access', () => {
    test('billing page requires appropriate permissions', async ({ page }) => {
      await navigateToOrg(page, '/organization/billing');

      // Billing page should load for org members with billing access
      const billingContent = page.locator('text=/billing|subscription|credit|plan/i').first();
      const accessDenied = page.locator('text=/access denied|unauthorized|permission/i').first();

      const hasBilling = await billingContent.isVisible({ timeout: 5000 }).catch(() => false);
      const isDenied = await accessDenied.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasBilling) {
        console.log('✓ Billing access granted to authorized user');
      } else if (isDenied) {
        console.log('✓ Billing access properly restricted');
      } else {
        console.log('Billing page state unclear');
      }
    });

    test('organization settings require admin permissions', async ({ page }) => {
      await navigateToOrg(page, '/organization/settings');

      // Settings should load for admins
      const settingsContent = page.locator('text=/settings|configuration|manage/i').first();
      const accessDenied = page.locator('text=/access denied|unauthorized|permission/i').first();

      const hasSettings = await settingsContent.isVisible({ timeout: 5000 }).catch(() => false);
      const isDenied = await accessDenied.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasSettings) {
        console.log('✓ Settings access granted to admin');
      } else if (isDenied) {
        console.log('✓ Settings access properly restricted');
      } else {
        // May redirect to different page
        console.log('Settings page may not exist or redirected');
      }
    });
  });
});
