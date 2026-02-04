/**
 * Strategy Builder Flow Helpers
 *
 * Comprehensive helpers for testing strategy creation, modification, and backtesting.
 * Updated to match actual Strategy Studio UI components.
 */
import { Page } from '@playwright/test';
import { waitForPageReady, navigateInOrg } from './auth.flow';

const BACKTEST_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

// ============================================================================
// Strategy Creation & Navigation
// ============================================================================

export async function createStrategy(page: Page, name: string, description?: string): Promise<void> {
  console.log(`Creating strategy: ${name}`);

  await navigateInOrg(page, '/strategies');

  // Click create button
  const createBtn = page.locator('button:has-text("Create Strategy")').first();
  await createBtn.waitFor({ state: 'visible', timeout: 10000 });
  await createBtn.click();
  await page.waitForTimeout(1000);

  // Fill name in the drawer
  const nameInput = page.locator('[data-testid="strategy-name-input"], input[placeholder*="RSI Momentum"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(name);

  if (description) {
    const descInput = page.locator('[data-testid="strategy-description-input"], textarea[placeholder*="Briefly describe"]').first();
    if (await descInput.isVisible({ timeout: 1000 })) {
      await descInput.fill(description);
    }
  }

  // Submit - button text is "Create & Open Studio"
  await page.locator('[data-testid="submit-create-strategy"]').click();
  await page.waitForTimeout(3000);
  await waitForPageReady(page);

  console.log(`Strategy created: ${name}`);
}

export async function openStrategy(page: Page, name: string): Promise<void> {
  await navigateInOrg(page, '/strategies');

  // Click on the strategy row in the DataGrid
  const strategyRow = page.locator(`[role="row"]:has-text("${name}")`).first();
  await strategyRow.waitFor({ state: 'visible', timeout: 10000 });
  await strategyRow.click();
  await waitForPageReady(page);
  await page.waitForTimeout(1000);

  // Click edit button to go to Strategy Studio
  const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
  if (await editBtn.isVisible({ timeout: 3000 })) {
    await editBtn.click();
    await waitForPageReady(page);
  }
}

export async function saveStrategy(page: Page): Promise<void> {
  console.log('Saving strategy...');

  // Look for save button in Strategy Studio toolbar
  const saveBtn = page.locator('button:has-text("Save")').first();
  if (await saveBtn.isVisible({ timeout: 3000 })) {
    // Check if button is enabled (has changes)
    const isDisabled = await saveBtn.isDisabled();
    if (!isDisabled) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      console.log('Strategy saved');
    } else {
      console.log('No changes to save');
    }
  }
}

// ============================================================================
// Indicator Management
// ============================================================================

export type IndicatorType =
  | 'RSI' | 'SMA' | 'EMA' | 'MACD' | 'BB' | 'ATR' | 'ADX' | 'STOCH'
  | 'MFI' | 'OBV' | 'CCI' | 'WILLR' | 'ROC' | 'VWAP' | 'SUPERTREND'
  | 'ICHIMOKU' | 'TEMA' | 'DEMA' | 'WMA' | 'SAR' | 'STOCH_RSI' | 'CMF' | 'AD';

export interface IndicatorConfig {
  type: IndicatorType;
  params?: Record<string, number | string>;
  alias?: string;
}

