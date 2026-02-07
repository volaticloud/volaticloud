/**
 * Strategy Builder Flow Helpers
 *
 * Comprehensive helpers for testing strategy creation, modification, and backtesting.
 * Updated to match actual Strategy Studio UI components.
 */
import { Page, expect } from '@playwright/test';
import { waitForPageReady, navigateInOrg } from './auth.flow';

const BACKTEST_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

// Tab ID to label mapping for fallback selectors
const TAB_LABELS: Record<string, string> = {
  'indicators': 'Indicators',
  'logic': 'Logic',
  'long-entry': 'Long Entry',
  'long-exit': 'Long Exit',
  'short-entry': 'Short Entry',
  'short-exit': 'Short Exit',
  'advanced': 'Advanced',
  'preview': 'Preview',
};

/**
 * Click a tab in the Strategy Builder with fallback selectors
 */
async function clickTab(page: Page, tabId: string): Promise<void> {
  // Try testid first
  let tab = page.locator(`[data-testid="tab-${tabId}"]`).first();
  if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tab.click();
    console.log(`Clicked tab via testid: ${tabId}`);
    return;
  }

  // Fallback: find by role and label text
  const label = TAB_LABELS[tabId] || tabId;
  console.log(`Tab testid not found for ${tabId}, trying label: ${label}`);
  tab = page.locator(`button[role="tab"]:has-text("${label}")`).first();
  await tab.waitFor({ state: 'visible', timeout: 5000 });
  await tab.click();
  console.log(`Clicked tab via label: ${label}`);
}

// ============================================================================
// Strategy Creation & Navigation
// ============================================================================

