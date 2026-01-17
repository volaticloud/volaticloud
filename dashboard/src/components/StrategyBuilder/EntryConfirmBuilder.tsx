import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  Tooltip,
  Collapse,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Info,
  Security,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import {
  ConfirmEntryConfig,
  IndicatorDefinition,
  createAndNode,
} from './types';
import { ConditionNodeEditor } from './ConditionNode';

interface EntryConfirmBuilderProps {
  value: ConfirmEntryConfig | undefined;
  onChange: (config: ConfirmEntryConfig | undefined) => void;
  indicators: IndicatorDefinition[];
}

const DEFAULT_CONFIRM_ENTRY_CONFIG: ConfirmEntryConfig = {
  enabled: false,
  rules: createAndNode([]),
};

export function EntryConfirmBuilder({ value, onChange, indicators }: EntryConfirmBuilderProps) {
  const [expanded, setExpanded] = useState(true);

  const config = value || DEFAULT_CONFIRM_ENTRY_CONFIG;

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...config,
      enabled,
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
        <Security color={config.enabled ? 'success' : 'disabled'} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          Entry Confirmation
        </Typography>
        <Tooltip title="Additional filters checked before entering a trade (volume, spread, timing)">
          <Info fontSize="small" color="action" />
        </Tooltip>
        <Switch
          checked={config.enabled}
          onChange={(e) => handleToggleEnabled(e.target.checked)}
          size="small"
        />
      </Box>

      <Collapse in={expanded && config.enabled}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Define conditions that must be met before any trade is opened.
            Use this for volume filters, spread checks, or timing restrictions.
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Available Trade Context:</strong> volume_ratio, spread_pct, pair
            </Typography>
          </Alert>

          <ConditionNodeEditor
            node={config.rules}
            onChange={(rules) => onChange({ ...config, rules })}
            indicators={indicators}
            showTradeContext
          />
        </Box>
      </Collapse>

      {!config.enabled && expanded && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Enable to add pre-entry filters (volume, spread, time-based).
        </Typography>
      )}
    </Paper>
  );
}
