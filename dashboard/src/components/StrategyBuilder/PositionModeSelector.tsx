import {
  Box,
  FormControl,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Tooltip,
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
}: PositionModeSelectorProps) {
  const handleChange = (_event: React.MouseEvent<HTMLElement>, newValue: PositionMode | null) => {
    if (newValue !== null) {
      onChange(newValue);
    }
  };

  const currentInfo = MODE_INFO[value];

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
        sx={{ mb: 1 }}
      >
        {Object.entries(MODE_INFO).map(([mode, info]) => (
          <Tooltip key={mode} title={info.description} arrow>
            <ToggleButton
              value={mode}
              sx={{
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
                },
              }}
            >
              {info.icon}
              {info.label}
            </ToggleButton>
          </Tooltip>
        ))}
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
