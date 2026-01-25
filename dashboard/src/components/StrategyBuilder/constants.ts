/**
 * Default configurations for Strategy Builder components.
 * Centralized here for consistency and easy maintenance.
 */

import { DCAConfig, CustomStoplossConfig, ConfirmEntryConfig, createAndNode, createId } from './types';

/**
 * Default DCA (Dollar Cost Averaging) configuration
 */
export const DEFAULT_DCA_CONFIG: DCAConfig = {
  enabled: false,
  max_entries: 3,
  rules: [
    { id: createId(), price_drop_percent: 5, stake_multiplier: 1.5 },
    { id: createId(), price_drop_percent: 10, stake_multiplier: 2.0 },
  ],
  cooldown_minutes: 60,
};

/**
 * Default Custom Stoploss configuration
 */
export const DEFAULT_STOPLOSS_CONFIG: CustomStoplossConfig = {
  enabled: false,
  rules: [],
  default_stoploss: -0.1,
  trailing: {
    enabled: false,
    positive: 0.01,
    positive_offset: 0.02,
  },
};

/**
 * Default Entry Confirmation configuration
 */
export const DEFAULT_CONFIRM_ENTRY_CONFIG: ConfirmEntryConfig = {
  enabled: false,
  rules: createAndNode([]),
};
