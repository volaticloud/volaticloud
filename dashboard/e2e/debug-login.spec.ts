import { test } from '@playwright/test';

test('debug login steps', async ({ page }) => {
  console.log('Starting test...');
  await page.goto('/');
  console.log('After goto, URL:', page.url());

  // Wait 5 seconds and check again
  await page.waitForTimeout(5000);
  console.log('After 5s wait, URL:', page.url());

  // Log page content
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || 'NO BODY');
  console.log('Body text:', bodyText);

  // Try to find username field
  const hasUsername = await page.locator('#username, input[name="username"]').count();
  console.log('Username field count:', hasUsername);
});
