/**
 * Authentication Flow Helpers
 *
 * With global setup, tests start pre-authenticated via storageState.
 * These helpers handle navigation with org context.
 */
import { Page } from '@playwright/test';
import { signIn } from '../auth';
import { getOrgUrl } from '../state';

export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
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