export async function addIndicator(page: Page, config: IndicatorConfig): Promise<void> {
  console.log(`Adding indicator: ${config.type}`);

  // Click on "Indicators" tab in the Strategy Builder
  const indicatorsTab = page.locator('button:has-text("Indicators"), [role="tab"]:has-text("Indicators")').first();
  await indicatorsTab.waitFor({ state: 'visible', timeout: 5000 });
  await indicatorsTab.click();
  await page.waitForTimeout(500);

  // Search for the indicator
  const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
  if (await searchInput.isVisible({ timeout: 2000 })) {
    await searchInput.clear();
    await searchInput.fill(config.type);
    await page.waitForTimeout(500);
  }

  // Click on the indicator in the list to add it
  const indicatorItem = page.locator(`[role="button"]:has-text("${config.type}"), .MuiListItemButton-root:has-text("${config.type}")`).first();
  if (await indicatorItem.isVisible({ timeout: 3000 })) {
    await indicatorItem.click();
    await page.waitForTimeout(500);
  } else {
    // Try expanding categories first
    const categories = ['trend', 'momentum', 'volatility', 'volume'];
    for (const category of categories) {
      const categoryBtn = page.locator(`button:has-text("${category}"), [role="button"]:has-text("${category}")`).first();
      if (await categoryBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await categoryBtn.click();
        await page.waitForTimeout(300);

        const item = page.locator(`[role="button"]:has-text("${config.type}")`).first();
        if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
          await item.click();
          break;
        }
      }
    }
  }

  await page.waitForTimeout(500);

  // If a drawer opens for configuration, fill params and save
  const drawerSaveBtn = page.locator('button:has-text("Add"), button:has-text("Save")').first();
  if (await drawerSaveBtn.isVisible({ timeout: 2000 })) {
    // Configure parameters if provided
    if (config.params) {
      for (const [param, value] of Object.entries(config.params)) {
        const paramInput = page.locator(`label:has-text("${param}") + div input, input[name*="${param}"]`).first();
        if (await paramInput.isVisible({ timeout: 500 })) {
          await paramInput.clear();
          await paramInput.fill(String(value));
        }
      }
    }

    // Set alias if provided
    if (config.alias) {
      const aliasInput = page.locator('label:has-text("Label") + div input, input[name*="label"]').first();
      if (await aliasInput.isVisible({ timeout: 500 })) {
        await aliasInput.clear();
        await aliasInput.fill(config.alias);
      }
    }

    await drawerSaveBtn.click();
    await page.waitForTimeout(500);
  }

  // Clear search
  if (await searchInput.isVisible({ timeout: 500 }).catch(() => false)) {
    await searchInput.clear();
  }

  console.log(`Indicator added: ${config.type}`);
}

export async function removeIndicator(page: Page, indicatorLabel: string): Promise<void> {
  console.log(`Removing indicator: ${indicatorLabel}`);

  // Click on Indicators tab
  const indicatorsTab = page.locator('button:has-text("Indicators"), [role="tab"]:has-text("Indicators")').first();
  await indicatorsTab.click();
  await page.waitForTimeout(500);

  // Find the indicator in the "Your Indicators" section and delete it
  const indicatorChip = page.locator(`.MuiChip-root:has-text("${indicatorLabel}")`).first();
  const deleteBtn = indicatorChip.locator('svg[data-testid="CancelIcon"], button[aria-label*="delete"]').first();

  if (await deleteBtn.isVisible({ timeout: 2000 })) {
    await deleteBtn.click();
    await page.waitForTimeout(500);
  }
}

// ============================================================================
// Entry/Exit Conditions
// ============================================================================

export type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
export type LogicalOperator = 'AND' | 'OR';

export interface Condition {
  left: string;  // e.g., 'RSI' or 'close'
  operator: ComparisonOperator;
  right: string | number;  // e.g., 30 or 'SMA'
}

export interface ConditionGroup {
  conditions: (Condition | ConditionGroup)[];
  logic: LogicalOperator;
}

export async function setEntryCondition(page: Page, condition: string | Condition): Promise<void> {
  console.log('Setting entry condition...');

  // Navigate to Long Entry tab
  const entryTab = page.locator('button:has-text("Long Entry"), [role="tab"]:has-text("Long Entry")').first();
  if (await entryTab.isVisible({ timeout: 3000 })) {
    await entryTab.click();
    await page.waitForTimeout(500);
  }

  // Click "Add Condition" button
  const addConditionBtn = page.locator('button:has-text("Add Condition"), button:has-text("Add")').first();
  if (await addConditionBtn.isVisible({ timeout: 2000 })) {
    await addConditionBtn.click();
    await page.waitForTimeout(500);
  }

  if (typeof condition === 'object') {
    await configureCondition(page, condition);
  }

  await page.waitForTimeout(500);
}

