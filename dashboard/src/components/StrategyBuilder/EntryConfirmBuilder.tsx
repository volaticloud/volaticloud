import { Box, Typography, Alert } from '@mui/material';
import { Security } from '@mui/icons-material';
import { ConfirmEntryConfig, IndicatorDefinition } from './types';
import { ConditionNodeEditor } from './ConditionNode';
import { ToggleableSection } from './shared';
import { DEFAULT_CONFIRM_ENTRY_CONFIG } from './constants';

interface EntryConfirmBuilderProps {
  value: ConfirmEntryConfig | undefined;
  onChange: (config: ConfirmEntryConfig | undefined) => void;
  indicators: IndicatorDefinition[];
}

export function EntryConfirmBuilder({ value, onChange, indicators }: EntryConfirmBuilderProps) {
  const config = value || DEFAULT_CONFIRM_ENTRY_CONFIG;

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...config,
      enabled,
    });
  };

  return (
    <ToggleableSection
      title="Entry Confirmation"
      tooltip="Additional filters checked before entering a trade (volume, spread, timing)"
      icon={<Security color={config.enabled ? 'success' : 'disabled'} />}
      enabled={config.enabled}
      onToggle={handleToggleEnabled}
      disabledContent={
        <Typography variant="body2" color="text.secondary">
          Enable to add pre-entry filters (volume, spread, time-based).
        </Typography>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Define conditions that must be met before any trade is opened. Use this for volume filters,
        spread checks, or timing restrictions.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Available Trade Context:</strong> volume_ratio, spread_pct, pair
        </Typography>
      </Alert>

      <Box>
        <ConditionNodeEditor
          node={config.rules}
          onChange={(rules) => onChange({ ...config, rules })}
          indicators={indicators}
          showTradeContext
        />
      </Box>
    </ToggleableSection>
  );
}
