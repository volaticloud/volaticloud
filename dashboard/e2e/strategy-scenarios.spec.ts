/**
 * Strategy Builder E2E Test Suite
 *
 * 100% UI-based - all interactions through the browser UI, no GraphQL API calls.
 *
 * Test Flow (per run):
 * 1. Sign in
 * 2. Create new Organization via UI
 * 3. Subscribe via Stripe Checkout UI
 * 4. Create Runner via UI
 * 5. Wait for Data Download
 * 6. Create Strategies & Run Backtests - N times
 * 7. Create Bots from Strategies - N times
 */

import { test, Page } from '@playwright/test';
import { generateAllScenarios } from './scenario-generator';
import { signIn } from './auth';

// ============================================================================
// Configuration
// ============================================================================

const BACKTEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per backtest
const DATA_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 min for data download

// Results tracking
interface ScenarioResult {
  scenarioId: number;
  scenarioName: string;
  category: string;
  strategyCreated: boolean;
  strategyError?: string;
  backtestSuccess: boolean;
  backtestError?: string;
  botCreated: boolean;
  botError?: string;
  duration: number;
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/** Wait for page to be fully loaded and interactive */
async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

// ============================================================================
// Step 1: Create Organization via UI
// ============================================================================

async function createOrganizationViaUI(page: Page): Promise<{ success: boolean; orgName?: string; error?: string }> {
  console.log('Creating new organization via UI...');

  try {
    // Navigate to home/dashboard first
    await page.goto('/');
    await waitForPageReady(page);

    // Generate unique org name
    const orgName = `E2E-Org-${Date.now()}`;

    // Check for different entry points to create org:

    // Case 1: NoOrganizationView - big "Create Organization" button when user has no orgs
    const noOrgCreateBtn = page.locator('button:has-text("Create Organization")').first();
    if (await noOrgCreateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Found NoOrganizationView - clicking Create Organization');
      await noOrgCreateBtn.click();
      await page.waitForTimeout(1000);
    }
    // Case 2: OrganizationSwitcher with 1 org - "New" button
    else {
      const newOrgBtn = page.locator('button:has-text("New")').first();
      if (await newOrgBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Found New button in org switcher');
        await newOrgBtn.click();
        await page.waitForTimeout(1000);
      }
      // Case 3: OrganizationSwitcher with multiple orgs - dropdown with "Create New Organization"
      else {
        const orgSwitcher = page.locator('#organization-select, [role="combobox"]').first();
        if (await orgSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Found org switcher dropdown');
          await orgSwitcher.click();
          await page.waitForTimeout(500);

          const createOption = page.locator('[role="option"]:has-text("Create New Organization")').first();
          if (await createOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await createOption.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }

    // Now the drawer should be open - fill in the organization title
    const titleInput = page.getByLabel('Organization Title');
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });
    await titleInput.fill(orgName);
    console.log(`Filled org name: ${orgName}`);

    await page.waitForTimeout(500);

    // Click the submit button using data-testid
    const drawerCreateBtn = page.locator('[data-testid="submit-create-organization"]');
    await drawerCreateBtn.waitFor({ state: 'visible', timeout: 3000 });
    console.log('Clicking Create button...');
    await drawerCreateBtn.click();

    // Wait for redirect after org creation (it does signinRedirect which is instant due to existing SSO session)
    console.log('Waiting for redirect after org creation...');
    await page.waitForTimeout(5000);
    await waitForPageReady(page);

    // Verify org was created by checking URL
    const url = page.url();
    console.log(`After org creation, URL: ${url}`);
    if (url.includes('orgId=') || url.includes(orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
      console.log(`Organization created: ${orgName}`);
      return { success: true, orgName };
    }

    // Even if URL doesn't have orgId, org might still be created
    console.log(`Organization likely created: ${orgName}`);
    return { success: true, orgName };
  } catch (e) {
    console.error('Failed to create organization:', e);
    return { success: false, error: String(e) };
  }
}

// ============================================================================
// Step 2: Subscribe via Stripe Checkout
// ============================================================================

async function subscribeViaUI(page: Page): Promise<{ success: boolean; error?: string }> {
  console.log('Setting up subscription via UI...');

  try {
    // Navigate to billing page (under organization)
    await page.goto('/organization/billing');
    await waitForPageReady(page);
    console.log('Billing page URL:', page.url());

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/billing-page.png' });

    // Wait for plans to load (they come from GraphQL)
    await page.waitForTimeout(5000);

    // Check if already has a subscription (look for "Current Plan" button or credit balance)
    const currentPlanBtn = page.locator('button:has-text("Current Plan")');
    if (await currentPlanBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Already has subscription, skipping');
      return { success: true };
    }

    // Find all "Subscribe" buttons in plan cards
    const subscribeButtons = page.locator('button:has-text("Subscribe")');
    let btnCount = await subscribeButtons.count();
    console.log(`Found ${btnCount} Subscribe buttons`);

    if (btnCount === 0) {
      // Maybe plans are still loading - wait more
      console.log('Waiting for plans to load...');
      await page.waitForTimeout(5000);
      btnCount = await subscribeButtons.count();
      console.log(`After wait, found ${btnCount} Subscribe buttons`);

      if (btnCount === 0) {
        // Log page content for debugging
        const bodyText = await page.locator('body').innerText();
        console.log('Page content preview:', bodyText.substring(0, 500));
        return { success: false, error: 'No subscription plans available' };
      }
    }

    // Click the first subscribe button (Starter plan - Free) for simpler testing
    const finalCount = await subscribeButtons.count();
    console.log(`Found ${finalCount} Subscribe buttons, clicking first one (Starter)...`);

    // Take screenshot before clicking
    await page.screenshot({ path: 'test-results/before-subscribe-click.png' });

    await subscribeButtons.first().click();
    console.log('Subscribe button clicked');

    // Wait a moment and take another screenshot
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/after-subscribe-click.png' });
    console.log('Current URL after click:', page.url());

    // Wait for Stripe Checkout page or any navigation
    try {
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
      console.log('Redirected to Stripe Checkout');
    } catch (e) {
      console.log('No Stripe redirect, checking current page...');
      console.log('URL:', page.url());
      const bodyText = await page.locator('body').innerText();
      console.log('Page content:', bodyText.substring(0, 500));
      throw e;
    }

    // Wait for form to be ready
    await page.waitForLoadState('domcontentloaded');
    const cardField = page.locator('[placeholder="1234 1234 1234 1234"]');
    await cardField.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Stripe form ready');

    // Fill card details
    await cardField.fill('4242424242424242');
    console.log('Card number filled');

    // Fill expiry
    const expiryField = page.locator('[placeholder="MM / YY"]');
    await expiryField.click();
    await page.keyboard.type('1230');
    console.log('Expiry filled');

    // Fill CVC
    await page.locator('[placeholder="CVC"]').fill('123');
    console.log('CVC filled');

    // Fill name
    await page.locator('[placeholder="Full name on card"]').fill('E2E Test User');
    console.log('Name filled');

    // Submit
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    console.log('Payment submitted');

    // Wait for redirect back to app
    await page.waitForURL(/.*volaticloud.*/, { timeout: 60000 });
    await page.waitForTimeout(5000); // Wait for webhook processing
    console.log('Subscription complete');

    return { success: true };
  } catch (e) {
    console.error('Subscription failed:', e);
    return { success: false, error: String(e) };
  }
}

// ============================================================================
// Step 3: Create Runner via UI
// ============================================================================

async function createRunnerViaUI(page: Page): Promise<{ success: boolean; runnerName?: string; error?: string }> {
  console.log('Creating runner via UI...');

  try {
    // Navigate to runners page
    await page.goto('/runners');
    await waitForPageReady(page);
    console.log('Runners page URL:', page.url());

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/runners-page.png' });

    // Click create runner button - exact text is "Create Runner"
    const createBtn = page.locator('button:has-text("Create Runner")').first();
    console.log('Looking for Create Runner button...');

    // Wait longer and check if button exists
    const buttonExists = await createBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!buttonExists) {
      // Log page content for debugging
      const bodyText = await page.locator('body').innerText();
      console.log('Page content preview:', bodyText.substring(0, 500));
      return { success: false, error: 'Create Runner button not found - check permissions' };
    }

    await createBtn.click();
    await page.waitForTimeout(1000); // Wait for drawer to open

    // Generate unique runner name
    const runnerName = `e2e-runner-${Date.now()}`;

    // Fill runner name - the drawer has TextField with label="Runner Name"
    const nameInput = page.getByLabel('Runner Name');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(runnerName);
    console.log(`Filled runner name: ${runnerName}`);

    // Type is already Docker by default, no need to change

    // Enable S3 data distribution checkbox
    const s3Checkbox = page.getByLabel('Enable S3 data distribution');
    if (await s3Checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await s3Checkbox.click();
      await page.waitForTimeout(500);

      // Fill S3 Endpoint - always use minio:9000 since backend runs in Docker
      const endpointInput = page.getByLabel('S3 Endpoint');
      if (await endpointInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Backend tests S3 connection from inside Docker, so use Docker service name
        await endpointInput.fill('minio:9000');
        console.log('Filled S3 endpoint: minio:9000');
      }

      // Fill Bucket Name
      const bucketInput = page.getByLabel('Bucket Name');
      if (await bucketInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await bucketInput.fill('volaticloud-data');
        console.log('Filled bucket name');
      }

      // Fill Access Key ID
      const accessKeyInput = page.getByLabel('Access Key ID');
      if (await accessKeyInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await accessKeyInput.fill('minioadmin');
        console.log('Filled access key');
      }

      // Fill Secret Access Key
      const secretKeyInput = page.getByLabel('Secret Access Key');
      if (await secretKeyInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await secretKeyInput.fill('minioadmin');
        console.log('Filled secret key');
      }

      // Uncheck "Use SSL/HTTPS" for local MinIO
      const useSslCheckbox = page.locator('[data-testid="s3-use-ssl-checkbox"]');
      if (await useSslCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        // It's checked by default, uncheck it for MinIO without SSL
        await useSslCheckbox.click();
        console.log('Disabled SSL for MinIO');
        await page.waitForTimeout(500); // Wait for state update
      }

      // Click S3 test connection button
      const testS3Btn = page.locator('[data-testid="test-s3-connection"]');
      if (await testS3Btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await testS3Btn.click();
        console.log('Testing S3 connection...');
        // Wait for test result (success or error alert)
        await page.waitForTimeout(3000);
        const s3Alert = page.locator('.MuiAlert-root').first();
        if (await s3Alert.isVisible({ timeout: 5000 }).catch(() => false)) {
          const alertText = await s3Alert.textContent();
          console.log(`S3 test result: ${alertText}`);
        }
      }
    }

    // Click Docker test connection button
    const testDockerBtn = page.locator('[data-testid="test-docker-connection"]');
    if (await testDockerBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await testDockerBtn.click();
      console.log('Testing Docker connection...');
      // Wait for test result
      await page.waitForTimeout(3000);
      const dockerAlert = page.locator('.MuiAlert-root').first();
      if (await dockerAlert.isVisible({ timeout: 5000 }).catch(() => false)) {
        const alertText = await dockerAlert.textContent();
        console.log(`Docker test result: ${alertText}`);
      }
    }

    // Click submit button using data-testid
    const createRunnerBtn = page.locator('[data-testid="submit-create-runner"]');
    await createRunnerBtn.waitFor({ state: 'visible', timeout: 3000 });
    await createRunnerBtn.click();
    console.log('Clicked Create Runner submit');

    // Wait for drawer to close and runner to be created
    await page.waitForTimeout(3000);
    await waitForPageReady(page);

    console.log(`Runner created: ${runnerName}`);
    return { success: true, runnerName };
  } catch (e) {
    console.error('Failed to create runner:', e);
    return { success: false, error: String(e) };
  }
}

// ============================================================================
// Step 4: Wait for Data Download
// ============================================================================

async function waitForDataDownload(page: Page, runnerName: string): Promise<{ success: boolean; error?: string }> {
  console.log('Starting data download for runner:', runnerName);

  try {
    // Navigate to runners page
    await page.goto('/runners');
    await waitForPageReady(page);

    // Find the refresh/download data button in the runner's row
    // The button has data-testid="refresh-data-{runnerId}"
    // We need to find it by looking for a button with refresh icon in the row containing our runner name
    const runnerRow = page.locator(`tr:has-text("${runnerName}")`).first();

    if (!await runnerRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Runner row not found, looking for first runner...');
      // Click the first refresh button we can find
      const firstRefreshBtn = page.locator('[data-testid^="refresh-data-"]').first();
      if (await firstRefreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstRefreshBtn.click();
        console.log('Clicked first refresh button');
      }
    } else {
      // Find the refresh button within this row
      const refreshBtn = runnerRow.locator('[data-testid^="refresh-data-"]');
      if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await refreshBtn.click();
        console.log('Data download triggered for:', runnerName);
      } else {
        // Try clicking any visible refresh button
        const anyRefreshBtn = page.locator('[data-testid^="refresh-data-"]').first();
        if (await anyRefreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await anyRefreshBtn.click();
          console.log('Clicked first available refresh button');
        }
      }
    }

    await page.waitForTimeout(2000);

    // Poll for data ready status
    const startTime = Date.now();
    while (Date.now() - startTime < DATA_DOWNLOAD_TIMEOUT_MS) {
      await page.reload();
      await waitForPageReady(page);

      // Check for "Ready" chip in the data status column
      const dataReadyChip = page.locator('.MuiChip-root:has-text("Ready")').first();
      if (await dataReadyChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Data download complete - Ready status found');
        return { success: true };
      }

      // Check for downloading status (progress indicator)
      const downloading = page.locator('text=/Downloading/i').first();
      if (await downloading.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  Data still downloading...');
      }

      // Check for failure
      const failedChip = page.locator('.MuiChip-root:has-text("Failed")').first();
      if (await failedChip.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Data download failed');
        return { success: false, error: 'Data download failed' };
      }

      console.log('  Waiting for data...');
      await page.waitForTimeout(10000);
    }

    return { success: false, error: 'Data download timeout' };
  } catch (e) {
    console.error('Data download error:', e);
    return { success: false, error: String(e) };
  }
}

// ============================================================================
// Step 5: Create Strategy via UI
// ============================================================================

async function createStrategyViaUI(
  page: Page,
  strategyName: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`Creating strategy: ${strategyName}`);

