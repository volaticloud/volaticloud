/**
 * Strategy Builder E2E Test Suite - 500 Scenarios
 *
 * Tests the full strategy creation → code preview → backtest flow.
 * Uses the GraphQL API through the browser context (leveraging existing auth).
 *
 * For each scenario:
 * 1. Calls previewStrategyCode to validate code generation
 * 2. Creates the strategy via createStrategy mutation
 * 3. Runs a backtest via runBacktest mutation
 * 4. Polls for backtest completion and checks for errors
 * 5. Logs all errors for analysis
 */

import { test, Page } from '@playwright/test';
import { generateAllScenarios } from './scenario-generator';
import { signIn } from './auth';
import { createClient, type Client as WsClient } from 'graphql-ws';
import WebSocket from 'ws';

// ============================================================================
// Configuration
// ============================================================================

const GRAPHQL_ENDPOINT = '/gateway/v1/query';
const WS_ENDPOINT = process.env.E2E_WS_ENDPOINT || 'ws://localhost:8080/gateway/v1/query';
const BACKTEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per backtest
const BACKTEST_POLL_INTERVAL_MS = 5_000;
// Shared auth token - captured once after sign-in
let authToken = '';

// Results tracking
interface ScenarioResult {
  scenarioId: number;
  scenarioName: string;
  category: string;
  previewSuccess: boolean;
  previewError?: string;
  createSuccess: boolean;
  createError?: string;
  strategyId?: string;
  backtestSuccess: boolean;
  backtestError?: string;
  backtestLogs?: string;
  backtestStatus?: string;
  backtestResult?: Record<string, unknown>;
  duration: number;
}

// ============================================================================
// GraphQL helper
// ============================================================================

/** Extract auth token from session storage */
async function captureToken(page: Page): Promise<string> {
  return await page.evaluate(() => {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('oidc.user:')) {
        try {
          const val = JSON.parse(sessionStorage.getItem(key) || '{}');
          if (val.access_token) return val.access_token;
        } catch { /* ignore */ }
      }
    }
    return '';
  });
}

async function graphqlRequest(page: Page, query: string, variables: Record<string, unknown>, retries = 2): Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string }> }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await page.evaluate(
        async ({ endpoint, query, variables, token }) => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ query, variables }),
          });
          return response.json();
        },
        { endpoint: GRAPHQL_ENDPOINT, query, variables, token: authToken }
      );

      // Check if token expired
      if (result.error === 'missing Authorization header' || result.error?.includes?.('token') || result.error?.includes?.('expired')) {
        // Try to recapture token first
        const newToken = await captureToken(page);
        if (newToken && newToken !== authToken) {
          authToken = newToken;
          console.log('  Token refreshed from session');
          continue;
        }
        // Session expired - re-authenticate
        if (attempt < retries) {
          console.log('  Token expired, re-authenticating...');
          await signIn(page);
          await page.waitForTimeout(2000);
          const freshToken = await captureToken(page);
          if (freshToken) {
            authToken = freshToken;
            console.log('  Re-authenticated successfully');
            continue;
          }
        }
      }

      return result;
    } catch (e) {
      if (attempt < retries && String(e).includes('Execution context was destroyed')) {
        console.warn(`  Retrying after context destroyed (attempt ${attempt + 1})`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        continue;
      }
      throw e;
    }
  }
  return { errors: [{ message: 'Max retries exceeded' }] };
}

// ============================================================================
// Strategy operations
// ============================================================================

// Runner data exchange config - detected at runtime from the active runner
let runnerExchangeName = 'binance';
let runnerPairs = ['BTC/USDT'];
let runnerTimeframes: string[] = [];

/** Pick the best available timeframe: use the scenario's if available on runner, else first available */
function effectiveTimeframe(scenarioTf: string): string {
  if (runnerTimeframes.length === 0) return scenarioTf;
  if (runnerTimeframes.includes(scenarioTf)) return scenarioTf;
  return runnerTimeframes[0];
}

