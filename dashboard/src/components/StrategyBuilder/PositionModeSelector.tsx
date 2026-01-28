import {
  Box,
  FormControl,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  SwapVert,
} from '@mui/icons-material';
import { PositionMode } from './types';

interface PositionModeSelectorProps {
  value: PositionMode;
  onChange: (mode: PositionMode) => void;
  disabled?: boolean;
  /** If false, short-related options will be disabled */
  allowShort?: boolean;
}

const MODE_INFO: Record<PositionMode, { icon: React.ReactNode; label: string; description: string; color: string }> = {
  [PositionMode.LongOnly]: {
    icon: <TrendingUp />,
    label: 'Long Only',
    description: 'Only open long positions (buy low, sell high)',
    color: '#4caf50',
  },
  [PositionMode.ShortOnly]: {
    icon: <TrendingDown />,
    label: 'Short Only',
    description: 'Only open short positions (sell high, buy low)',
    color: '#f44336',
  },
  [PositionMode.LongAndShort]: {
    icon: <SwapVert />,
    label: 'Long & Short',
    description: 'Trade both directions based on market conditions',
    color: '#2196f3',
  },
};

export function PositionModeSelector({
  value,
  onChange,
  disabled = false,
  allowShort = true,
}: PositionModeSelectorProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleChange = (_event: React.MouseEvent<HTMLElement>, newValue: PositionMode | null) => {
    if (newValue !== null) {
      onChange(newValue);
    }
  };

  const currentInfo = MODE_INFO[value];

  // Check if a mode requires shorting
  const requiresShort = (mode: PositionMode) =>
    mode === PositionMode.ShortOnly || mode === PositionMode.LongAndShort;

  return (
    <FormControl component="fieldset" fullWidth>
      <FormLabel component="legend">
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Position Mode
        </Typography>
      </FormLabel>

      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={handleChange}
        disabled={disabled}
        fullWidth
        orientation={isMobile ? 'vertical' : 'horizontal'}
        sx={{ mb: 1 }}
      >
        {Object.entries(MODE_INFO).map(([mode, info]) => {
          const modeValue = mode as PositionMode;
          const isDisabledDueToShort = !allowShort && requiresShort(modeValue);
          const tooltipTitle = isDisabledDueToShort
            ? `${info.description} (Requires Margin or Futures trading mode)`
            : info.description;

          return (
            <Tooltip key={mode} title={tooltipTitle} arrow>
              {/* span wrapper needed for Tooltip to work when button is disabled */}
              <span>
                <ToggleButton
                  value={mode}
                  disabled={disabled || isDisabledDueToShort}
                  sx={{
                    whiteSpace: 'nowrap',
                    '&.Mui-selected': {
                      backgroundColor: `${info.color}20`,
                      borderColor: info.color,
                      color: info.color,
                      '&:hover': {
                        backgroundColor: `${info.color}30`,
                      },
                    },
                    '& .MuiSvgIcon-root': {
                      mr: 1,
                      flexShrink: 0,
                    },
                  }}
                >
                  {info.icon}
                  {info.label}
                </ToggleButton>
              </span>
            </Tooltip>
          );
        })}
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: currentInfo.color,
          }}
        />
        <Typography variant="body2" color="text.secondary">
          {currentInfo.description}
        </Typography>
      </Box>
    </FormControl>
  );
}

export default PositionModeSelector;
