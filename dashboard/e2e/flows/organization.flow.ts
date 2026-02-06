/**
 * Organization & Billing Flow Helpers
 */
import { Page, expect } from '@playwright/test';
import { waitForPageReady, navigateInOrg } from './auth.flow';

export async function createOrganization(page: Page, orgName: string): Promise<void> {
  console.log(`Creating organization: ${orgName}`);

  await page.goto('/');
  await waitForPageReady(page);

  // Find create org button - either in NoOrganizationView or org switcher
  const noOrgCreateBtn = page.locator('button:has-text("Create Organization")').first();
  const newOrgBtn = page.locator('button:has-text("New")').first();

  if (await noOrgCreateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await noOrgCreateBtn.click();
  } else if (await newOrgBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await newOrgBtn.click();
  } else {
    // Try org switcher dropdown
    const orgSwitcher = page.locator('#organization-select, [role="combobox"]').first();
    if (await orgSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await orgSwitcher.click();
      await page.waitForTimeout(500);
      const createOption = page.locator('[role="option"]:has-text("Create New Organization")').first();
      await createOption.click();
    }
  }

  await page.waitForTimeout(1000);

  // Fill organization title using data-testid
  const titleInput = page.locator('[data-testid="organization-title-input"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 5000 });
  await titleInput.fill(orgName);

  // Submit using testid with proper waiting
  const submitBtn = page.locator('[data-testid="submit-create-organization"]');
  await submitBtn.scrollIntoViewIfNeeded();
  await expect(submitBtn).toBeEnabled({ timeout: 10000 });
  await submitBtn.click();

  // Wait for redirect (signinRedirect is instant due to existing SSO)
  await page.waitForTimeout(5000);
  await waitForPageReady(page);

  console.log(`Organization created: ${orgName}`);
}

export async function subscribeWithStripe(page: Page): Promise<void> {
  console.log('Subscribing via Stripe...');

  await navigateInOrg(page, '/organization/billing');
  await page.waitForTimeout(3000); // Wait for plans to load

  // Check if already subscribed
  const currentPlanBtn = page.locator('button:has-text("Current Plan")');
  if (await currentPlanBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Already subscribed, skipping');
    return;
  }

  // Find and click subscribe button
  const subscribeBtn = page.locator('button:has-text("Subscribe")').first();
  await subscribeBtn.waitFor({ state: 'visible', timeout: 10000 });
  await subscribeBtn.click();

  // Wait for Stripe Checkout
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
  console.log('Redirected to Stripe Checkout');

  // Fill card details
  await page.waitForLoadState('domcontentloaded');
  const cardField = page.locator('[placeholder="1234 1234 1234 1234"]');

  // Check if card field is directly visible, or if we need to select Card payment method first
  const isCardFieldVisible = await cardField.isVisible({ timeout: 3000 }).catch(() => false);
  if (!isCardFieldVisible) {
    // Stripe shows payment method selector - click to expand card fields
    // Use JavaScript click to bypass viewport restrictions
    const clicked = await page.evaluate(() => {
      // Try testid first (local dev with VPN)
      let btn = document.querySelector('[data-testid="card-accordion-item-button"]') as HTMLElement;
      if (btn) {
        btn.click();
        return 'testid';
      }
      // Try aria-label
      btn = document.querySelector('button[aria-label="Pay with card"]') as HTMLElement;
      if (btn) {
        btn.click();
        return 'aria-label';
      }
      // Try by text content
      const buttons = Array.from(document.querySelectorAll('button'));
      btn = buttons.find(b => b.textContent?.includes('Pay with card')) as HTMLElement;
      if (btn) {
        btn.click();
        return 'text';
      }
      // Last resort: click Card radio
      const radio = document.querySelector('input[type="radio"][value="card"]') as HTMLElement;
      if (radio) {
        radio.click();
        return 'radio';
      }
      return null;
    });

    if (clicked) {
      console.log(`Clicked card payment via: ${clicked}`);
    } else {
      console.log('Warning: Could not find card payment selector');
    }

    // Wait for accordion animation
    await page.waitForTimeout(1000);
  }

  await cardField.waitFor({ state: 'visible', timeout: 30000 });

  await cardField.fill('4242424242424242');

  const expiryField = page.locator('[placeholder="MM / YY"]');
  await expiryField.click();
  await page.keyboard.type('1230');

  await page.locator('[placeholder="CVC"]').fill('123');
  await page.locator('[placeholder="Full name on card"]').fill('E2E Test User');

  // Fill ZIP code if required (US)
  const zipField = page.locator('[placeholder="ZIP"]');
  if (await zipField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zipField.fill('10001');
    console.log('Filled ZIP code');
  }

  // Uncheck "Save my information for faster checkout" if checked
  const saveInfoCheckbox = page.getByRole('checkbox', { name: /save my information/i });
  if (await saveInfoCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
    const isChecked = await saveInfoCheckbox.isChecked();
    if (isChecked) {
      await saveInfoCheckbox.uncheck();
      console.log('Unchecked save info checkbox');
    }
  }

  // Submit payment
  await page.locator('button[type="submit"]').first().click();

  // Wait for redirect back
  await page.waitForURL(/.*volaticloud.*/, { timeout: 60000 });
  await page.waitForTimeout(5000); // Wait for webhook processing

  console.log('Subscription complete');
}

export async function verifyCredits(page: Page): Promise<void> {
  // Navigate with org context (assumes already signed in)
  await navigateInOrg(page, '/organization/billing');

  // Verify credit balance is shown - displayed as "$X.XX" in h3 element
  // The balance card has h6 "Credit Balance" and h3 with the dollar amount
  // Use the heading role to be specific
  const balanceLabel = page.getByRole('heading', { name: 'Credit Balance' });
  await expect(balanceLabel).toBeVisible({ timeout: 10000 });

  // Also verify the dollar amount is displayed (h3 with $ prefix)
  const balanceAmount = page.locator('h3:has-text("$")').first();
  await expect(balanceAmount).toBeVisible({ timeout: 5000 });

  console.log('Credits verified');
}
