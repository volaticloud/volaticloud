import {
  Box,
  FormControlLabel,
  Switch,
  Typography,
  Paper,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Collapse,
  Alert,
} from '@mui/material';
import { ContentCopy, SwapHoriz } from '@mui/icons-material';
import { MirrorConfig, StrategySignalDirection, createDefaultMirrorConfig } from './types';

interface MirrorToggleProps {
  value: MirrorConfig | undefined;
  onChange: (config: MirrorConfig | undefined) => void;
  disabled?: boolean;
}

export function MirrorToggle({
  value,
  onChange,
  disabled = false,
}: MirrorToggleProps) {
  const config = value || createDefaultMirrorConfig();

  const handleEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newConfig = {
      ...config,
      enabled: event.target.checked,
    };
    onChange(newConfig);
  };

  const handleSourceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newConfig = {
      ...config,
      source: event.target.value as StrategySignalDirection,
    };
    onChange(newConfig);
  };

  const handleInvertComparisonsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newConfig = {
      ...config,
      invert_comparisons: event.target.checked,
    };
    onChange(newConfig);
  };

  const handleInvertCrossoversChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newConfig = {
      ...config,
      invert_crossovers: event.target.checked,
    };
    onChange(newConfig);
  };

  const targetDirection = config.source === StrategySignalDirection.Long
    ? StrategySignalDirection.Short
    : StrategySignalDirection.Long;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ContentCopy fontSize="small" color="action" />
        <Typography variant="subtitle2">
          Auto-Mirror Signals
        </Typography>
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={config.enabled}
            onChange={handleEnabledChange}
            disabled={disabled}
          />
        }
        label={
          <Box>
            <Typography variant="body2">
              Enable signal mirroring
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Automatically generate {targetDirection.toLowerCase()} signals from {config.source.toLowerCase()} conditions
            </Typography>
          </Box>
        }
      />

      <Collapse in={config.enabled}>
        <Box sx={{ mt: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">
              <Typography variant="body2" sx={{ mb: 1 }}>
                Source Direction
              </Typography>
            </FormLabel>
            <RadioGroup
              row
              value={config.source}
              onChange={handleSourceChange}
            >
              <FormControlLabel
                value={StrategySignalDirection.Long}
                control={<Radio size="small" />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Long
                    <SwapHoriz fontSize="small" />
                    Short
                  </Box>
                }
                disabled={disabled}
              />
              <FormControlLabel
                value={StrategySignalDirection.Short}
                control={<Radio size="small" />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Short
                    <SwapHoriz fontSize="small" />
                    Long
                  </Box>
                }
                disabled={disabled}
              />
            </RadioGroup>
          </FormControl>

          <Typography variant="body2" sx={{ mb: 1 }}>
            Inversion Options
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.invert_comparisons}
                  onChange={handleInvertComparisonsChange}
                  size="small"
                  disabled={disabled}
                />
              }
              label={
                <Typography variant="body2">
                  Invert comparisons (gt &rarr; lt, gte &rarr; lte)
                </Typography>
              }
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.invert_crossovers}
                  onChange={handleInvertCrossoversChange}
                  size="small"
                  disabled={disabled}
                />
              }
              label={
                <Typography variant="body2">
                  Invert crossovers (crossover &rarr; crossunder)
                </Typography>
              }
            />
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              Mirrored signals are generated at strategy compile time.
              Edit the source conditions to modify the mirrored signals.
            </Typography>
          </Alert>
        </Box>
      </Collapse>
    </Paper>
  );
}

export default MirrorToggle;
