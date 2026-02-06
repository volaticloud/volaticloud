/**
 * Runner & Data Download Flow Helpers
 */
import { Page, expect } from '@playwright/test';
import { waitForPageReady, navigateInOrg } from './auth.flow';

const DATA_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface DataDownloadExchangeConfig {
  name: string;  // binance, bybit, etc.
  timeframes?: string[];  // ['1h', '1d']
  pairsPattern?: string;  // '.*/USDT'
  days?: number;  // 365
  tradingMode?: 'spot' | 'futures' | 'margin';
}

export interface RunnerConfig {
  name: string;
  type?: 'docker' | 'kubernetes';
  dockerHost?: string;
  network?: string;  // Docker network for container connectivity
  s3?: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    useSSL: boolean;
  };
  dataDownload?: {
    exchanges: DataDownloadExchangeConfig[];
  };
}

export async function createRunner(page: Page, config: RunnerConfig): Promise<string> {
  console.log(`Creating runner: ${config.name}`);

  await navigateInOrg(page, '/runners');

  // Click create runner button using data-testid
  const createBtn = page.locator('[data-testid="create-runner-button"]').first();
  await createBtn.waitFor({ state: 'visible', timeout: 10000 });
  await createBtn.click();
  await page.waitForTimeout(1000);

  // Fill runner name using data-testid
  const nameInput = page.locator('[data-testid="runner-name-input"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(config.name);
  console.log(`Filled runner name: ${config.name}`);

  // Configure Docker network if specified (required for E2E to reach MinIO)
  if (config.network) {
    console.log(`Setting Docker network: ${config.network}`);
    const networkInput = page.locator('[data-testid="docker-network-input"]').first();
    await networkInput.scrollIntoViewIfNeeded();
    await networkInput.fill(config.network);
  }

  // Configure Data Download (required for backtests to work)
  if (config.dataDownload?.exchanges?.length) {
    console.log('Configuring data download...');

    for (const exchange of config.dataDownload.exchanges) {
      // Click "Add Exchange" button
      console.log(`Adding exchange: ${exchange.name}`);
      const addExchangeBtn = page.locator('[data-testid="add-exchange-button"]').first();
      await addExchangeBtn.waitFor({ state: 'visible', timeout: 5000 });
      console.log('Add Exchange button found, clicking...');
      await addExchangeBtn.click();
      console.log('Add Exchange button clicked');
      await page.waitForTimeout(500);

      // The exchange is added with default values, we may need to configure it
      // Find the last accordion (newly added exchange)
      const accordions = page.locator('.MuiAccordion-root');
      const lastAccordion = accordions.last();

      // Expand it if collapsed - check for expanded state
      const expandBtn = lastAccordion.locator('.MuiAccordionSummary-root').first();
      const isExpanded = await lastAccordion.getAttribute('class').then(cls => cls?.includes('Mui-expanded'));
      if (!isExpanded) {
        await expandBtn.click();
        // Wait for accordion to expand
        await page.waitForTimeout(500);
      }

      // Wait for accordion content to be visible
      const accordionDetails = lastAccordion.locator('.MuiAccordionDetails-root').first();
      await accordionDetails.waitFor({ state: 'visible', timeout: 5000 });

      // Select exchange name if different from default
      if (exchange.name !== 'binance') {
        const exchangeSelect = lastAccordion.locator('label:has-text("Exchange") ~ div [role="combobox"]').first();
        if (await exchangeSelect.isVisible({ timeout: 1000 })) {
          await exchangeSelect.click();
          await page.waitForTimeout(200);
          await page.locator(`[role="option"]:has-text("${exchange.name}")`).click();
          await page.waitForTimeout(200);
        }
      }

      // Configure trading mode if specified
      if (exchange.tradingMode && exchange.tradingMode !== 'spot') {
        const modeSelect = lastAccordion.locator('label:has-text("Trading Mode") ~ div [role="combobox"]').first();
        if (await modeSelect.isVisible({ timeout: 1000 })) {
          await modeSelect.click();
          await page.waitForTimeout(200);
          await page.locator(`[role="option"]:has-text("${exchange.tradingMode}")`).click();
          await page.waitForTimeout(200);
        }
      }

      // Get the accordion index (zero-based)
      const accordionCount = await accordions.count();
      const accordionIndex = accordionCount - 1;

      // Configure pairs pattern if specified
      if (exchange.pairsPattern) {
        // Use testid with index (data-testid="exchange-0-pairs-input" for first exchange)
        const pairsInput = page.locator(`[data-testid="exchange-${accordionIndex}-pairs-input"]`).first();
        if (await pairsInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await pairsInput.clear();
          await pairsInput.fill(exchange.pairsPattern);
          console.log(`Set pairs pattern to: ${exchange.pairsPattern}`);
        } else {
          // Fallback: try label-based selector within accordion
          const fallbackInput = lastAccordion.locator('label:has-text("Pairs Pattern")').locator('..').locator('input').first();
          if (await fallbackInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await fallbackInput.clear();
            await fallbackInput.fill(exchange.pairsPattern);
            console.log(`Set pairs pattern to: ${exchange.pairsPattern} (fallback)`);
          }
        }
      }

      // Configure days if specified
      if (exchange.days) {
        const daysInput = page.locator(`[data-testid="exchange-${accordionIndex}-days-input"]`).first();
        if (await daysInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await daysInput.clear();
          await daysInput.fill(String(exchange.days));
          console.log(`Set days to: ${exchange.days}`);
        } else {
          // Fallback
          const fallbackInput = lastAccordion.locator('label:has-text("Days")').locator('..').locator('input').first();
          if (await fallbackInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await fallbackInput.clear();
            await fallbackInput.fill(String(exchange.days));
            console.log(`Set days to: ${exchange.days} (fallback)`);
          }
        }
      }
    }
  }

  // Configure S3 if provided
  if (config.s3) {
    console.log('Configuring S3...');

    // Scroll down to S3 section
    const s3Section = page.locator('text="S3 Data Distribution"').first();
    await s3Section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Try multiple approaches to click the S3 checkbox
    // First try the label with testid
    let s3Clicked = false;
    const s3EnableLabel = page.locator('[data-testid="s3-enable-label"]');
    if (await s3EnableLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found S3 label with testid, clicking...');
      await s3EnableLabel.click();
      s3Clicked = true;
    } else {
      // Fallback: click by label text
      console.log('S3 testid not found, trying label text...');
      const s3LabelByText = page.locator('label:has-text("Enable S3 data distribution")').first();
      if (await s3LabelByText.isVisible({ timeout: 2000 }).catch(() => false)) {
        await s3LabelByText.click();
        s3Clicked = true;
        console.log('Clicked S3 checkbox via label text');
      } else {
        // Last resort: click checkbox directly with force
        console.log('Trying direct checkbox click with force...');
        const s3Checkbox = page.locator('[data-testid="s3-enable-checkbox"]');
        if (await s3Checkbox.count() > 0) {
          await s3Checkbox.click({ force: true });
          s3Clicked = true;
          console.log('Clicked S3 checkbox with force');
        }
      }
    }

    if (!s3Clicked) {
      console.log('WARNING: Could not click S3 checkbox, continuing anyway...');
    }
    await page.waitForTimeout(500);

    // Wait for S3 fields to appear (they're in a Collapse component)
    const s3EndpointInput = page.locator('[data-testid="s3-endpoint-input"]');
    await s3EndpointInput.waitFor({ state: 'visible', timeout: 5000 });
    console.log('S3 fields visible, filling values...');

    await s3EndpointInput.fill(config.s3.endpoint);
    await page.locator('[data-testid="s3-bucket-input"]').fill(config.s3.bucket);
    await page.locator('[data-testid="s3-access-key-input"]').fill(config.s3.accessKeyId);
    await page.locator('[data-testid="s3-secret-key-input"]').fill(config.s3.secretAccessKey);

    if (!config.s3.useSSL) {
      // Use the data-testid for the SSL checkbox (label is "Use SSL/HTTPS")
      const sslCheckbox = page.locator('[data-testid="s3-use-ssl-checkbox"]');
      if (await sslCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isChecked = await sslCheckbox.isChecked();
        if (isChecked) {
          await sslCheckbox.click();
          console.log('Disabled SSL for S3');
        }
      } else {
        console.log('SSL checkbox not found, skipping...');
      }
      await page.waitForTimeout(500);
    }

    // Test S3 connection (optional - log result but don't fail)
    const s3TestBtn = page.locator('[data-testid="test-s3-connection"]');
    if (await s3TestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Testing S3 connection...');
      await s3TestBtn.click();
      await page.waitForTimeout(3000);

      const s3Alert = page.locator('.MuiAlert-root').first();
      if (await s3Alert.isVisible({ timeout: 5000 }).catch(() => false)) {
        const alertText = await s3Alert.textContent();
        console.log(`S3 test result: ${alertText}`);
        // Don't fail on S3 test - just log
        if (!alertText?.includes('Successfully')) {
          console.log('WARNING: S3 test did not succeed, but continuing...');
        }
      }
    } else {
      console.log('S3 test button not found, skipping...');
    }
  }

  // Test Docker connection (optional - don't fail if button not found)
  const dockerTestBtn = page.locator('[data-testid="test-docker-connection"]');
  if (await dockerTestBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Testing Docker connection...');
    await dockerTestBtn.click();
    await page.waitForTimeout(3000);

    // Check for Docker test result
    const dockerAlert = page.locator('.MuiAlert-root').first();
    if (await dockerAlert.isVisible({ timeout: 3000 }).catch(() => false)) {
      const alertText = await dockerAlert.textContent();
      console.log(`Docker test result: ${alertText}`);
    }
  } else {
    console.log('Docker test button not found, skipping...');
  }

  // Submit using testid with proper waiting
  console.log('Submitting runner form...');
  const submitBtn = page.locator('[data-testid="submit-create-runner"]');
  await submitBtn.scrollIntoViewIfNeeded();
  await expect(submitBtn).toBeEnabled({ timeout: 15000 });
  await submitBtn.click();
  console.log('Clicked submit button');
  await page.waitForTimeout(3000);
  await waitForPageReady(page);

  console.log(`Runner created: ${config.name}`);
  return config.name;
}

export async function triggerDataDownload(page: Page, runnerName?: string): Promise<void> {
  console.log('Triggering data download...');

  await navigateInOrg(page, '/runners');

  // Find refresh button - either for specific runner or first available
  let refreshBtn;
  if (runnerName) {
    // Find the row containing the runner name, then find refresh button within it
    const runnerRow = page.locator(`[role="row"]:has-text("${runnerName}")`).first();
    refreshBtn = runnerRow.locator('[data-testid^="refresh-data-"]');
  } else {
    refreshBtn = page.locator('[data-testid^="refresh-data-"]').first();
  }

  if (await refreshBtn.isVisible({ timeout: 5000 })) {
    await refreshBtn.click();
    console.log('Data download triggered');
  } else {
    console.log('No refresh button found for runner');
  }

  await page.waitForTimeout(2000);
}

export async function waitForDataReady(page: Page, timeout: number = DATA_DOWNLOAD_TIMEOUT_MS, runnerName?: string): Promise<boolean> {
  console.log(`Waiting for data download to complete${runnerName ? ` for ${runnerName}` : ''}...`);

  const startTime = Date.now();
  let lastProgress = -1;
  let noProgressCount = 0;

  while (Date.now() - startTime < timeout) {
    // Get the runner row (may need refresh if WebSocket not working)
    const runnerRow = runnerName
      ? page.locator(`[role="row"]:has-text("${runnerName}")`).first()
      : page.locator('[role="row"][data-rowindex]').first();

    // Wait for row to be visible
    if (!(await runnerRow.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`Runner "${runnerName}" not found, refreshing...`);
      await page.reload();
      await waitForPageReady(page);
      continue;
    }

    // Check for Ready chip
    const readyChip = runnerRow.locator('.MuiChip-root:has-text("Ready")');
    if (await readyChip.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('Data ready!');
      return true;
    }

    // Check for Failed chip
    const failedChip = runnerRow.locator('.MuiChip-root:has-text("Failed")');
    if (await failedChip.isVisible({ timeout: 500 }).catch(() => false)) {
      const errorMsg = await runnerRow.locator('[title]').getAttribute('title').catch(() => null);
      console.log(`Data download failed${errorMsg ? `: ${errorMsg}` : ''}`);
      return false;
    }

    // Log progress
    const progressText = await runnerRow.locator('text=/Downloading|\\d+%/i').first().textContent().catch(() => null);
    if (progressText) {
      // Extract numeric progress if present
      const match = progressText.match(/(\d+)%/);
      const currentProgress = match ? parseInt(match[1]) : 0;

      if (currentProgress !== lastProgress) {
        console.log(`  ${progressText}`);
        lastProgress = currentProgress;
        noProgressCount = 0;
      } else {
        noProgressCount++;
      }
    }

    // If no progress updates for a while (WebSocket might not be working), refresh
    if (noProgressCount > 5) {
      console.log('  No progress updates, refreshing page...');
      await page.reload();
      await waitForPageReady(page);
      noProgressCount = 0;
    } else {
      // Short wait - WebSocket should update the DOM
      await page.waitForTimeout(2000);
    }
  }

  console.log('Data download timeout');
  return false;
}

/**
 * Create a runner with minimal configuration suitable for E2E testing.
 * Downloads only BTC/USDT and ETH/USDT for 7 days - fast enough for tests.
 */
export async function createE2ERunner(page: Page, name: string): Promise<string> {
  return createRunner(page, {
    name,
    network: 'volaticloud-e2e',  // Required for containers to reach MinIO
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
          timeframes: ['5m', '15m', '1h', '4h'],  // Multiple timeframes for testing
          pairsPattern: '(BTC|ETH)/USDT',  // Only 2 pairs for fast download
          days: 7,  // Only 7 days for fast E2E tests
          tradingMode: 'spot',
        },
      ],
    },
  });
}

/**
 * Create a runner and wait for data download to complete.
 * This is the recommended function for E2E tests that need backtest capability.
 */
export async function createE2ERunnerWithData(
  page: Page,
  name: string,
  downloadTimeout: number = 3 * 60 * 1000  // 3 minutes default
): Promise<string> {
  // Create the runner
  await createE2ERunner(page, name);

  // Trigger data download
  await triggerDataDownload(page, name);

  // Wait for data to be ready (pass runner name for specific checking)
  const isReady = await waitForDataReady(page, downloadTimeout, name);

  if (!isReady) {
    throw new Error(`Data download for runner "${name}" did not complete within ${downloadTimeout}ms`);
  }

  return name;
}
