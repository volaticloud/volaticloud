import {
  Box,
  FormControl,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Tooltip,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AccountBalance,
  ShowChart,
  CandlestickChart,
} from '@mui/icons-material';
import { TradingMode } from './types';

interface TradingModeSelectorProps {
  value: TradingMode;
  onChange: (mode: TradingMode) => void;
  disabled?: boolean;
}

const MODE_INFO: Record<TradingMode, {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  features: string[];
}> = {
  [TradingMode.Spot]: {
    icon: <AccountBalance />,
    label: 'Spot',
    description: 'Standard spot trading - buy and sell assets directly',
    color: '#4caf50',
    features: ['Long positions only', 'No leverage', 'Simplest mode'],
  },
  [TradingMode.Margin]: {
    icon: <ShowChart />,
    label: 'Margin',
    description: 'Margin trading with borrowed funds',
    color: '#ff9800',
    features: ['Long & short positions', 'Leverage available', 'Higher risk/reward'],
  },
  [TradingMode.Futures]: {
    icon: <CandlestickChart />,
    label: 'Futures',
    description: 'Perpetual futures/derivatives trading',
    color: '#f44336',
    features: ['Long & short positions', 'Leverage available', 'Funding rates apply'],
  },
};

export function TradingModeSelector({
  value,
  onChange,
  disabled = false,
}: TradingModeSelectorProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleChange = (_event: React.MouseEvent<HTMLElement>, newValue: TradingMode | null) => {
    if (newValue !== null) {
      onChange(newValue);
    }
  };

  const currentInfo = MODE_INFO[value];

  return (
    <FormControl component="fieldset" fullWidth>
      <FormLabel component="legend">
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Trading Mode
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
        {Object.entries(MODE_INFO).map(([mode, info]) => (
          <Tooltip key={mode} title={info.description} arrow>
            {/* span wrapper needed for Tooltip to work when button is disabled */}
            <span>
              <ToggleButton
                value={mode}
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
        ))}
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: currentInfo.color,
            mt: 0.75,
          }}
        />
        <Box>
          <Typography variant="body2" color="text.secondary">
            {currentInfo.description}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            {currentInfo.features.map((feature, idx) => (
              <Typography
                key={idx}
                variant="caption"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  backgroundColor: `${currentInfo.color}10`,
                  color: currentInfo.color,
                }}
              >
                {feature}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      {(value === TradingMode.Margin || value === TradingMode.Futures) && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {value === TradingMode.Futures
            ? 'Futures trading involves leverage and higher risk. Make sure your exchange and bot are configured for futures trading.'
            : 'Margin trading involves borrowed funds and higher risk. Make sure your exchange supports margin trading.'}
        </Alert>
      )}
    </FormControl>
  );
}

export default TradingModeSelector;