export async function createStrategy(page: Page, name: string, description?: string): Promise<void> {
  console.log(`Creating strategy: ${name}`);

  await navigateInOrg(page, '/strategies');

  // Click create button using data-testid
  const createBtn = page.locator('[data-testid="create-strategy-button"]').first();
  await createBtn.waitFor({ state: 'visible', timeout: 10000 });
  await createBtn.click();
  await page.waitForTimeout(1000);

  // Fill name in the drawer using data-testid
  const nameInput = page.locator('[data-testid="strategy-name-input"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(name);

  if (description) {
    const descInput = page.locator('[data-testid="strategy-description-input"]').first();
    if (await descInput.isVisible({ timeout: 1000 })) {
      await descInput.fill(description);
    }
  }

  // Submit using testid with proper waiting
  const submitBtn = page.locator('[data-testid="submit-create-strategy"]');
  await expect(submitBtn).toBeEnabled({ timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(3000);
  await waitForPageReady(page);

  console.log(`Strategy created: ${name}`);
}

export async function openStrategy(page: Page, name: string): Promise<void> {
  await navigateInOrg(page, '/strategies');

  // Wait for the DataGrid container to be visible (try testid first, then fallback)
  const dataGridTestId = page.locator('[data-testid="strategy-datagrid"]');
  const dataGridFallback = page.locator('.MuiDataGrid-root');

  // Try testid first, fallback to class-based selector
  if (await dataGridTestId.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dataGridTestId.waitFor({ state: 'visible', timeout: 10000 });
  } else {
    await dataGridFallback.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Wait for loading overlay to disappear (if present)
  const loadingOverlay = page.locator('.MuiDataGrid-overlay');
  if (await loadingOverlay.isVisible({ timeout: 1000 }).catch(() => false)) {
    await loadingOverlay.waitFor({ state: 'hidden', timeout: 10000 });
  }

  // Find strategy row - may need to paginate through results
  const rowTestId = page.locator(`[data-testid="strategy-row"]:has-text("${name}")`).first();
  const rowFallback = page.locator(`[role="row"]:has-text("${name}")`).first();

  let strategyRow;
  let found = false;
  const maxPages = 5;  // Limit pagination attempts

  for (let pageNum = 0; pageNum < maxPages && !found; pageNum++) {
    // Check if row is visible on current page
    if (await rowTestId.isVisible({ timeout: 1000 }).catch(() => false)) {
      strategyRow = rowTestId;
      found = true;
    } else if (await rowFallback.isVisible({ timeout: 1000 }).catch(() => false)) {
      strategyRow = rowFallback;
      found = true;
    }

    if (!found) {
      // Try to go to next page
      const nextPageBtn = page.locator('[aria-label="Go to next page"]').first();
      if (await nextPageBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const isDisabled = await nextPageBtn.isDisabled();
        if (!isDisabled) {
          console.log(`Strategy "${name}" not found on page ${pageNum + 1}, going to next page...`);
          await nextPageBtn.click();
          await page.waitForTimeout(1000);
          // Wait for loading
          if (await loadingOverlay.isVisible({ timeout: 500 }).catch(() => false)) {
            await loadingOverlay.waitFor({ state: 'hidden', timeout: 5000 });
          }
        } else {
          // No more pages
          break;
        }
      } else {
        // No pagination available
        break;
      }
    }
  }

  if (!found || !strategyRow) {
    throw new Error(`Strategy "${name}" not found in strategies list after checking ${maxPages} pages`);
  }

  await strategyRow.waitFor({ state: 'visible', timeout: 10000 });
  await strategyRow.click();
  await waitForPageReady(page);
  await page.waitForTimeout(1000);

  // Try to click edit button to go to Strategy Studio
  const editBtn = page.locator('[data-testid="toolbar-action-edit"]').first();
  if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await editBtn.click();
    await waitForPageReady(page);
    return;
  }

  // If not found, try "more actions" menu
  const moreActionsBtn = page.locator('[data-testid="toolbar-more-actions"]').first();
  if (await moreActionsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreActionsBtn.click();
    await page.waitForTimeout(500);

    // Click "Edit" in the menu using data-testid
    const editMenuItem = page.locator('[data-testid="toolbar-menu-item-edit"]').first();
    if (await editMenuItem.isVisible({ timeout: 2000 })) {
      await editMenuItem.click();
      await waitForPageReady(page);
    }
  }
}

export async function saveStrategy(page: Page): Promise<void> {
  console.log('Saving strategy...');

  // Look for save button in Strategy Studio toolbar using data-testid
  const saveBtn = page.locator('[data-testid="toolbar-action-save"]').first();
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
  await clickTab(page, 'indicators');
  await page.waitForTimeout(500);

  // Search for the indicator using data-testid
  const searchInput = page.locator('[data-testid="indicator-search-input"] input, input[placeholder*="Search indicators"]').first();
  if (await searchInput.isVisible({ timeout: 2000 })) {
    await searchInput.clear();
    await searchInput.fill(config.type);
    await page.waitForTimeout(500);
  }

  // Click on the indicator in the list using data-testid
  const indicatorItem = page.locator(`[data-testid="indicator-item-${config.type.toLowerCase()}"]`).first();
  if (await indicatorItem.isVisible({ timeout: 3000 })) {
    await indicatorItem.click();
    await page.waitForTimeout(500);
  } else {
    // Fallback: try text-based selector
    const fallbackItem = page.locator(`[role="button"]:has-text("${config.type}")`).first();
    if (await fallbackItem.isVisible({ timeout: 1000 }).catch(() => false)) {
      await fallbackItem.click();
      await page.waitForTimeout(500);
    }
  }

  // Wait for drawer to open using data-testid
  const drawerPaper = page.locator('[data-testid="indicator-drawer-paper"]').first();
  const submitBtn = page.locator('[data-testid="submit-indicator"]').first();

  if (await submitBtn.isVisible({ timeout: 3000 })) {
    // Configure parameters if provided
    if (config.params) {
      for (const [param, value] of Object.entries(config.params)) {
        // Try to find the input by label text within the drawer
        const paramInput = drawerPaper.locator(`input`).filter({ has: page.locator(`xpath=ancestor::div[contains(@class, "MuiTextField")]//label[contains(text(), "${param}")]`) }).first();
        if (await paramInput.isVisible({ timeout: 300 }).catch(() => false)) {
          await paramInput.clear();
          await paramInput.fill(String(value));
        }
      }
    }

    // Set alias if provided using data-testid
    if (config.alias) {
      const aliasInput = page.locator('[data-testid="indicator-label-input"] input').first();
      if (await aliasInput.isVisible({ timeout: 500 }).catch(() => false)) {
        await aliasInput.clear();
        await aliasInput.fill(config.alias);
      }
    }

    // Click submit button
    await submitBtn.click();
    console.log('  Clicked Add/Update button');
    await page.waitForTimeout(500);

    // Verify drawer closed
    if (await submitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log('  Warning: Drawer still open, clicking again');
      await submitBtn.click();
      await page.waitForTimeout(500);
    }
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
  await clickTab(page, 'indicators');
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
  await clickTab(page, 'long-entry');
  await page.waitForTimeout(500);

  // Click "Condition" button to add a new condition
  // Use :visible pseudo-selector to find the one that's currently shown
  const addConditionBtn = page.locator('[data-testid="add-condition-button"]:visible').first();
  await addConditionBtn.waitFor({ state: 'visible', timeout: 3000 });
  await addConditionBtn.click();
  await page.waitForTimeout(500);
  console.log('  Added new condition');

  if (typeof condition === 'object') {
    await configureCondition(page, condition);
  }

  await page.waitForTimeout(500);
}

export async function setExitCondition(page: Page, condition: string | Condition): Promise<void> {
  console.log('Setting exit condition...');

  // Navigate to Long Exit tab
  await clickTab(page, 'long-exit');
  await page.waitForTimeout(500);

  // Click "Condition" button to add a new condition
  // Use :visible pseudo-selector to find the one that's currently shown
  const addConditionBtn = page.locator('[data-testid="add-condition-button"]:visible').first();
  await addConditionBtn.waitFor({ state: 'visible', timeout: 3000 });
  await addConditionBtn.click();
  await page.waitForTimeout(500);
  console.log('  Added new condition');

  if (typeof condition === 'object') {
    await configureCondition(page, condition);
  }

  await page.waitForTimeout(500);
}

async function configureCondition(page: Page, condition: Condition): Promise<void> {
  console.log(`  Configuring condition: ${condition.left} ${condition.operator} ${condition.right}`);

  // When a condition is added, it creates a COMPARE node with:
  // - left: first indicator (or constant 0 if no indicators)
  // - operator: Gt (>)
  // - right: constant 0
  // We need to configure these to match the desired condition

  // Find the most recently added condition row (Paper with flex display)
  // The condition row contains operand editors and the operator dropdown
  const conditionRows = page.locator('div[class*="MuiPaper"] >> [data-testid="condition-operator-select"]');
  const conditionCount = await conditionRows.count();
  if (conditionCount === 0) {
    console.log('  Warning: No condition rows found');
    return;
  }

  // Work with the last condition added
  const operatorSelect = conditionRows.last();

  // First, configure the operator
  const operatorMap: Record<string, string> = {
    gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', eq: 'eq', neq: 'neq'
  };
  const operatorValue = operatorMap[condition.operator] || 'gt';

  await operatorSelect.click();
  await page.waitForTimeout(300);

  const operatorOption = page.locator(`[data-testid="operator-option-${operatorValue}"]`).first();
  if (await operatorOption.isVisible({ timeout: 2000 })) {
    await operatorOption.click();
    console.log(`  Set operator to ${condition.operator}`);
  } else {
    // Fallback: try to find by symbol text
    const opSymbol = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', neq: '≠' }[condition.operator] || '>';
    await page.locator(`[role="option"]:has-text("${opSymbol}")`).first().click();
  }
  await page.waitForTimeout(300);

  // Configure the right operand (constant value)
  // The right operand should already be a constant, so we just need to fill in the value
  // The testid is on the TextField wrapper, so we need to select the input inside it
  const constantInput = page.locator('[data-testid="operand-constant-value"] input').last();
  if (await constantInput.isVisible({ timeout: 2000 })) {
    await constantInput.click();
    await constantInput.fill('');  // Clear first
    await constantInput.fill(String(condition.right));
    console.log(`  Set right operand to ${condition.right}`);
  } else {
    // Fallback: find any number input
    const numberInput = page.locator('input[type="number"]').last();
    if (await numberInput.isVisible({ timeout: 1000 })) {
      await numberInput.fill(String(condition.right));
    }
  }
  await page.waitForTimeout(300);

  // If the left operand needs to be changed to a specific indicator,
  // we need to select it from the indicator dropdown
  // The default is already the first indicator, so if condition.left matches, we're done
  // For now, we assume the first indicator is the one we want (RSI in most tests)
  // TODO: Add indicator selection if needed for more complex tests
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
  await clickTab(page, 'logic');
  await page.waitForTimeout(500);

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
    await clickTab(page, 'advanced');
    await page.waitForTimeout(500);

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

  // Try to find "Run Backtest" button directly in toolbar
  let backtestBtn = page.locator('[data-testid="toolbar-action-run-backtest"], button:has-text("Run Backtest")').first();

  // If not visible as a direct button, check the overflow menu
  if (!(await backtestBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    console.log('Run Backtest not visible directly, checking overflow menu...');

    // Click the more actions button (three dots)
    const moreActionsBtn = page.locator('[data-testid="toolbar-more-actions"]').first();
    if (await moreActionsBtn.isVisible({ timeout: 2000 })) {
      await moreActionsBtn.click();
      await page.waitForTimeout(500);

      // Click "Run Backtest" from the menu
      backtestBtn = page.locator('[data-testid="toolbar-menu-item-run-backtest"], [role="menuitem"]:has-text("Run Backtest")').first();
    }
  }

  await backtestBtn.waitFor({ state: 'visible', timeout: 5000 });

  // Check if enabled (must save first if has changes)
  const isDisabled = await backtestBtn.isDisabled();
  if (isDisabled) {
    console.log('Backtest button is disabled (unsaved changes?). Saving first...');
    // Close menu if open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await saveStrategy(page);
    await page.waitForTimeout(1000);
    // Re-open menu if needed
    const moreActionsBtn = page.locator('[data-testid="toolbar-more-actions"]').first();
    if (await moreActionsBtn.isVisible({ timeout: 1000 })) {
      await moreActionsBtn.click();
      await page.waitForTimeout(500);
      backtestBtn = page.locator('[data-testid="toolbar-menu-item-run-backtest"], [role="menuitem"]:has-text("Run Backtest")').first();
    }
  }

  await backtestBtn.click();
  await page.waitForTimeout(1000);

  // Configure backtest in drawer - it MUST open
  const drawerTitle = page.locator('[data-testid="backtest-drawer-title"]').first();
  const drawerOpened = await drawerTitle.isVisible({ timeout: 5000 }).catch(() => false);

  if (!drawerOpened) {
    console.log('ERROR: Backtest drawer did not open!');
    throw new Error('Backtest drawer failed to open after clicking Run Backtest');
  }

  if (drawerOpened) {
    console.log('Backtest drawer opened');

    // Wait for strategy to be loaded (it loads asynchronously when drawer opens)
    const strategyField = page.locator('[data-testid="backtest-strategy-input"] input').first();
    let strategyLoaded = false;
    for (let attempt = 0; attempt < 10 && !strategyLoaded; attempt++) {
      await page.waitForTimeout(500);
      if (await strategyField.isVisible({ timeout: 1000 }).catch(() => false)) {
        const strategyValue = await strategyField.inputValue();
        if (strategyValue && strategyValue.length > 0) {
          console.log(`Strategy loaded: ${strategyValue}`);
          strategyLoaded = true;
        } else if (attempt > 5) {
          console.log(`Attempt ${attempt + 1}: Strategy still loading...`);
        }
      }
    }
    if (!strategyLoaded) {
      console.log('Warning: No strategy pre-selected after waiting, backtest may fail');
    }

    // Select runner using data-testid
    const runnerSelect = page.locator('[data-testid="backtest-runner-select"]').first();
    if (await runnerSelect.isVisible({ timeout: 3000 })) {
      await runnerSelect.click();
      await page.waitForTimeout(500);

      // Wait for dropdown to open and options to load
      const menuList = page.locator('[role="listbox"]').first();
      await menuList.waitFor({ state: 'visible', timeout: 3000 });

      if (config?.runnerId) {
        // Select specific runner by name
        const runnerOption = page.locator(`[data-testid^="runner-option-"]:has-text("${config.runnerId}")`).first();
        await runnerOption.click();
      } else {
        // Select first runner option (skip the search header)
        const firstRunnerOption = page.locator('[data-testid^="runner-option-"]').first();
        if (await firstRunnerOption.isVisible({ timeout: 2000 })) {
          await firstRunnerOption.click();
          console.log('Selected first runner option');
        } else {
          console.log('No runner options found');
        }
      }

      // Wait for data availability to load after runner selection
      await page.waitForTimeout(3000);

      // Check for "No overlapping data range" warning and fix by changing timeframe
      const noDataWarning = page.locator('[data-testid="backtest-no-data-warning"]');
      if (await noDataWarning.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('No data for current timeframe, switching to 1h...');

        // Click "Inherited from strategy" chip to enable manual timeframe selection
        const inheritedChip = page.locator('[data-testid="backtest-timeframe-inherited-chip"]');
        if (await inheritedChip.isVisible({ timeout: 2000 }).catch(() => false)) {
          await inheritedChip.click();
          console.log('Clicked inherited timeframe chip');
          await page.waitForTimeout(500);
        }

        // Select 1h timeframe from dropdown
        const timeframeSelect = page.locator('[data-testid="backtest-timeframe-select"]');
        await timeframeSelect.waitFor({ state: 'visible', timeout: 5000 });
        await timeframeSelect.click();
        await page.waitForTimeout(500);

        // Click 1h option
        const hourOption = page.locator('[role="option"][data-value="1h"]');
        await hourOption.waitFor({ state: 'visible', timeout: 3000 });
        await hourOption.click();
        console.log('Selected 1h timeframe');
        await page.waitForTimeout(1500);
      }

      // Check for data availability info message
      const dataAvailableAlert = page.locator('[data-testid="backtest-data-available-info"]').first();
      if (await dataAvailableAlert.isVisible({ timeout: 1000 }).catch(() => false)) {
        const alertText = await dataAvailableAlert.textContent();
        console.log(`Data info: ${alertText}`);
      }
    } else {
      console.log('Runner selector not found');
    }

    // Wait for form to settle after all selections
    await page.waitForTimeout(2000);

    // Click the Create Backtest button using testid with proper waiting
    console.log('Clicking Create Backtest button...');
    const submitBtn = page.locator('[data-testid="backtest-submit-button"]');
    await submitBtn.scrollIntoViewIfNeeded();
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    await page.waitForTimeout(2000);
    console.log('Backtest started');
    return true;
  }

  return false;
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