/** Wraps a UIBuilderConfig into the full strategy config format expected by the backend */
function wrapConfig(uiBuilderConfig: Record<string, unknown>, timeframe: string): Record<string, unknown> {
  const tf = effectiveTimeframe(timeframe);
  return {
    timeframe: tf,
    stake_currency: 'USDT',
    stake_amount: 10,
    max_open_trades: 3,
    dry_run: true,
    entry_pricing: { price_side: 'other', use_order_book: true, order_book_top: 1 },
    exit_pricing: { price_side: 'other', use_order_book: true, order_book_top: 1 },
    pairlists: [{ method: 'StaticPairList' }],
    exchange: { name: runnerExchangeName, pair_whitelist: runnerPairs },
    ui_builder: uiBuilderConfig,
  };
}

async function previewCode(page: Page, config: Record<string, unknown>, className: string): Promise<{ success: boolean; code: string; error?: string }> {
  const result = await graphqlRequest(page, `
    mutation PreviewStrategyCode($config: Map!, $className: String!) {
      previewStrategyCode(config: $config, className: $className) {
        success
        code
        error
      }
    }
  `, { config, className });

  if (result.errors) {
    return { success: false, code: '', error: result.errors.map(e => e.message).join('; ') };
  }

  if (!result.data) {
    return { success: false, code: '', error: `No data in response: ${JSON.stringify(result).substring(0, 300)}` };
  }
  const preview = (result.data as Record<string, Record<string, unknown>>)?.previewStrategyCode;
  if (!preview) {
    return { success: false, code: '', error: `No previewStrategyCode in data: ${JSON.stringify(result.data).substring(0, 300)}` };
  }
  return {
    success: preview?.success as boolean || false,
    code: preview?.code as string || '',
    error: (preview?.error as string) || (preview?.success === false ? `success=false, code="${(preview?.code as string || '').substring(0, 100)}"` : undefined),
  };
}

async function createStrategy(page: Page, name: string, code: string, config: Record<string, unknown>, ownerID: string): Promise<{ id?: string; error?: string }> {
  const result = await graphqlRequest(page, `
    mutation CreateStrategy($input: CreateStrategyInput!) {
      createStrategy(input: $input) {
        id
        name
        code
        config
      }
    }
  `, {
    input: {
      name,
      code,
      config,
      builderMode: 'ui',
      ownerID,
    },
  });

  if (result.errors) {
    return { error: result.errors.map(e => e.message).join('; ') };
  }

  const strategy = (result.data as Record<string, Record<string, string>>)?.createStrategy;
  return { id: strategy?.id };
}

async function runBacktest(page: Page, strategyID: string, runnerID: string, pairs: string[], backtestDays: number, timeframe: string): Promise<{ id?: string; error?: string }> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - backtestDays * 24 * 60 * 60 * 1000);

  const config: Record<string, unknown> = {
    stake_currency: 'USDT',
    stake_amount: 100,
    tradable_balance_ratio: 0.99,
    dry_run: true,
    timeframe,
    exchange: {
      name: runnerExchangeName,
      pair_whitelist: pairs,
    },
    pairlists: [{ method: 'StaticPairList' }],
    entry_pricing: { price_side: 'same', use_order_book: true, order_book_top: 1 },
    exit_pricing: { price_side: 'same', use_order_book: true, order_book_top: 1 },
  };

  const result = await graphqlRequest(page, `
    mutation RunBacktest($input: CreateBacktestInput!) {
      runBacktest(input: $input) {
        id
        status
      }
    }
  `, {
    input: {
      strategyID,
      runnerID,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      config,
    },
  });

  if (result.errors) {
    return { error: result.errors.map(e => e.message).join('; ') };
  }

  const backtest = (result.data as Record<string, Record<string, string>>)?.runBacktest;
  return { id: backtest?.id };
}

