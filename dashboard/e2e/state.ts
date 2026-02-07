/**
 * Shared E2E State Management
 *
 * This module provides state sharing between test files in the E2E pipeline.
 * State is persisted to a JSON file so it survives between test projects.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, '.e2e-state.json');

export interface E2EState {
  // Organization
  orgId?: string;
  orgName?: string;
  orgAlias?: string;

  // Subscription
  isSubscribed?: boolean;
  creditBalance?: number;

  // Runner
  runnerId?: string;
  runnerName?: string;
  runnerDataReady?: boolean;

  // Strategy
  strategyId?: string;
  strategyName?: string;

  // Bot
  botId?: string;
  botName?: string;

  // Timestamps
  createdAt?: string;
  lastUpdated?: string;
}

/**
 * Read current state from file
 */
export function readState(): E2EState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('Failed to read E2E state:', err);
  }
  return {};
}

/**
 * Write state to file (merges with existing)
 */
export function writeState(updates: Partial<E2EState>): E2EState {
  const current = readState();
  const newState: E2EState = {
    ...current,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  if (!newState.createdAt) {
    newState.createdAt = newState.lastUpdated;
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
  console.log('E2E State updated:', newState);
  return newState;
}

/**
 * Clear state (for fresh test runs)
 */
export function clearState(): void {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    console.log('E2E State cleared');
  }
}

/**
 * Check if setup has been completed
 */
export function isSetupComplete(): boolean {
  const state = readState();
  return !!(state.orgId && state.isSubscribed && state.runnerId && state.runnerDataReady);
}

/**
 * Get URL with org context
 * Ensures navigation goes to the correct organization
 */
export function getOrgUrl(path: string): string {
  const state = readState();
  const orgAlias = state.orgAlias;

  if (!orgAlias) {
    return path;
  }

  // Use URL API for proper URL construction (avoids manual string concatenation bugs)
  const url = new URL(path, 'https://placeholder.local');
  url.searchParams.set('orgId', orgAlias);
  return url.pathname + url.search;
}

/**
 * Get required state or throw
 */
export function requireState<K extends keyof E2EState>(key: K): NonNullable<E2EState[K]> {
  const state = readState();
  const value = state[key];
  if (value === undefined || value === null) {
    throw new Error(`E2E State missing required key: ${key}. Run setup first.`);
  }
  return value as NonNullable<E2EState[K]>;
}
