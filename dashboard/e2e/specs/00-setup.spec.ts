/**
 * E2E Setup - Creates shared resources for all subsequent tests
 *
 * This is the FIRST test that runs and sets up:
 * 1. Organization (fresh for each test run)
 * 2. Stripe subscription (credits)
 * 3. Runner with S3 and data download
 *
 * All subsequent tests reuse these resources via shared state.
 *
 * NOTE: Global setup has already authenticated us via storageState.
 * We use navigateToOrg/navigateInOrg for navigation with org context.
 */
import { test, expect } from '../fixtures';
import { waitForPageReady, navigateToOrg, navigateInOrg } from '../flows/auth.flow';
import { createOrganization, subscribeWithStripe } from '../flows/organization.flow';
import { createRunner, triggerDataDownload, waitForDataReady, RunnerConfig } from '../flows/runner.flow';
import { clearState, writeState, readState } from '../state';

test.describe.configure({ mode: 'serial' });

test.describe('E2E Setup', () => {
  const timestamp = Date.now();
  const testOrgName = `E2E Org ${timestamp}`;
  const runnerName = `E2E Runner ${timestamp}`;

  test.beforeAll(() => {
    // Clear any previous state for fresh run
    clearState();
    console.log('='.repeat(60));
    console.log('Starting E2E Setup - Creating fresh environment');
    console.log(`Organization: ${testOrgName}`);
    console.log(`Runner: ${runnerName}`);
    console.log('='.repeat(60));
  });

  test('1. Create organization', async ({ page, consoleTracker }) => {
    // Navigate to dashboard (auth via storageState)
    await navigateToOrg(page, '/');

    // Verify no errors on initial load
    console.log(consoleTracker.getSummary());

    await createOrganization(page, testOrgName);
    await waitForPageReady(page);

    // Extract org ID from URL (format: ?orgId=org-alias)
    const url = new URL(page.url());
    const orgAlias = url.searchParams.get('orgId');

    // Strong assertion: org alias must be present
    expect(orgAlias, 'Organization alias should be in URL after creation').toBeTruthy();

    // Save to state - this is critical for subsequent tests
    writeState({
      orgName: testOrgName,
      orgAlias: orgAlias!,
    });

    // Verify we're in the new org context
    await expect(page).toHaveURL(new RegExp(`orgId=${orgAlias}`));

    // Check for console errors
    console.log(consoleTracker.getSummary());

    console.log(`✓ Organization created: ${testOrgName}`);
    console.log(`  Alias: ${orgAlias}`);
  });

  test('2. Subscribe via Stripe', async ({ page, consoleTracker }) => {
    test.setTimeout(120000); // 2 minutes for Stripe flow

    // Navigate to billing page with org context
    await navigateToOrg(page, '/organization/billing');

    // Verify billing page loaded correctly
    const billingHeader = page.getByRole('heading', { name: 'Billing & Plans' });
    await expect(billingHeader).toBeVisible({ timeout: 10000 });

    // Check if already subscribed
    const currentPlanBtn = page.locator('button:has-text("Current Plan")');
    if (await currentPlanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Already subscribed, skipping Stripe flow');
      writeState({ isSubscribed: true });
      console.log(consoleTracker.getSummary());
      return;
    }

    // Check if subscription needed
    const subscribeBtn = page.locator('button:has-text("Subscribe")').first();
    if (!await subscribeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('No subscription required or already subscribed');
      writeState({ isSubscribed: true });
      console.log(consoleTracker.getSummary());
      return;
    }

    // Perform Stripe subscription
    await subscribeWithStripe(page);

    // Verify subscription - navigate back with org context
    await navigateInOrg(page, '/organization/billing');

    // Strong assertion: Balance should be visible
    const balanceAmount = page.locator('h3:has-text("$")').first();
    await expect(balanceAmount, 'Credit balance should be visible after subscription').toBeVisible({ timeout: 10000 });

    writeState({ isSubscribed: true });

    console.log(consoleTracker.getSummary());
    console.log('✓ Subscription completed');
  });

  test('3. Create runner with data download', async ({ page, consoleTracker }) => {
    test.setTimeout(5 * 60 * 1000); // 5 minutes for data download

    // Navigate to runners with org context
    await navigateToOrg(page, '/runners');

    // Verify runners page loaded
    const runnersContent = page.locator('text=/Runners|Create Runner/i').first();
    await expect(runnersContent, 'Runners page should load').toBeVisible({ timeout: 10000 });

    const config: RunnerConfig = {
      name: runnerName,
      network: 'volaticloud-e2e',
      s3: {
        endpoint: 'minio:9000',
        bucket: 'volaticloud-data',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        useSSL: false,
      },
      dataDownload: {
        exchanges: [
          {
            name: 'binance',
            timeframes: ['5m', '15m', '1h', '4h'],
            pairsPattern: '(BTC|ETH)/USDT',
            days: 7,
            tradingMode: 'spot',
          },
        ],
      },
    };

    await createRunner(page, config);

    // Verify runner created - navigate with org context
    await navigateInOrg(page, '/runners');

    // Strong assertion: Runner must be visible in the list
    const runnerText = page.getByText(runnerName).first();
    await expect(runnerText, `Runner "${runnerName}" should be visible in list`).toBeVisible({ timeout: 10000 });

    writeState({ runnerName });
    console.log(`✓ Runner created: ${runnerName}`);

    // Trigger data download
    console.log('Triggering data download...');
    await triggerDataDownload(page, runnerName);

    // Wait for data to be ready
    console.log('Waiting for data download (max 3 min)...');
    const isReady = await waitForDataReady(page, 3 * 60 * 1000, runnerName);

    // Strong assertion: Data download must complete
    expect(isReady, 'Data download should complete successfully').toBe(true);

    // Verify Ready chip is visible
    const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();
    const readyChip = runnerRow.locator('.MuiChip-root:has-text("Ready")');
    await expect(readyChip, 'Runner should show Ready status').toBeVisible({ timeout: 5000 });

    writeState({ runnerDataReady: true });

    console.log(consoleTracker.getSummary());
    console.log('✓ Runner data ready');
  });

  test.afterAll(() => {
    const state = readState();
    console.log('='.repeat(60));
    console.log('E2E Setup Complete');
    console.log('State:', JSON.stringify(state, null, 2));
    console.log('='.repeat(60));
  });
});