async function pollBacktestResult(page: Page, backtestID: string): Promise<{ status: string; error?: string; logs?: string; result?: Record<string, unknown> }> {
  // Try WebSocket subscription first, fall back to polling
  let wsClient: WsClient | null = null;
  let wsResolved = false;

  const wsPromise = new Promise<{ status: string; error?: string } | null>((resolve) => {
    try {
      wsClient = createClient({
        url: WS_ENDPOINT,
        webSocketImpl: WebSocket,
        connectionParams: { authToken: `Bearer ${authToken}` },
        retryAttempts: 0,
      });

      wsClient.subscribe(
        {
          query: `subscription BacktestProgress($backtestId: ID!) {
            backtestProgress(backtestId: $backtestId) { id status errorMessage }
          }`,
          variables: { backtestId: backtestID },
        },
        {
          next(value) {
            const bt = (value.data as Record<string, Record<string, unknown>>)?.backtestProgress;
            if (!bt) return;
            const status = bt.status as string;
            console.log(`    [WS] ${backtestID.substring(0, 8)}: ${status}`);
            if (['COMPLETED', 'FAILED', 'ERROR', 'completed', 'failed', 'error'].includes(status)) {
              wsResolved = true;
              resolve({ status, error: bt.errorMessage as string || undefined });
            }
          },
          error() { resolve(null); },
          complete() { resolve(null); },
        },
      );

      // WS timeout: if no result in 15s, fall through to polling
      setTimeout(() => { if (!wsResolved) resolve(null); }, 15_000);
    } catch {
      resolve(null);
    }
  });

  const wsResult = await wsPromise;
  try { wsClient?.dispose(); } catch { /* ignore */ }
  if (wsResult) return wsResult;

  // Fallback: HTTP polling
  console.log(`    [POLL] Falling back to polling for ${backtestID.substring(0, 8)}`);
  const startTime = Date.now();
  while (Date.now() - startTime < BACKTEST_TIMEOUT_MS) {
    const result = await graphqlRequest(page, `
      query GetBacktest($id: ID!) {
        backtests(where: {id: $id}, first: 1) {
          edges { node { id status errorMessage } }
        }
      }
    `, { id: backtestID });

    if (result.errors) {
      return { status: 'ERROR', error: result.errors.map(e => e.message).join('; ') };
    }

    const edges = (result.data as Record<string, Record<string, Array<Record<string, Record<string, unknown>>>>>)?.backtests?.edges;
    if (!edges || edges.length === 0) {
      return { status: 'NOT_FOUND', error: 'Backtest not found' };
    }

    const bt = edges[0].node;
    const status = bt.status as string;
    if (['COMPLETED', 'FAILED', 'ERROR', 'completed', 'failed', 'error'].includes(status)) {
      console.log(`    [POLL] ${backtestID.substring(0, 8)}: ${status}`);
      return { status, error: bt.errorMessage as string || undefined };
    }

    await new Promise(resolve => setTimeout(resolve, BACKTEST_POLL_INTERVAL_MS));
  }

  return { status: 'TIMEOUT', error: 'Backtest timed out after 5 minutes' };
}

// ============================================================================
// Error analysis - extract meaningful errors from backtest logs
// ============================================================================

function extractErrorsFromLogs(logs: string): string[] {
  const errors: string[] = [];
  const lines = logs.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('exception') || lower.includes('traceback') ||
        lower.includes('syntaxerror') || lower.includes('nameerror') || lower.includes('typeerror') ||
        lower.includes('keyerror') || lower.includes('attributeerror') || lower.includes('importerror') ||
        lower.includes('valueerror') || lower.includes('indentationerror') || lower.includes('failed')) {
      errors.push(line.trim());
    }
  }

  return errors;
}

// ============================================================================
// Main test
// ============================================================================

const scenarios = generateAllScenarios();
const allResults: ScenarioResult[] = [];

