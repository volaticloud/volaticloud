/**
 * Authentication Flow Helpers
 *
 * With global setup, tests start pre-authenticated via storageState.
 * These helpers handle navigation with org context.
 */
import { Page } from '@playwright/test';
import { signIn } from '../auth';
import { getOrgUrl, readState } from '../state';

export async function waitForPageReady(page: Page): Promise<void> {
  // Use 'load' instead of 'networkidle' because WebSocket subscriptions
  // keep the network active, causing 'networkidle' to never resolve
  await page.waitForLoadState('load');
  // Wait for React to finish rendering
  await page.waitForTimeout(500);
}

/**
 * Check if we're on the "No Organization" blocker page.
 * This appears when a user is authenticated but has no organizations.
 */
export async function isNoOrganizationPage(page: Page): Promise<boolean> {
  const createOrgButton = page.locator('button:has-text("Create Organization")');
  const noOrgText = page.locator('text="You don\'t have any organizations yet"');

  const [hasButton, hasText] = await Promise.all([
    createOrgButton.isVisible({ timeout: 1000 }).catch(() => false),
    noOrgText.isVisible({ timeout: 1000 }).catch(() => false),
  ]);

  return hasButton && hasText;
}

/**
 * Handle the "No Organization" blocker page by throwing an informative error.
 * Setup tests should handle this case by creating an organization first.
 */
export async function handleNoOrganizationPage(page: Page): Promise<void> {
  if (await isNoOrganizationPage(page)) {
    throw new Error(
      'Landed on "No Organization" page. Run setup (00-setup.spec.ts) first to create an organization, ' +
      'or the E2E environment may need to be reset.'
    );
  }
}

/**
 * Check if the page is already authenticated (has auth token in sessionStorage)
 */
async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const authToken = await page.evaluate(() => {
      return sessionStorage.getItem('oidc.user:https://auth.volaticloud.loc/realms/volaticloud:dashboard');
    });
    return !!authToken;
  } catch {
    return false;
  }
}

/**
 * Ensure we're authenticated, signing in only if necessary.
 * With storageState, this usually does nothing (already authenticated).
 */
async function ensureAuthenticated(page: Page): Promise<void> {
  // First, navigate to trigger cookie restoration from storageState
  if (page.url() === 'about:blank') {
    await page.goto('/');
    await waitForPageReady(page);
  }

  // Check if we landed on the "No Organization" blocker page
  if (await isNoOrganizationPage(page)) {
    // Check if state has an org - if not, setup hasn't run
    const state = readState();
    if (!state.orgAlias) {
      throw new Error(
        'No organization exists. Run setup tests first (00-setup.spec.ts) or the E2E environment needs initialization.'
      );
    }
    // State has org but we're on blocker page - session may be stale, re-authenticate
    console.log('On No Organization page but state has org - re-authenticating...');
    await signIn(page);
    await waitForPageReady(page);
    return;
  }

  // Check if already authenticated
  if (await isAuthenticated(page)) {
    return;
  }

  // Not authenticated - need to sign in
  console.log('Session not valid, re-authenticating...');
  await signIn(page);
  await waitForPageReady(page);
}

/**
 * Navigate to a path within the current org context.
 * Ensures authentication and uses org alias from state.
 *
 * This is the PRIMARY function for navigating in tests.
 * With storageState, it typically just navigates (no sign-in needed).
 */
export async function navigateToOrg(page: Page, path: string = '/'): Promise<void> {
  await ensureAuthenticated(page);

  const orgUrl = getOrgUrl(path);
  await page.goto(orgUrl);
  await waitForPageReady(page);
}

/**
 * Navigate within the current org context (assumes already on an authenticated page)
 * Faster than navigateToOrg - skips auth check.
 */
export async function navigateInOrg(page: Page, path: string): Promise<void> {
  const orgUrl = getOrgUrl(path);
  await page.goto(orgUrl);
  await waitForPageReady(page);
}

/**
 * @deprecated Use navigateToOrg instead - clearer naming
 * Sign in and navigate to a path within the current org context.
 */
export async function signInToOrg(page: Page, path: string = '/'): Promise<void> {
  await navigateToOrg(page, path);
}

/**
 * @deprecated Use navigateToOrg instead
 */
export async function signInAndNavigate(page: Page, path: string = '/'): Promise<void> {
  await navigateToOrg(page, path);
}
