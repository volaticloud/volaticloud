/**
 * Organization & Billing Flow Helpers
 */
import { Page, expect, request } from '@playwright/test';
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

/**
 * Subscribe via Stripe API directly, bypassing Checkout UI.
 *
 * Stripe's Checkout page has anti-automation measures that prevent E2E testing
 * (see https://docs.stripe.com/automated-testing). Instead, we:
 * 1. Get org's Stripe customer ID and price ID from our API
 * 2. Attach test payment method and create subscription via Stripe API
 * 3. Refresh page to see active subscription
 */
export async function subscribeWithStripe(page: Page): Promise<void> {
  console.log('Subscribing via Stripe API (bypassing Checkout UI)...');

  const stripeApiKey = process.env.VOLATICLOUD_STRIPE_API_KEY;
  if (!stripeApiKey) {
    throw new Error('VOLATICLOUD_STRIPE_API_KEY environment variable is required');
  }

  await navigateInOrg(page, '/organization/billing');
  await page.waitForTimeout(3000); // Wait for plans to load

  // Check if already subscribed
  const currentPlanBtn = page.locator('button:has-text("Current Plan")');
  if (await currentPlanBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Already subscribed, skipping');
    return;
  }

  // Get orgId from URL
  const url = new URL(page.url());
  const orgId = url.searchParams.get('orgId');
  if (!orgId) {
    throw new Error('Could not get orgId from URL');
  }
  console.log('Organization ID:', orgId);

  // Get available plans to find price ID (public query, no auth needed)
  const apiContext = await request.newContext({
    baseURL: 'https://api.stripe.com',
    extraHTTPHeaders: {
      'Authorization': `Bearer ${stripeApiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  // Get prices from Stripe directly
  const pricesResponse = await apiContext.get('/v1/prices?active=true&type=recurring&limit=10');
  if (!pricesResponse.ok()) {
    throw new Error(`Failed to get prices: ${await pricesResponse.text()}`);
  }
  const pricesData = await pricesResponse.json();
  const starterPrice = pricesData.data?.find((p: { nickname?: string; unit_amount: number }) =>
    p.nickname?.toLowerCase().includes('starter') || p.unit_amount === 0
  ) || pricesData.data?.[0];

  if (!starterPrice?.id) {
    throw new Error('Could not find starter plan price ID');
  }
  const priceId = starterPrice.id;
  console.log('Price ID:', priceId);

  try {
    // Search for customer by org ID in metadata
    const searchResponse = await apiContext.get(`/v1/customers/search?query=metadata["owner_id"]:"${orgId}"`);
    if (!searchResponse.ok()) {
      throw new Error(`Failed to search customers: ${await searchResponse.text()}`);
    }
    const searchResult = await searchResponse.json();

    let customerId: string;
    if (searchResult.data?.length > 0) {
      customerId = searchResult.data[0].id;
      console.log('Found existing customer:', customerId);
    } else {
      // Create customer if not exists
      const createResponse = await apiContext.post('/v1/customers', {
        form: {
          'metadata[owner_id]': orgId,
          email: 'test@test.com',
        },
      });
      if (!createResponse.ok()) {
        throw new Error(`Failed to create customer: ${await createResponse.text()}`);
      }
      const customer = await createResponse.json();
      customerId = customer.id;
      console.log('Created customer:', customerId);
    }

    // Attach test payment method (pm_card_visa) to customer
    const attachResponse = await apiContext.post('/v1/payment_methods/pm_card_visa/attach', {
      form: { customer: customerId },
    });
    if (!attachResponse.ok()) {
      const error = await attachResponse.text();
      if (!error.includes('already been attached')) {
        throw new Error(`Failed to attach payment method: ${error}`);
      }
    }
    console.log('Payment method attached');

    // Set as default payment method
    await apiContext.post(`/v1/customers/${customerId}`, {
      form: { 'invoice_settings[default_payment_method]': 'pm_card_visa' },
    });
    console.log('Default payment method set');

    // Create subscription directly
    const subResponse = await apiContext.post('/v1/subscriptions', {
      form: {
        customer: customerId,
        'items[0][price]': priceId,
        'expand[0]': 'latest_invoice.payment_intent',
      },
    });
    if (!subResponse.ok()) {
      throw new Error(`Failed to create subscription: ${await subResponse.text()}`);
    }
    const subscription = await subResponse.json();
    console.log('Subscription created:', subscription.id, 'Status:', subscription.status);

    // The customer.subscription.created webhook will be triggered by Stripe
    // and handled by our backend to save the subscription record

  } finally {
    await apiContext.dispose();
  }

  // Wait for webhook to be processed, then refresh
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForTimeout(2000);

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
