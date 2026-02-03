import { test } from '@playwright/test';

test('debug auth flow', async ({ page }) => {
  // Capture console logs
  page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));
  page.on('requestfailed', req => console.log(`REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`));

  console.log('Navigating to dashboard...');
  await page.goto('/');

  console.log(`Current URL after goto: ${page.url()}`);

  // Wait for either Keycloak form or dashboard content
  const result = await Promise.race([
    page.waitForSelector('#username, input[name="username"]', { timeout: 30_000 }).then(() => 'keycloak'),
    page.waitForTimeout(30_000).then(() => 'timeout'),
  ]);

  console.log(`Result: ${result}`);
  console.log(`URL after wait: ${page.url()}`);

  if (result === 'keycloak') {
    console.log('Found Keycloak login form, filling in...');
    await page.locator('#username, input[name="username"]').first().fill('test@test.com');
    await page.locator('#kc-login, input[type="submit"], button[type="submit"]').first().click();

    await page.waitForSelector('#password, input[name="password"]', { timeout: 15_000 });
    await page.locator('#password, input[name="password"]').first().fill('Test123!');
    await page.locator('#kc-login, input[type="submit"], button[type="submit"]').first().click();

    console.log('Submitted credentials, waiting for redirect...');
    await page.waitForTimeout(10_000);
    console.log(`URL after login: ${page.url()}`);

    // Check sessionStorage
    const token = await page.evaluate(() => {
      const entries: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        entries.push(`${key}: ${sessionStorage.getItem(key!)?.substring(0, 100)}`);
      }
      return entries.join('\n');
    });
    console.log(`Session storage:\n${token}`);
  } else {
    console.log('Timeout - taking screenshot');
    // Check for errors
    const html = await page.content();
    console.log(`Page HTML (first 500 chars): ${html.substring(0, 500)}`);
  }
});
