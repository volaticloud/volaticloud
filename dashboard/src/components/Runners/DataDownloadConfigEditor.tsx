import {
  Box,
  Typography,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  IconButton,
  Chip,
  Card,
  CardContent,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import type { DataDownloadConfigInput, DataDownloadExchangeConfigInput } from '../../generated/types';

interface DataDownloadConfigEditorProps {
  value: DataDownloadConfigInput | null;
  onChange: (config: DataDownloadConfigInput) => void;
}

const AVAILABLE_EXCHANGES = ['binance', 'bybit', 'kraken', 'okx', 'coinbase', 'kucoin'];
const AVAILABLE_TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w'];
const TRADING_MODES = ['spot', 'futures', 'margin'];

export const DataDownloadConfigEditor = ({ value, onChange }: DataDownloadConfigEditorProps) => {
  const [config, setConfig] = useState<DataDownloadConfigInput>(
    value || { exchanges: [] }
  );

  const handleAddExchange = () => {
    const newExchange: DataDownloadExchangeConfigInput = {
      name: 'binance',
      enabled: true,
      timeframes: ['1h', '1d'],
      pairsPattern: '.*/USDT',
      days: 365,
      tradingMode: 'spot',
    };

    const updatedConfig = {
      exchanges: [...(config.exchanges || []), newExchange],
    };
    setConfig(updatedConfig);
    onChange(updatedConfig);
  };

  const handleRemoveExchange = (index: number) => {
    const updatedConfig = {
      exchanges: (config.exchanges || []).filter((_, i) => i !== index),
    };
    setConfig(updatedConfig);
    onChange(updatedConfig);
  };

  const handleExchangeChange = (index: number, field: keyof DataDownloadExchangeConfigInput, value: any) => {
    const updatedExchanges = [...(config.exchanges || [])];
    updatedExchanges[index] = {
      ...updatedExchanges[index],
      [field]: value,
    };

    const updatedConfig = { exchanges: updatedExchanges };
    setConfig(updatedConfig);
    onChange(updatedConfig);
  };

  const handleTimeframeToggle = (index: number, timeframe: string) => {
    const exchanges = config.exchanges || [];
    const exchange = exchanges[index];
    const currentTimeframes = exchange.timeframes || [];
    const newTimeframes = currentTimeframes.includes(timeframe)
      ? currentTimeframes.filter(tf => tf !== timeframe)
      : [...currentTimeframes, timeframe];

    handleExchangeChange(index, 'timeframes', newTimeframes);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Data Download Configuration</Typography>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddExchange}
          variant="outlined"
          size="small"
        >
          Add Exchange
        </Button>
      </Box>

      {(config.exchanges || []).length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No exchanges configured. Click "Add Exchange" to start configuring data downloads.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {config.exchanges.map((exchange, index) => (
            <Accordion key={index} defaultExpanded={index === config.exchanges.length - 1}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <Typography fontWeight={500}>{exchange.name}</Typography>
                  <Chip
                    label={exchange.enabled ? 'Enabled' : 'Disabled'}
                    color={exchange.enabled ? 'success' : 'default'}
                    size="small"
                  />
                  {exchange.enabled && (
                    <Typography variant="caption" color="text.secondary">
                      {exchange.timeframes?.length || 0} timeframes, {exchange.days} days
                    </Typography>
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={exchange.enabled}
                          onChange={(e) => handleExchangeChange(index, 'enabled', e.target.checked)}
                        />
                      }
                      label="Enable this exchange"
                    />
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveExchange(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <FormControl fullWidth size="small">
                    <InputLabel>Exchange</InputLabel>
                    <Select
                      value={exchange.name}
                      label="Exchange"
                      onChange={(e) => handleExchangeChange(index, 'name', e.target.value)}
                    >
                      {AVAILABLE_EXCHANGES.map((ex) => (
                        <MenuItem key={ex} value={ex}>
                          {ex}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {exchange.enabled && (
                    <>
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Timeframes
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {AVAILABLE_TIMEFRAMES.map((tf) => (
                            <Chip
                              key={tf}
                              label={tf}
                              onClick={() => handleTimeframeToggle(index, tf)}
                              color={exchange.timeframes?.includes(tf) ? 'primary' : 'default'}
                              variant={exchange.timeframes?.includes(tf) ? 'filled' : 'outlined'}
                              size="small"
                            />
                          ))}
                        </Box>
                      </Box>

                      <TextField
                        label="Pairs Pattern"
                        value={exchange.pairsPattern}
                        onChange={(e) => handleExchangeChange(index, 'pairsPattern', e.target.value)}
                        size="small"
                        fullWidth
                        helperText="Use .*/USDT for all USDT pairs, or specify pairs like BTC/USDT ETH/USDT"
                      />

                      <TextField
                        label="Days of History"
                        type="number"
                        value={exchange.days}
                        onChange={(e) => handleExchangeChange(index, 'days', parseInt(e.target.value))}
                        size="small"
                        fullWidth
                        inputProps={{ min: 1, max: 730 }}
                        helperText="Number of days of historical data to download (1-730)"
                      />

                      <FormControl fullWidth size="small">
                        <InputLabel>Trading Mode</InputLabel>
                        <Select
                          value={exchange.tradingMode}
                          label="Trading Mode"
                          onChange={(e) => handleExchangeChange(index, 'tradingMode', e.target.value)}
                        >
                          {TRADING_MODES.map((mode) => (
                            <MenuItem key={mode} value={mode}>
                              {mode}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );
};