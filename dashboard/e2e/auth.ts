/**
 * Authentication helper for E2E tests.
 * In containerized mode (E2E_BASE_URL set), uses direct password grant to avoid
 * crypto.subtle issues with HTTP origins. Otherwise, uses browser-based Keycloak login.
 */
import { Page } from '@playwright/test';

const KEYCLOAK_USERNAME = process.env.E2E_USERNAME || 'test@test.com';
const KEYCLOAK_PASSWORD = process.env.E2E_PASSWORD || 'Test123!';
// OIDC authority URL (used in sessionStorage key - must match what the dashboard uses)
const KEYCLOAK_URL = process.env.E2E_KEYCLOAK_URL || 'https://auth.volaticloud.loc';
// Internal URL for server-side token requests (bypasses TLS issues with self-signed certs)
const KEYCLOAK_INTERNAL_URL = process.env.E2E_KEYCLOAK_INTERNAL_URL || 'http://keycloak:8080';
const KEYCLOAK_REALM = 'volaticloud';
const KEYCLOAK_CLIENT_ID = 'dashboard';

/**
 * Time to wait for OIDC redirects to complete after navigation.
 * This prevents race conditions where page.evaluate() is called while
 * the page is still redirecting through the OIDC flow.
 * See PR #179 for details on the navigation race condition.
 */
export const OIDC_SETTLE_TIME_MS = 500;

/**
 * Sign in using direct password grant (Resource Owner Password Credentials).
 * Gets a token from Keycloak server-side, then injects it into the browser's sessionStorage.
 */
export async function signInDirectGrant(page: Page): Promise<void> {
  const tokenUrl = `${KEYCLOAK_INTERNAL_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

  // Get token via password grant from within the Playwright Node.js process
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: KEYCLOAK_CLIENT_ID,
      username: KEYCLOAK_USERNAME,
      password: KEYCLOAK_PASSWORD,
      scope: 'openid profile email',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Password grant failed (${response.status}): ${body}`);
  }

  const tokenData = await response.json();

  // Navigate to dashboard first to set the correct origin for sessionStorage
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Inject the OIDC user into sessionStorage in the format expected by oidc-client-ts
  const authority = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
  const storageKey = `oidc.user:${authority}:${KEYCLOAK_CLIENT_ID}`;

  const oidcUser = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type || 'Bearer',
    scope: tokenData.scope || 'openid profile email',
    profile: tokenData.id_token ? JSON.parse(atob(tokenData.id_token.split('.')[1])) : {},
    expires_at: Math.floor(Date.now() / 1000) + (tokenData.expires_in || 300),
    id_token: tokenData.id_token,
    refresh_token: tokenData.refresh_token,
    session_state: tokenData.session_state,
  };

  await page.evaluate(
    ({ key, value }) => {
      sessionStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: oidcUser }
  );

  // Reload to pick up the injected session
  await page.reload();
  await page.waitForLoadState('networkidle');

  console.log('Sign-in complete (direct grant)');
}

/**
 * Sign in via browser-based Keycloak login (for local dev).
 */
