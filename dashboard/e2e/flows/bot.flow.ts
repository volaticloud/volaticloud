/**
 * Bot Management Flow Helpers
 */
import { Page, expect } from '@playwright/test';
import { waitForPageReady } from './auth.flow';

export interface BotConfig {
  name: string;
  strategyName: string;
  exchangeName: string;
  runnerName: string;
  pairs?: string[];
  stakeAmount?: number;
  maxOpenTrades?: number;
}

export async function createBot(page: Page, config: BotConfig): Promise<void> {
  console.log(`Creating bot: ${config.name}`);

  await page.goto('/bots');
  await waitForPageReady(page);

  // Click create bot button using data-testid
  const createBtn = page.locator('[data-testid="create-bot-button"]').first();
  await createBtn.waitFor({ state: 'visible', timeout: 10000 });
  await createBtn.click();
  await page.waitForTimeout(1000);

  // Fill bot name using data-testid
  const nameInput = page.locator('[data-testid="bot-name-input"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(config.name);

  // Select strategy
  const strategySelect = page.locator('[data-testid="bot-strategy-select"], label:has-text("Strategy") ~ [role="combobox"]').first();
  if (await strategySelect.isVisible({ timeout: 3000 })) {
    await strategySelect.click();
    await page.waitForTimeout(500);
    await page.locator(`[role="option"]:has-text("${config.strategyName}")`).first().click();
    await page.waitForTimeout(500);
  }

  // Select exchange using data-testid
  const exchangeSelect = page.locator('[data-testid="bot-exchange-select"]').first();
  if (await exchangeSelect.isVisible({ timeout: 3000 })) {
    await exchangeSelect.click();
    await page.waitForTimeout(500);
    await page.locator(`[role="option"]:has-text("${config.exchangeName}")`).first().click();
    await page.waitForTimeout(500);
  }

  // Select runner
  const runnerSelect = page.locator('[data-testid="bot-runner-select"], label:has-text("Runner") ~ [role="combobox"]').first();
  if (await runnerSelect.isVisible({ timeout: 3000 })) {
    await runnerSelect.click();
    await page.waitForTimeout(500);
    await page.locator(`[role="option"]:has-text("${config.runnerName}")`).first().click();
    await page.waitForTimeout(500);
  }

  // Configure stake amount if provided
  if (config.stakeAmount !== undefined) {
    const stakeInput = page.locator('label:has-text("Stake Amount") ~ input, [data-testid*="stake"]').first();
    if (await stakeInput.isVisible({ timeout: 1000 })) {
      await stakeInput.clear();
      await stakeInput.fill(String(config.stakeAmount));
    }
  }

  // Configure max open trades if provided
  if (config.maxOpenTrades !== undefined) {
    const maxTradesInput = page.locator('label:has-text("Max Open Trades") ~ input, [data-testid*="max-trades"]').first();
    if (await maxTradesInput.isVisible({ timeout: 1000 })) {
      await maxTradesInput.clear();
      await maxTradesInput.fill(String(config.maxOpenTrades));
    }
  }

  // Submit using testid with proper waiting
  const submitBtn = page.locator('[data-testid="submit-create-bot"]');
  await submitBtn.scrollIntoViewIfNeeded();
  await expect(submitBtn).toBeEnabled({ timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(3000);
  await waitForPageReady(page);

  console.log(`Bot created: ${config.name}`);
}

export async function startBot(page: Page, botName: string): Promise<void> {
  console.log(`Starting bot: ${botName}`);

  await page.goto('/bots');
  await waitForPageReady(page);

  // Find bot row
  const botRow = page.locator(`tr:has-text("${botName}"), [data-testid*="bot"]:has-text("${botName}")`).first();

  // Click start button
  const startBtn = botRow.locator('button[aria-label*="start"], button:has-text("Start")').first();
  if (await startBtn.isVisible({ timeout: 3000 })) {
    await startBtn.click();
    await page.waitForTimeout(2000);
  }

  console.log(`Bot started: ${botName}`);
}

export async function stopBot(page: Page, botName: string): Promise<void> {
  console.log(`Stopping bot: ${botName}`);

  await page.goto('/bots');
  await waitForPageReady(page);

  const botRow = page.locator(`tr:has-text("${botName}"), [data-testid*="bot"]:has-text("${botName}")`).first();

  const stopBtn = botRow.locator('button[aria-label*="stop"], button:has-text("Stop")').first();
  if (await stopBtn.isVisible({ timeout: 3000 })) {
    await stopBtn.click();
    await page.waitForTimeout(2000);
  }

  console.log(`Bot stopped: ${botName}`);
}

export async function deleteBot(page: Page, botName: string): Promise<void> {
  console.log(`Deleting bot: ${botName}`);

  await page.goto('/bots');
  await waitForPageReady(page);

  const botRow = page.locator(`tr:has-text("${botName}"), [data-testid*="bot"]:has-text("${botName}")`).first();

  const deleteBtn = botRow.locator('button[aria-label*="delete"], svg[data-testid="DeleteIcon"]').first();
  if (await deleteBtn.isVisible({ timeout: 3000 })) {
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Confirm deletion
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  console.log(`Bot deleted: ${botName}`);
}

export async function verifyBotStatus(page: Page, botName: string, expectedStatus: 'running' | 'stopped' | 'error'): Promise<boolean> {
  await page.goto('/bots');
  await waitForPageReady(page);

  const botRow = page.locator(`tr:has-text("${botName}"), [data-testid*="bot"]:has-text("${botName}")`).first();
  const statusChip = botRow.locator(`.MuiChip-root:has-text("${expectedStatus}"), text=/${expectedStatus}/i`).first();

  return await statusChip.isVisible({ timeout: 5000 }).catch(() => false);
}

export async function openBotDetails(page: Page, botName: string): Promise<void> {
  await page.goto('/bots');
  await waitForPageReady(page);

  const botRow = page.locator(`tr:has-text("${botName}"), [data-testid*="bot"]:has-text("${botName}")`).first();
  await botRow.click();
  await waitForPageReady(page);
}
