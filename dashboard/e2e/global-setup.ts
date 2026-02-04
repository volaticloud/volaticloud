/**
 * Global Setup - Authenticates once and saves session for all tests
 *
 * This runs BEFORE any tests and:
 * 1. Signs in via Keycloak
 * 2. Saves cookies + localStorage to .auth/user.json
 * 3. All tests reuse this auth state (no repeated sign-ins!)
 */
import { chromium, FullConfig } from '@playwright/test';
import { signIn } from './auth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

export default async function globalSetup(config: FullConfig) {
  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Check if we already have valid auth state
  if (fs.existsSync(AUTH_FILE)) {
    const stats = fs.statSync(AUTH_FILE);
    const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;

    // Reuse auth if less than 30 minutes old
    if (ageMinutes < 30) {
      console.log(`[Global Setup] Reusing existing auth state (${Math.round(ageMinutes)}min old)`);
      return;
    }
  }

  console.log('[Global Setup] Authenticating...');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
  });

  const context = await browser.newContext({
    baseURL: config.projects[0]?.use?.baseURL || 'https://console.volaticloud.loc',
  });

  const page = await context.newPage();

  try {
    // Sign in
    await signIn(page);

    // Wait for app to fully load
    await page.waitForTimeout(2000);

    // Save storage state (cookies + localStorage)
    await context.storageState({ path: AUTH_FILE });

    console.log('[Global Setup] Auth state saved to', AUTH_FILE);
  } finally {
    await browser.close();
  }
}

export { AUTH_FILE };