async function signInBrowser(page: Page): Promise<void> {
  // Only navigate if on blank page - otherwise we're already on a page
  // (possibly Keycloak login after OIDC redirect)
  if (page.url() === 'about:blank') {
    console.log('signInBrowser: Navigating to /');
    const response = await page.goto('/');
    console.log('signInBrowser: goto completed, status:', response?.status(), 'url:', page.url());
  } else {
    console.log('signInBrowser: Already on page:', page.url());
  }

  // Wait for the page to fully stabilize - either login form or dashboard
  // Use 'load' instead of 'domcontentloaded' to ensure all resources are loaded
  await page.waitForLoadState('load');
  // Allow OIDC redirect to complete before checking sessionStorage
  await page.waitForTimeout(OIDC_SETTLE_TIME_MS);
  console.log('signInBrowser: page loaded, url:', page.url());

  // Check if we ended up on an error page
  const currentUrl = page.url();
  if (currentUrl.startsWith('chrome-error://') || currentUrl.startsWith('about:')) {
    throw new Error(`Navigation failed - ended up on error page: ${currentUrl}`);
  }

  // Check if already authenticated
  const isAlreadyLoggedIn = await page.evaluate(() => {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes('oidc')) {
        try {
          const val = JSON.parse(sessionStorage.getItem(key) || '{}');
          if (val.access_token) return true;
        } catch { /* ignore */ }
      }
    }
    return false;
  });

  if (isAlreadyLoggedIn) {
    console.log('Already authenticated');
    return;
  }

  // Wait for Keycloak login page (step 1: username)
  console.log('signInBrowser: waiting for login form...');
  try {
    await page.waitForSelector('#username, input[name="username"]', { timeout: 30_000 });
  } catch {
    const url = page.url();
    console.log('signInBrowser: timeout waiting for login form, url:', url);
    // Check for error page
    if (url.startsWith('chrome-error://') || url.startsWith('about:')) {
      throw new Error(`Login page navigation failed: ${url}`);
    }
    if (!url.includes('/auth/') && !url.includes('/realms/')) {
      console.log('Already authenticated (redirected back to dashboard)');
      return;
    }
    throw new Error(`Could not find Keycloak login form (username step) at: ${url}`);
  }

  // Fill username
  await page.locator('#username, input[name="username"]').first().fill(KEYCLOAK_USERNAME);

  // Check if password field is already visible (single-page login)
  const passwordVisible = await page.locator('#password, input[name="password"]').first().isVisible().catch(() => false);

  if (passwordVisible) {
    // Single-page: fill password and submit
    await page.locator('#password, input[name="password"]').first().fill(KEYCLOAK_PASSWORD);
    await page.locator('#kc-login, input[type="submit"], button[type="submit"]').first().click();
  } else {
    // Two-step: submit username first, then wait for password page
    console.log('Submitting username...');
    await page.locator('#kc-login, input[type="submit"], button[type="submit"]').first().click();
    await page.waitForTimeout(2000);
    console.log('After username submit, URL:', page.url());
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || 'NO BODY');
    console.log('Body:', bodyText);
    console.log('Waiting for password field...');
    await page.waitForSelector('#password, input[name="password"]', { timeout: 15_000 });
    console.log('Password field found, filling...');
    await page.locator('#password, input[name="password"]').first().fill(KEYCLOAK_PASSWORD);
    console.log('Clicking login button...');
    await page.locator('#kc-login, input[type="submit"], button[type="submit"]').first().click();
    console.log('Login button clicked');
  }

  // Wait for redirect back to dashboard (not Keycloak)
  // The URL should be console.volaticloud.loc (not auth.volaticloud.loc)
  console.log('Waiting for redirect back to dashboard...');
  await page.waitForFunction(
    () => {
      const url = window.location.href;
      // Check we're on console domain, not auth/keycloak domain
      return (url.includes('console.volaticloud.loc') || url.includes('localhost:5173'))
        && !url.includes('/realms/')
        && !url.includes('/login-actions/');
    },
    { timeout: 30_000 }
  );
  await page.waitForLoadState('networkidle');
  console.log('Redirect complete, URL:', page.url());

  // Wait for OIDC token exchange to complete (token should be in sessionStorage)
  console.log('Waiting for auth token in sessionStorage...');
  await page.waitForFunction(
    () => {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('oidc.user:')) {
          try {
            const val = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (val.access_token) return true;
          } catch { /* ignore */ }
        }
      }
      return false;
    },
    { timeout: 15_000 }
  );

  console.log('Sign-in complete (browser)');
}

export async function signIn(page: Page): Promise<void> {
  // Both containerized (HTTPS via Caddy) and local dev use browser-based login.
  // Direct grant is available as fallback but browser login works since we serve over HTTPS.
  await signInBrowser(page);
}