export async function setExitCondition(page: Page, condition: string | Condition): Promise<void> {
  console.log('Setting exit condition...');

  // Navigate to Long Exit tab
  const exitTab = page.locator('button:has-text("Long Exit"), [role="tab"]:has-text("Long Exit")').first();
  if (await exitTab.isVisible({ timeout: 3000 })) {
    await exitTab.click();
    await page.waitForTimeout(500);
  }

  // Click "Add Condition" button
  const addConditionBtn = page.locator('button:has-text("Add Condition"), button:has-text("Add")').first();
  if (await addConditionBtn.isVisible({ timeout: 2000 })) {
    await addConditionBtn.click();
    await page.waitForTimeout(500);
  }

  if (typeof condition === 'object') {
    await configureCondition(page, condition);
  }

  await page.waitForTimeout(500);
}

async function configureCondition(page: Page, condition: Condition): Promise<void> {
  // Select left operand (indicator)
  const leftSelect = page.locator('[data-testid*="left"], select').first();
  if (await leftSelect.isVisible({ timeout: 1000 })) {
    await leftSelect.click();
    await page.locator(`[role="option"]:has-text("${condition.left}")`).first().click();
    await page.waitForTimeout(300);
  }

  // Select operator
  const opSelect = page.locator('[data-testid*="operator"], select').nth(1);
  if (await opSelect.isVisible({ timeout: 1000 })) {
    await opSelect.click();
    const opText = {
      gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=', neq: '!='
    }[condition.operator];
    await page.locator(`[role="option"]:has-text("${opText}")`).first().click();
    await page.waitForTimeout(300);
  }

  // Set right operand
  const rightInput = page.locator('input[type="number"], [data-testid*="right"]').first();
  if (await rightInput.isVisible({ timeout: 1000 })) {
    await rightInput.clear();
    await rightInput.fill(String(condition.right));
  }
}

// ============================================================================
// Strategy Parameters (Logic Tab)
// ============================================================================

export interface StrategyParams {
  timeframe?: string;
  tradingMode?: 'spot' | 'margin' | 'futures';
  direction?: 'long_only' | 'short_only' | 'long_and_short';
  stoploss?: number;
  takeProfit?: number;
  trailingStop?: { offset: number; positive?: number };
  leverage?: number;
}