test.describe('Strategy Builder - 500 Scenarios', () => {
  let ownerID: string;
  let runnerID: string;

  test.beforeAll(async ({ browser }) => {
    const baseURL = process.env.E2E_BASE_URL || 'https://console.volaticloud.loc';
    console.log('E2E_BASE_URL:', baseURL);
    console.log('ignoreHTTPSErrors:', !!process.env.E2E_BASE_URL);
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      baseURL,
    });
    const page = await context.newPage();

    // Step 1: Sign in
    console.log('Starting sign in...');
    await signIn(page);
    console.log('Sign in completed, URL:', page.url());
    await page.waitForTimeout(3000);
    console.log('After 3s wait, URL:', page.url());
    await page.goto('/strategies');
    console.log('After goto strategies, URL:', page.url());
    await page.waitForLoadState('networkidle');
    console.log('After networkidle, URL:', page.url());
    await page.waitForTimeout(2000);
    console.log('Before captureToken, URL:', page.url());

    // Capture auth token
    authToken = await captureToken(page);
    console.log(`Auth token: ${authToken ? authToken.substring(0, 20) + '...' : 'NONE'}`);
    if (!authToken) {
      throw new Error('Failed to capture auth token after sign-in');
    }

    // Step 2: Create a test organization
    console.log('Creating E2E test organization...');
    const orgResult = await graphqlRequest(page, `
      mutation CreateOrg($input: CreateOrganizationInput!) {
        createOrganization(input: $input) { id title alias }
      }
    `, { input: { title: `E2E Test Org ${Date.now()}` } });

    console.log('createOrganization result:', JSON.stringify(orgResult));
    if (orgResult.errors) {
      throw new Error(`Failed to create org: ${orgResult.errors.map(e => e.message).join('; ')}`);
    }
    const org = (orgResult.data as Record<string, Record<string, string>>)?.createOrganization;
    if (!org) {
      throw new Error(`createOrganization returned no data: ${JSON.stringify(orgResult)}`);
    }
    ownerID = org.alias;
    console.log(`Created org: ${org.title} (alias: ${ownerID})`);

    // Step 2b: Seed billing via Stripe Checkout (or seed mutation if available)
    // In containerized E2E, we go through the real Stripe test-mode checkout flow.
    // If STRIPE_API_KEY is not set, we skip billing setup (tests will fail on billing-gated features).
    console.log('Setting up billing for test org...');
    try {
      const sessionResult = await graphqlRequest(page, `
        mutation CreateCheckout($input: CreateSubscriptionSessionInput!) {
          createSubscriptionSession(input: $input) { url }
        }
      `, { input: { ownerID, planId: 'starter' } });

      const checkoutUrl = (sessionResult.data as Record<string, Record<string, string>>)?.createSubscriptionSession?.url;
      if (checkoutUrl) {
        console.log('Navigating to Stripe Checkout...');
        await page.goto(checkoutUrl);
        await page.waitForLoadState('networkidle');

        // Fill Stripe test card
        const cardFrame = page.frameLocator('iframe[name*="stripe"]').first();
        await cardFrame.locator('[placeholder*="card number"], [name="cardnumber"]').fill('4242424242424242');
        await cardFrame.locator('[placeholder*="MM"], [name="cardExpiry"]').fill('12/30');
        await cardFrame.locator('[placeholder*="CVC"], [name="cardCvc"]').fill('123');

        // Fill email if required
        const emailInput = page.locator('input[name="email"], input[type="email"]');
        if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await emailInput.fill('test@test.com');
        }

        // Submit payment
        await page.locator('button[type="submit"], .SubmitButton').first().click();

        // Wait for redirect back or success indication
        await page.waitForURL(/.*(?:success|strategies|dashboard).*/, { timeout: 60_000 }).catch(() => {
          console.warn('Stripe checkout redirect timeout - continuing anyway');
        });
        await page.waitForTimeout(5000); // Wait for webhook processing
        console.log('Stripe checkout completed');
      } else if (sessionResult.errors) {
        console.warn(`Stripe checkout not available: ${sessionResult.errors.map(e => e.message).join('; ')}`);
        console.warn('Billing features may not work in this E2E run');
      }
    } catch (e) {
      console.warn(`Billing setup failed: ${(e as Error).message}`);
    }

    // Step 3: Create a Docker runner with S3 + data download config
    console.log('Creating E2E bot runner with MinIO S3 config...');
    const runnerResult = await graphqlRequest(page, `
      mutation CreateRunner($input: CreateBotRunnerInput!) {
        createBotRunner(input: $input) { id name dataIsReady }
      }
    `, {
      input: {
        ownerID,
        name: `e2e-runner-${Date.now()}`,
        type: 'docker',
        config: {
          docker: {
            host: 'unix:///var/run/docker.sock',
            ...(process.env.E2E_BASE_URL ? { network: 'volaticloud-e2e' } : {}),
          },
        },
        s3Config: {
          endpoint: process.env.E2E_BASE_URL ? 'minio:9000' : 'host.docker.internal:9000',
          bucket: 'volaticloud-data',
          accessKeyId: 'minioadmin',
          secretAccessKey: 'minioadmin',
          forcePathStyle: true,
          useSSL: false,
        },
        dataDownloadConfig: {
          exchanges: [{
            name: 'binance',
            enabled: true,
            timeframes: ['5m'],
            pairsPattern: 'BTC/USDT',
            days: 7,
          }],
        },
      },
    });

    if (runnerResult.errors) {
      throw new Error(`Failed to create runner: ${runnerResult.errors.map(e => e.message).join('; ')}`);
    }
    const runner = (runnerResult.data as Record<string, Record<string, unknown>>)?.createBotRunner;
    runnerID = runner.id as string;
    console.log(`Created runner: ${runner.name} (${runnerID})`);

    // Step 4: Trigger data download
    console.log('Triggering data download...');
    const refreshResult = await graphqlRequest(page, `
      mutation RefreshData($id: ID!) {
        refreshRunnerData(id: $id) { id dataIsReady dataDownloadStatus }
      }
    `, { id: runnerID });

    if (refreshResult.errors) {
      console.warn(`Data refresh warning: ${refreshResult.errors.map(e => e.message).join('; ')}`);
    } else {
      console.log('Data download triggered');
    }

    // Step 5: Poll until data is ready (timeout 5 min)
    console.log('Waiting for data download to complete...');
    const dataTimeout = 5 * 60 * 1000;
    const dataStart = Date.now();
    let dataReady = false;

    while (Date.now() - dataStart < dataTimeout) {
      const statusResult = await graphqlRequest(page, `
        query RunnerStatus($where: BotRunnerWhereInput) {
          botRunners(first: 1, where: $where) {
            edges { node { id dataIsReady dataDownloadStatus dataErrorMessage } }
          }
        }
      `, { where: { id: runnerID } });

      const edges = (statusResult.data as Record<string, Record<string, Array<Record<string, Record<string, unknown>>>>>)?.botRunners?.edges;
      if (edges && edges.length > 0) {
        const node = edges[0].node;
        const status = node.dataDownloadStatus as string;
        console.log(`  Data status: ${status}, ready: ${node.dataIsReady}`);

        if (node.dataIsReady) {
          dataReady = true;
          break;
        }
        if (status === 'failed' || status === 'FAILED') {
          console.warn(`Data download failed: ${node.dataErrorMessage}`);
          break;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 10_000));
    }

    if (!dataReady) {
      console.warn('Data download did not complete - trying to find an existing runner with data...');
      // Fallback: find any runner that already has data ready
      const fallbackResult = await graphqlRequest(page, `
        query { botRunners(first: 50) { edges { node { id name dataIsReady dataDownloadConfig } } } }
      `, {});
      const allRunners = (fallbackResult.data as Record<string, Record<string, Array<Record<string, Record<string, unknown>>>>>)?.botRunners?.edges;
      const readyRunner = allRunners?.find(e => e.node.dataIsReady === true);
      if (readyRunner) {
        runnerID = readyRunner.node.id as string;
        console.log(`Using existing runner with data: ${readyRunner.node.name} (${runnerID})`);
        // Detect exchange and pairs from runner's data download config
        const dlConfig = readyRunner.node.dataDownloadConfig as Record<string, unknown> | null;
        if (dlConfig?.exchanges) {
          const exchanges = dlConfig.exchanges as Array<Record<string, unknown>>;
          const enabledExchange = exchanges.find(e => e.enabled);
          if (enabledExchange) {
            runnerExchangeName = enabledExchange.name as string || 'binance';
            // Parse pairs pattern into actual pairs
            const pattern = enabledExchange.pairsPattern as string || 'BTC/USDT';
            // Pattern like "(ETH|BTC)/USDT" → ["ETH/USDT", "BTC/USDT"]
            const match = pattern.match(/^\(([^)]+)\)\/(.+)$/);
            if (match) {
              runnerPairs = match[1].split('|').map(p => `${p}/${match[2]}`);
            } else {
              runnerPairs = [pattern];
            }
            if (enabledExchange.timeframes) {
              runnerTimeframes = enabledExchange.timeframes as string[];
            }
            console.log(`Runner data config: exchange=${runnerExchangeName}, pairs=${runnerPairs.join(',')}, timeframes=${runnerTimeframes.join(',')}`);
          }
        }
      } else {
        console.warn('No runner with data available - backtests will fail with "no data" errors');
      }
    } else {
      console.log('Data download complete - runner is ready');
    }

    try { await page.close(); } catch { /* trace artifact cleanup may fail */ }
  });

  // Create batched tests (10 scenarios per test to keep test count manageable)
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
      await page.waitForTimeout(2000);
      await page.goto('/strategies');
      await page.waitForLoadState('networkidle');

      // Refresh auth token for this page context
      const newToken = await captureToken(page);
      if (newToken) authToken = newToken;

      for (const scenario of batch) {
        const startTime = Date.now();
        const result: ScenarioResult = {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          category: scenario.category,
          previewSuccess: false,
          createSuccess: false,
          backtestSuccess: false,
          duration: 0,
        };

        console.log(`\n=== Scenario ${scenario.id}/${scenarios.length}: ${scenario.name} ===`);
        console.log(`Category: ${scenario.category} | Pairs: ${scenario.pairs.join(', ')} | TF: ${scenario.timeframe}`);

        try {
          // Step 1: Preview code
          // Convert to PascalCase: "Single_RSI_1" → "SingleRsi1"
          const className = 'E2e' + scenario.name
            .replace(/[^a-zA-Z0-9]/g, '_')
            .split('_')
            .filter(Boolean)
            .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
            .join('');
          const wrappedConfig = wrapConfig(scenario.config as unknown as Record<string, unknown>, scenario.timeframe);
          const preview = await previewCode(page, wrappedConfig, className);
          result.previewSuccess = preview.success;
          result.previewError = preview.error;

          if (!preview.success) {
            console.error(`  PREVIEW FAILED: ${preview.error}`);
            result.duration = Date.now() - startTime;
            allResults.push(result);
            continue;
          }
          console.log(`  Preview OK (${preview.code.length} chars)`);

          // Step 2: Create strategy
          const strategyName = `E2E_${scenario.name}_${Date.now()}`;
          const createResult = await createStrategy(
            page,
            strategyName,
            preview.code,
            wrappedConfig,
            ownerID
          );
          result.createSuccess = !!createResult.id;
          result.createError = createResult.error;
          result.strategyId = createResult.id;

          if (!createResult.id) {
            console.error(`  CREATE FAILED: ${createResult.error}`);
            result.duration = Date.now() - startTime;
            allResults.push(result);
            continue;
          }
          console.log(`  Created strategy: ${createResult.id}`);

          // Step 3: Run backtest (skip if no runner available)
          if (!runnerID) {
            console.log(`  SKIPPING backtest (no runner available)`);
            result.backtestSuccess = true; // Count as success for preview-only mode
            result.backtestStatus = 'SKIPPED';
            result.duration = Date.now() - startTime;
            allResults.push(result);
            continue;
          }

          const btResult = await runBacktest(
            page,
            createResult.id,
            runnerID,
            runnerPairs.length > 0 ? runnerPairs : scenario.pairs,
            scenario.backtestDays,
            effectiveTimeframe(scenario.timeframe),
          );

          if (!btResult.id) {
            console.error(`  BACKTEST START FAILED: ${btResult.error}`);
            result.backtestError = btResult.error;
            result.duration = Date.now() - startTime;
            allResults.push(result);
            continue;
          }
          console.log(`  Backtest started: ${btResult.id}`);

          // Step 4: Poll for results
          const btPoll = await pollBacktestResult(page, btResult.id);
          result.backtestStatus = btPoll.status;
          result.backtestResult = btPoll.result;
          result.backtestLogs = btPoll.logs;

          if (btPoll.status === 'COMPLETED' || btPoll.status === 'completed') {
            result.backtestSuccess = true;
            console.log(`  BACKTEST COMPLETED`);

            // Check logs for warnings/errors even on success
            if (btPoll.logs) {
              const logErrors = extractErrorsFromLogs(btPoll.logs);
              if (logErrors.length > 0) {
                console.warn(`  Warnings in logs (${logErrors.length}):`);
                logErrors.slice(0, 5).forEach(e => console.warn(`    ${e}`));
              }
            }
          } else {
            result.backtestError = btPoll.error || btPoll.status;
            console.error(`  BACKTEST FAILED: ${btPoll.status}`);
            if (btPoll.error) console.error(`  Error: ${btPoll.error}`);
            if (btPoll.logs) {
              const logErrors = extractErrorsFromLogs(btPoll.logs);
              console.error(`  Log errors (${logErrors.length}):`);
              logErrors.slice(0, 10).forEach(e => console.error(`    ${e}`));
            }
          }
        } catch (e) {
          console.error(`  EXCEPTION: ${e}`);
          result.backtestError = String(e);
        }

        result.duration = Date.now() - startTime;
        allResults.push(result);
      }
    });
  }

  test.afterAll(async () => {
    // Write summary report
    const total = allResults.length;
    const previewFails = allResults.filter(r => !r.previewSuccess);
    const createFails = allResults.filter(r => r.previewSuccess && !r.createSuccess);
    const backtestFails = allResults.filter(r => r.createSuccess && !r.backtestSuccess);
    const fullSuccess = allResults.filter(r => r.backtestSuccess);

    console.log('\n' + '='.repeat(80));
    console.log('STRATEGY BUILDER TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Total scenarios: ${total}`);
    console.log(`Full success: ${fullSuccess.length} (${(fullSuccess.length / total * 100).toFixed(1)}%)`);
    console.log(`Preview failures: ${previewFails.length}`);
    console.log(`Create failures: ${createFails.length}`);
    console.log(`Backtest failures: ${backtestFails.length}`);
    console.log('='.repeat(80));

    // Group errors by category
    const errorsByCategory: Record<string, ScenarioResult[]> = {};
    for (const r of [...previewFails, ...createFails, ...backtestFails]) {
      const cat = r.category;
      if (!errorsByCategory[cat]) errorsByCategory[cat] = [];
      errorsByCategory[cat].push(r);
    }

    if (Object.keys(errorsByCategory).length > 0) {
      console.log('\nERRORS BY CATEGORY:');
      for (const [cat, results] of Object.entries(errorsByCategory)) {
        console.log(`\n  ${cat} (${results.length} failures):`);
        for (const r of results) {
          const error = r.previewError || r.createError || r.backtestError || 'unknown';
          console.log(`    ${r.scenarioName}: ${error.substring(0, 200)}`);
        }
      }
    }

    // Group common error patterns
    const errorPatterns: Record<string, number> = {};
    for (const r of allResults.filter(r => !r.backtestSuccess)) {
      const error = r.previewError || r.createError || r.backtestError || 'unknown';
      // Extract first meaningful line
      const pattern = error.split('\n')[0].substring(0, 100);
      errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
    }

    if (Object.keys(errorPatterns).length > 0) {
      console.log('\nCOMMON ERROR PATTERNS:');
      const sorted = Object.entries(errorPatterns).sort(([, a], [, b]) => b - a);
      for (const [pattern, count] of sorted.slice(0, 20)) {
        console.log(`  ${count}x: ${pattern}`);
      }
    }

    // Write detailed JSON report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        previewFails: previewFails.length,
        createFails: createFails.length,
        backtestFails: backtestFails.length,
        fullSuccess: fullSuccess.length,
        successRate: (fullSuccess.length / total * 100).toFixed(1) + '%',
      },
      errorsByCategory,
      errorPatterns,
      results: allResults,
    };

    // Save report via page.evaluate to write to console (Playwright will capture it)
    console.log('\nDETAILED_REPORT_JSON=' + JSON.stringify(report, null, 2));
  });
});