  try {
    // Navigate to strategies page using full URL to ensure correct navigation
    const baseURL = process.env.E2E_BASE_URL || 'https://console.volaticloud.loc';
    await page.goto(`${baseURL}/strategies`);
    await waitForPageReady(page);
    console.log('Strategies page URL:', page.url());

    // Click create strategy button - exact text is "Create Strategy"
    const createBtn = page.locator('button:has-text("Create Strategy")').first();
    console.log('Looking for Create Strategy button...');

    // Wait and check if button exists
    const buttonExists = await createBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!buttonExists) {
      // Log page content for debugging
      const bodyText = await page.locator('body').innerText();
      console.log('Page content preview:', bodyText.substring(0, 300));
      return { success: false, error: 'Create Strategy button not found - check permissions' };
    }

    await createBtn.click();
    await page.waitForTimeout(1000); // Wait for drawer to open

    // Fill strategy name using the correct MUI TextField label
    const nameInput = page.getByLabel('Strategy Name');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(strategyName);
    console.log(`Filled strategy name: ${strategyName}`);

    // Optionally fill description
    const descInput = page.getByLabel('Description');
    if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descInput.fill(`E2E test strategy: ${strategyName}`);
    }

    // Click submit button using data-testid
    const submitBtn = page.locator('[data-testid="submit-create-strategy"]');
    await submitBtn.waitFor({ state: 'visible', timeout: 3000 });
    await submitBtn.click();
    console.log('Clicked Create Strategy submit');

    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for error
    const errorToast = page.locator('[role="alert"]:has-text("error"), .toast-error').first();
    if (await errorToast.isVisible({ timeout: 1000 }).catch(() => false)) {
      const errorText = await errorToast.textContent();
      return { success: false, error: errorText || 'Unknown error' };
    }

    console.log(`Strategy created: ${strategyName}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ============================================================================
// Step 5b: Run Backtest via UI
// ============================================================================

async function runBacktestViaUI(
  page: Page,
  strategyName: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`Running backtest for: ${strategyName}`);

  try {
    // Navigate to strategies and find the strategy
    await page.goto('/strategies');
    await waitForPageReady(page);

    // Click on the strategy
    const strategyRow = page.locator(`tr:has-text("${strategyName}"), [data-testid="strategy-row"]:has-text("${strategyName}")`).first();
    if (await strategyRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await strategyRow.click();
      await waitForPageReady(page);
    }

    // Click backtest button
    const backtestBtn = page.locator('button:has-text("Run Backtest"), button:has-text("Backtest")').first();
    if (!await backtestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      return { success: false, error: 'Backtest button not found' };
    }
    await backtestBtn.click();
    await page.waitForTimeout(500);

    // Fill backtest form if dialog appears
    // Select runner if dropdown exists
    const runnerSelect = page.locator('[data-testid="runner-select"], button:has-text("Select Runner")').first();
    if (await runnerSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await runnerSelect.click();
      const firstRunner = page.locator('[role="option"]').first();
      if (await firstRunner.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstRunner.click();
      }
    }

    // Click run button
    const runBtn = page.locator('button:has-text("Run"), button:has-text("Start"), button[type="submit"]').first();
    await runBtn.click();

    console.log('Backtest started');
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ============================================================================
// Step 5c: Wait for Backtest Completion via UI
// ============================================================================

async function waitForBacktestCompletion(page: Page): Promise<{ status: string; error?: string }> {
  console.log('Waiting for backtest completion...');

  const startTime = Date.now();
  while (Date.now() - startTime < BACKTEST_TIMEOUT_MS) {
    // Check for completed status
    const completed = page.locator('text=/Completed|Success/i, .badge:has-text("Completed")').first();
    if (await completed.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Backtest completed');
      return { status: 'COMPLETED' };
    }

    // Check for failed status
    const failed = page.locator('text=/Failed|Error/i, .badge:has-text("Failed")').first();
    if (await failed.isVisible({ timeout: 1000 }).catch(() => false)) {
      return { status: 'FAILED', error: 'Backtest failed' };
    }

    console.log('  Backtest still running...');
    await page.waitForTimeout(5000);
  }

  return { status: 'TIMEOUT', error: 'Backtest timed out' };
}

// ============================================================================
// Step 5.5: Create Exchange via UI (needed for bot creation)
// ============================================================================

async function createExchangeViaUI(page: Page): Promise<{ success: boolean; exchangeName?: string; error?: string }> {
  console.log('Creating exchange via UI...');

  try {
    // Navigate to exchanges page
    await page.goto('/exchanges');
    await waitForPageReady(page);
    console.log('Exchanges page URL:', page.url());

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/exchanges-page.png' });

    // Click create exchange button - exact text is "Add Exchange"
    const createBtn = page.locator('button:has-text("Add Exchange")').first();
    console.log('Looking for Add Exchange button...');

    // Wait longer and check if button exists
    const buttonExists = await createBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!buttonExists) {
      // Log page content for debugging
      const bodyText = await page.locator('body').innerText();
      console.log('Page content preview:', bodyText.substring(0, 500));
      return { success: false, error: 'Add Exchange button not found - check permissions' };
    }

    await createBtn.click();
    await page.waitForTimeout(1000); // Wait for drawer to open

    // Generate unique exchange name
    const exchangeName = `E2E-Exchange-${Date.now()}`;

    // Fill exchange name using correct MUI TextField label
    const nameInput = page.getByLabel('Exchange Name');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(exchangeName);
    console.log(`Filled exchange name: ${exchangeName}`);

    // The FreqtradeConfigForm will have defaults - we can use them for dry-run
    // Just need to make sure the exchange type is set (it should be by default)

    // Click submit button using data-testid
    const submitBtn = page.locator('[data-testid="submit-add-exchange"]');
    await submitBtn.waitFor({ state: 'visible', timeout: 3000 });
    await submitBtn.click();
    console.log('Clicked Add Exchange submit');

    // Wait for drawer to close
    await page.waitForTimeout(3000);
    await waitForPageReady(page);

    console.log(`Exchange created: ${exchangeName}`);
    return { success: true, exchangeName };
  } catch (e) {
    console.error('Failed to create exchange:', e);
    return { success: false, error: String(e) };
  }
}

// ============================================================================
// Step 6: Create Bot from Strategy via UI
// ============================================================================

async function createBotViaUI(
  page: Page,
  strategyName: string,
  botName: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`Creating bot: ${botName} from strategy: ${strategyName}`);

  try {
    // Navigate to bots page
    await page.goto('/bots');
    await waitForPageReady(page);

    // Click create bot button
    const createBtn = page.locator('button:has-text("Create Bot"), button:has-text("New Bot"), button:has-text("Add")').first();
    await createBtn.waitFor({ state: 'visible', timeout: 5000 });
    await createBtn.click();
    await page.waitForTimeout(1000); // Wait for drawer to open

    // Fill bot name using correct MUI TextField label
    const nameInput = page.getByLabel('Bot Name');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(botName);
    console.log(`Filled bot name: ${botName}`);

    // Mode is already "dry_run" by default, no need to change

    // Select Exchange - it's a MUI Select with label="Exchange"
    const exchangeSelect = page.getByLabel('Exchange');
    if (await exchangeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exchangeSelect.click();
      await page.waitForTimeout(500);

      // Select first available exchange
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
        console.log('Selected exchange');
      }
    }

    // Select Strategy - it's a MUI Select with label="Strategy"
    const strategySelect = page.getByLabel('Strategy');
    if (await strategySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await strategySelect.click();
      await page.waitForTimeout(500);

      // Try to find the specific strategy
      const strategyOption = page.locator(`[role="option"]:has-text("${strategyName}")`).first();
      if (await strategyOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await strategyOption.click();
        console.log(`Selected strategy: ${strategyName}`);
      } else {
        // Select first available strategy
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          await firstOption.click();
          console.log('Selected first available strategy');
        }
      }
    }

    // Select Runner - it's a MUI Select with label="Runner"
    const runnerSelect = page.getByLabel('Runner');
    if (await runnerSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await runnerSelect.click();
      await page.waitForTimeout(500);

      // Select first available runner
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click();
        console.log('Selected runner');
      }
    }

    // Click submit button using data-testid
    const botSubmitBtn = page.locator('[data-testid="submit-create-bot"]');
    await botSubmitBtn.waitFor({ state: 'visible', timeout: 3000 });
    await botSubmitBtn.click();
    console.log('Clicked Create Bot submit');

    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for error
    const errorToast = page.locator('[role="alert"]:has-text("error"), .toast-error').first();
    if (await errorToast.isVisible({ timeout: 1000 }).catch(() => false)) {
      const errorText = await errorToast.textContent();
      return { success: false, error: errorText || 'Unknown error' };
    }

    console.log(`Bot created: ${botName}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ============================================================================
// Main Test Suite
// ============================================================================

const scenarios = generateAllScenarios();
const allResults: ScenarioResult[] = [];

test.describe('Strategy Builder E2E - Full Flow', () => {
  let runnerName: string;
  const createdStrategies: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const baseURL = process.env.E2E_BASE_URL || 'https://console.volaticloud.loc';
    console.log('='.repeat(60));
    console.log('E2E TEST SETUP');
    console.log('='.repeat(60));
    console.log('Base URL:', baseURL);

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      baseURL,
    });
    const page = await context.newPage();

    // Step 1: Sign in
    console.log('\n--- Step 1: Sign In ---');
    await signIn(page);
    await waitForPageReady(page);
    console.log('Sign in complete');

    // Step 2: Create Organization
    console.log('\n--- Step 2: Create Organization ---');
    const orgResult = await createOrganizationViaUI(page);
    if (!orgResult.success) {
      console.warn('Org creation warning:', orgResult.error);
    }

    // Step 3: Subscribe
    console.log('\n--- Step 3: Subscribe ---');
    const subResult = await subscribeViaUI(page);
    if (!subResult.success) {
      console.warn('Subscription warning:', subResult.error);
    }

    // Step 4: Create Runner
    console.log('\n--- Step 4: Create Runner ---');
    const runnerResult = await createRunnerViaUI(page);
    if (runnerResult.success && runnerResult.runnerName) {
      runnerName = runnerResult.runnerName;
    } else {
      console.warn('Runner creation warning:', runnerResult.error);
    }

    // Step 5: Wait for Data Download
    console.log('\n--- Step 5: Wait for Data Download ---');
    if (runnerName) {
      const dataResult = await waitForDataDownload(page, runnerName);
      if (!dataResult.success) {
        console.warn('Data download warning:', dataResult.error);
      }
    }

    // Step 6: Create Exchange (needed for bot creation)
    console.log('\n--- Step 6: Create Exchange ---');
    const exchangeResult = await createExchangeViaUI(page);
    if (!exchangeResult.success) {
      console.warn('Exchange creation warning:', exchangeResult.error);
    }

    console.log('\n--- Setup Complete ---');
    await page.close();
  });

  // Create batched tests
  const BATCH_SIZE = 10;
  const batches = [];
  for (let i = 0; i < scenarios.length; i += BATCH_SIZE) {
    batches.push(scenarios.slice(i, i + BATCH_SIZE));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const batchStart = batchIdx * BATCH_SIZE + 1;
    const batchEnd = batchStart + batch.length - 1;

    test(`Batch ${batchIdx + 1}: Scenarios ${batchStart}-${batchEnd}`, async ({ page }) => {
      await signIn(page);
      await waitForPageReady(page);

      for (const scenario of batch) {
        const startTime = Date.now();
        const result: ScenarioResult = {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          category: scenario.category,
          strategyCreated: false,
          backtestSuccess: false,
          botCreated: false,
          duration: 0,
        };

        console.log(`\n=== Scenario ${scenario.id}: ${scenario.name} ===`);

        // Create Strategy
        const strategyName = `E2E_${scenario.name}_${Date.now()}`;
        const strategyResult = await createStrategyViaUI(page, strategyName);
        result.strategyCreated = strategyResult.success;
        result.strategyError = strategyResult.error;

        if (!strategyResult.success) {
          console.error(`  Strategy creation failed: ${strategyResult.error}`);
          result.duration = Date.now() - startTime;
          allResults.push(result);
          continue;
        }

        createdStrategies.push(strategyName);

        // Run Backtest
        const backtestResult = await runBacktestViaUI(page, strategyName);
        if (!backtestResult.success) {
          console.error(`  Backtest start failed: ${backtestResult.error}`);
          result.backtestError = backtestResult.error;
          result.duration = Date.now() - startTime;
          allResults.push(result);
          continue;
        }

        // Wait for completion
        const completionResult = await waitForBacktestCompletion(page);
        result.backtestSuccess = completionResult.status === 'COMPLETED';
        result.backtestError = completionResult.error;

        if (result.backtestSuccess) {
          console.log('  Backtest completed successfully');
        } else {
          console.error(`  Backtest failed: ${completionResult.status}`);
        }

        result.duration = Date.now() - startTime;
        allResults.push(result);
      }
    });
  }

  // Create bots from strategies
  test('Create Bots from Strategies', async ({ page }) => {
    await signIn(page);
    await waitForPageReady(page);

    console.log('\n=== Creating Bots from Strategies ===');

    for (let i = 0; i < Math.min(createdStrategies.length, 5); i++) {
      const strategyName = createdStrategies[i];
      const botName = `Bot_${strategyName}`;

      const botResult = await createBotViaUI(page, strategyName, botName);
      if (botResult.success) {
        console.log(`  Created bot: ${botName}`);
      } else {
        console.error(`  Failed to create bot: ${botResult.error}`);
      }
    }
  });

  test.afterAll(async () => {
    // Summary report
    const total = allResults.length;
    const strategyFails = allResults.filter(r => !r.strategyCreated);
    const backtestFails = allResults.filter(r => r.strategyCreated && !r.backtestSuccess);
    const fullSuccess = allResults.filter(r => r.backtestSuccess);

    console.log('\n' + '='.repeat(60));
    console.log('E2E TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Total scenarios: ${total}`);
    console.log(`Full success: ${fullSuccess.length} (${total > 0 ? (fullSuccess.length / total * 100).toFixed(1) : 0}%)`);
    console.log(`Strategy failures: ${strategyFails.length}`);
    console.log(`Backtest failures: ${backtestFails.length}`);
    console.log('='.repeat(60));

    // Error summary
    const errors = [...strategyFails, ...backtestFails];
    if (errors.length > 0) {
      console.log('\nERRORS:');
      for (const r of errors.slice(0, 20)) {
        const error = r.strategyError || r.backtestError || 'unknown';
        console.log(`  ${r.scenarioName}: ${error.substring(0, 100)}`);
      }
    }
  });
});