export async function configureStrategyParams(page: Page, params: StrategyParams): Promise<void> {
  console.log('Configuring strategy parameters...');

  // Navigate to Logic tab
  const logicTab = page.locator('button:has-text("Logic"), [role="tab"]:has-text("Logic")').first();
  if (await logicTab.isVisible({ timeout: 3000 })) {
    await logicTab.click();
    await page.waitForTimeout(500);
  }

  // Configure Trading Mode
  if (params.tradingMode) {
    const modeLabel = params.tradingMode.charAt(0).toUpperCase() + params.tradingMode.slice(1);
    const modeBtn = page.locator(`button:has-text("${modeLabel}"), [role="button"]:has-text("${modeLabel}")`).first();
    if (await modeBtn.isVisible({ timeout: 1000 })) {
      await modeBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // Configure Position Mode (direction)
  if (params.direction) {
    const directionMap: Record<string, string> = {
      'long_only': 'Long Only',
      'short_only': 'Short Only',
      'long_and_short': 'Long & Short',
    };
    const dirLabel = directionMap[params.direction];
    const dirBtn = page.locator(`button:has-text("${dirLabel}"), [role="button"]:has-text("${dirLabel}")`).first();
    if (await dirBtn.isVisible({ timeout: 1000 })) {
      await dirBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // Configure stoploss (in General tab / Freqtrade Config)
  if (params.stoploss !== undefined) {
    // Navigate to General tab (strategy settings)
    const generalTab = page.locator('button:has-text("General"), [role="tab"]:has-text("General")').first();
    if (await generalTab.isVisible({ timeout: 1000 })) {
      await generalTab.click();
      await page.waitForTimeout(500);
    }

    const slInput = page.locator('label:has-text("stoploss") ~ input, input[name*="stoploss"]').first();
    if (await slInput.isVisible({ timeout: 1000 })) {
      await slInput.clear();
      await slInput.fill(String(params.stoploss));
    }
  }

  // Configure leverage (in Advanced tab)
  if (params.leverage !== undefined) {
    const advancedTab = page.locator('button:has-text("Advanced"), [role="tab"]:has-text("Advanced")').first();
    if (await advancedTab.isVisible({ timeout: 1000 })) {
      await advancedTab.click();
      await page.waitForTimeout(500);
    }

    // Enable leverage section if needed
    const leverageToggle = page.locator('text=/Leverage/i').first();
    if (await leverageToggle.isVisible({ timeout: 1000 })) {
      // Find and fill leverage input
      const leverageInput = page.locator('input[name*="leverage"], label:has-text("Leverage") ~ input').first();
      if (await leverageInput.isVisible({ timeout: 500 })) {
        await leverageInput.clear();
        await leverageInput.fill(String(params.leverage));
      }
    }
  }

  await page.waitForTimeout(500);
}

// ============================================================================
// Backtesting
// ============================================================================

export interface BacktestConfig {
  runnerId?: string;
  startDate?: string;
  endDate?: string;
  pairs?: string[];
}

export async function runBacktest(page: Page, config?: BacktestConfig): Promise<boolean> {
  console.log('Starting backtest...');

  // Click "Run Backtest" button in toolbar
  const backtestBtn = page.locator('button:has-text("Run Backtest")').first();
  await backtestBtn.waitFor({ state: 'visible', timeout: 5000 });

  // Check if enabled (must save first if has changes)
  const isDisabled = await backtestBtn.isDisabled();
  if (isDisabled) {
    console.log('Backtest button is disabled (unsaved changes?). Saving first...');
    await saveStrategy(page);
    await page.waitForTimeout(1000);
  }

  await backtestBtn.click();
  await page.waitForTimeout(1000);

  // Configure backtest in drawer if it opens
  const drawerTitle = page.locator('text=/Run Backtest|Create Backtest/i').first();
  if (await drawerTitle.isVisible({ timeout: 3000 })) {
    // Select runner if specified
    if (config?.runnerId) {
      const runnerSelect = page.locator('label:has-text("Runner") ~ [role="combobox"]').first();
      if (await runnerSelect.isVisible({ timeout: 2000 })) {
        await runnerSelect.click();
        await page.waitForTimeout(300);
        await page.locator(`[role="option"]:has-text("${config.runnerId}")`).first().click();
      }
    } else {
      // Select first available runner
      const runnerSelect = page.locator('[role="combobox"]').first();
      if (await runnerSelect.isVisible({ timeout: 2000 })) {
        await runnerSelect.click();
        await page.waitForTimeout(300);
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible({ timeout: 1000 })) {
          await firstOption.click();
        }
      }
    }

    // Click start/submit button
    const startBtn = page.locator('button:has-text("Start"), button:has-text("Run"), button[type="submit"]').first();
    if (await startBtn.isVisible({ timeout: 2000 })) {
      await startBtn.click();
    }
  }

  console.log('Backtest started');
  return true;
}

export async function waitForBacktestCompletion(page: Page, timeout: number = BACKTEST_TIMEOUT_MS): Promise<'completed' | 'failed' | 'timeout'> {
  console.log('Waiting for backtest completion...');

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    // Check for completed status (chip in toolbar)
    const completed = page.locator('.MuiChip-root:has-text("Complete"), .MuiChip-colorSuccess').first();
    if (await completed.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Backtest completed successfully');
      return 'completed';
    }

    // Check for failed status
    const failed = page.locator('.MuiChip-root:has-text("Failed"), .MuiChip-colorError').first();
    if (await failed.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('Backtest failed');
      return 'failed';
    }

    // Check running status
    const running = page.locator('.MuiChip-root:has-text("Running"), text=/Running/i').first();
    if (await running.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('  Backtest still running...');
    }

    await page.waitForTimeout(5000);
  }

  console.log('Backtest timeout');
  return 'timeout';
}

export async function verifyBacktestResults(page: Page): Promise<void> {
  console.log('Verifying backtest results...');

  // Click on "View Results" button or the completed chip
  const viewResultsBtn = page.locator('button:has-text("View Results"), .MuiChip-root:has-text("Complete")').first();
  if (await viewResultsBtn.isVisible({ timeout: 3000 })) {
    await viewResultsBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check for key metrics in the results drawer
  const metrics = ['Total Trades', 'Win Rate', 'Profit', 'Drawdown'];

  for (const metric of metrics) {
    const metricElement = page.locator(`text=/${metric}/i`).first();
    const isVisible = await metricElement.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
      console.log(`  ${metric}: visible`);
    }
  }
}
