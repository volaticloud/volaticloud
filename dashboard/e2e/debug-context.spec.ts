import { test } from '@playwright/test';
import { signIn } from './auth';

test('test full login flow', async ({ browser }) => {
  const baseURL = process.env.E2E_BASE_URL || 'https://console.volaticloud.loc';
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    baseURL,
  });
  const page = await context.newPage();

  console.log('Starting sign in...');
  await signIn(page);
  console.log('Sign in completed, URL:', page.url());

  // Check for auth token
  const token = await page.evaluate(() => {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('oidc.user:')) {
        try {
          const val = JSON.parse(sessionStorage.getItem(key) || '{}');
          if (val.access_token) return val.access_token.substring(0, 50) + '...';
        } catch { /* ignore */ }
      }
    }
    return 'NONE';
  });
  console.log('Auth token:', token);

  await context.close();
});
