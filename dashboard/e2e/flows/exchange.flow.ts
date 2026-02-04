/**
 * Exchange Flow Helpers
 */
import { Page } from '@playwright/test';
import { waitForPageReady } from './auth.flow';

export interface ExchangeConfig {
  name: string;
  type?: string;  // binance, kraken, etc.
  apiKey?: string;
  apiSecret?: string;
}

export async function createExchange(page: Page, config: ExchangeConfig): Promise<void> {
  console.log(`Creating exchange: ${config.name}`);

  await page.goto('/exchanges');
  await waitForPageReady(page);

  // Click add exchange button
  const addBtn = page.locator('button:has-text("Add Exchange")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 10000 });
  await addBtn.click();
  await page.waitForTimeout(1000);

  // Fill exchange name
  await page.getByLabel('Exchange Name').fill(config.name);

  // The FreqtradeConfigForm has defaults for dry-run mode
  // Only fill API keys if provided (for live trading)
  if (config.apiKey) {
    const apiKeyInput = page.locator('input[name*="key"], label:has-text("API Key") + input').first();
    if (await apiKeyInput.isVisible({ timeout: 1000 })) {
      await apiKeyInput.fill(config.apiKey);
    }
  }

  if (config.apiSecret) {
    const apiSecretInput = page.locator('input[name*="secret"], label:has-text("Secret") + input').first();
    if (await apiSecretInput.isVisible({ timeout: 1000 })) {
      await apiSecretInput.fill(config.apiSecret);
    }
  }

  // Submit
  await page.locator('[data-testid="submit-add-exchange"]').click();
  await page.waitForTimeout(3000);
  await waitForPageReady(page);

  console.log(`Exchange created: ${config.name}`);
}

export async function verifyExchangeExists(page: Page, name: string): Promise<boolean> {
  await page.goto('/exchanges');
  await waitForPageReady(page);

  const exchangeRow = page.locator(`tr:has-text("${name}"), [data-testid*="exchange"]:has-text("${name}")`).first();
  return await exchangeRow.isVisible({ timeout: 5000 }).catch(() => false);
}
