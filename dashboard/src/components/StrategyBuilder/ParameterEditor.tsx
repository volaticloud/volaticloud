import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Paper,
  IconButton,
  Tooltip,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  InputAdornment,
} from '@mui/material';
import {
  Add,
  Delete,
  Info,
  TrendingDown,
  TrendingUp,
  Timeline,
} from '@mui/icons-material';
import { StrategyParameters } from './types';

interface ParameterEditorProps {
  value: StrategyParameters;
  onChange: (params: StrategyParameters) => void;
}

interface ROIEntry {
  minutes: number;
  roi: number;
}

export function ParameterEditor({ value, onChange }: ParameterEditorProps) {
  // Convert minimal_roi object to array for editing
  const roiEntries: ROIEntry[] = Object.entries(value.minimal_roi)
    .map(([minutes, roi]) => ({
      minutes: parseInt(minutes, 10),
      roi: roi as number,
    }))
    .sort((a, b) => a.minutes - b.minutes);

  const handleStoplossChange = (stoploss: number) => {
    onChange({ ...value, stoploss });
  };

  const handleTrailingStopChange = (enabled: boolean) => {
    onChange({
      ...value,
      trailing_stop: enabled,
      trailing_stop_positive: enabled ? value.trailing_stop_positive || 0.01 : undefined,
      trailing_stop_positive_offset: enabled ? value.trailing_stop_positive_offset || 0.01 : undefined,
    });
  };

  const handleTrailingPositiveChange = (positive: number) => {
    onChange({
      ...value,
      trailing_stop_positive: positive,
    });
  };

  const handleTrailingOffsetChange = (offset: number) => {
    onChange({
      ...value,
      trailing_stop_positive_offset: offset,
    });
  };

  const handleUseExitSignalChange = (useExit: boolean) => {
    onChange({ ...value, use_exit_signal: useExit });
  };

  const handleROIChange = (index: number, field: 'minutes' | 'roi', newValue: number) => {
    const newEntries = [...roiEntries];
    newEntries[index] = { ...newEntries[index], [field]: newValue };

    // Convert back to object
    const newROI: Record<string, number> = {};
    newEntries.forEach((entry) => {
      newROI[String(entry.minutes)] = entry.roi;
    });

    onChange({ ...value, minimal_roi: newROI });
  };

  const handleAddROI = () => {
    const lastMinutes = roiEntries.length > 0 ? roiEntries[roiEntries.length - 1].minutes : 0;
    const newMinutes = lastMinutes + 30;
    const newROI: Record<string, number> = {
      ...value.minimal_roi,
      [String(newMinutes)]: 0.01,
    };
    onChange({ ...value, minimal_roi: newROI });
  };

  const handleDeleteROI = (minutes: number) => {
    const newROI = { ...value.minimal_roi };
    delete newROI[String(minutes)];
    onChange({ ...value, minimal_roi: newROI });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Stoploss */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingDown color="error" />
          <Typography variant="subtitle2" fontWeight={600}>
            Stoploss
          </Typography>
          <Tooltip title="Maximum loss allowed before automatically closing a trade">
            <Info fontSize="small" color="action" />
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Slider
            value={Math.abs(value.stoploss) * 100}
            onChange={(_, newValue) => handleStoplossChange(-(newValue as number) / 100)}
            min={1}
            max={50}
            step={0.5}
            marks={[
              { value: 5, label: '5%' },
              { value: 10, label: '10%' },
              { value: 20, label: '20%' },
              { value: 50, label: '50%' },
            ]}
            sx={{ flex: 1 }}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `-${v}%`}
          />
          <TextField
            type="number"
            value={(value.stoploss * 100).toFixed(1)}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value)) handleStoplossChange(value / 100);
            }}
            size="small"
            sx={{ width: 100 }}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              },
              htmlInput: { step: 0.5 }
            }}
          />
        </Box>
      </Paper>

      {/* Minimal ROI */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TrendingUp color="success" />
          <Typography variant="subtitle2" fontWeight={600}>
            Minimal ROI
          </Typography>
          <Tooltip title="Minimum profit targets at different time points. Trade closes when target is reached.">
            <Info fontSize="small" color="action" />
          </Tooltip>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>After (minutes)</TableCell>
                <TableCell>Target ROI (%)</TableCell>
                <TableCell width={50}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roiEntries.map((entry, index) => (
                <TableRow key={entry.minutes}>
                  <TableCell>
                    <TextField
                      type="number"
                      value={entry.minutes}
                      onChange={(e) =>
                        handleROIChange(index, 'minutes', parseInt(e.target.value) || 0)
                      }
                      size="small"
                      sx={{ width: 80 }}
                      slotProps={{
                        htmlInput: { min: 0 }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={(entry.roi * 100).toFixed(1)}
                      onChange={(e) =>
                        handleROIChange(index, 'roi', parseFloat(e.target.value) / 100 || 0)
                      }
                      size="small"
                      sx={{ width: 80 }}
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        },
                        htmlInput: { step: 0.5 }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteROI(entry.minutes)}
                      disabled={roiEntries.length <= 1}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Button
          size="small"
          startIcon={<Add />}
          onClick={handleAddROI}
          sx={{ mt: 1 }}
        >
          Add ROI Target
        </Button>
      </Paper>

      {/* Trailing Stop */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Timeline color="primary" />
          <Typography variant="subtitle2" fontWeight={600}>
            Trailing Stop
          </Typography>
          <Tooltip title="Automatically adjusts stoploss as price moves in your favor">
            <Info fontSize="small" color="action" />
          </Tooltip>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={value.trailing_stop}
              onChange={(e) => handleTrailingStopChange(e.target.checked)}
            />
          }
          label="Enable trailing stop"
        />

        {value.trailing_stop && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Trailing Stop Positive
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                New stoploss level once profit exceeds offset
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Slider
                  value={(value.trailing_stop_positive || 0.01) * 100}
                  onChange={(_, newValue) => handleTrailingPositiveChange((newValue as number) / 100)}
                  min={0.1}
                  max={10}
                  step={0.1}
                  sx={{ flex: 1 }}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <TextField
                  type="number"
                  value={((value.trailing_stop_positive || 0.01) * 100).toFixed(1)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleTrailingPositiveChange(val / 100);
                  }}
                  size="small"
                  sx={{ width: 100 }}
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    },
                    htmlInput: { step: 0.1 }
                  }}
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Trailing Stop Positive Offset
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Minimum profit before trailing stop activates
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Slider
                  value={(value.trailing_stop_positive_offset || 0.01) * 100}
                  onChange={(_, newValue) => handleTrailingOffsetChange((newValue as number) / 100)}
                  min={0.1}
                  max={10}
                  step={0.1}
                  sx={{ flex: 1 }}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <TextField
                  type="number"
                  value={((value.trailing_stop_positive_offset || 0.01) * 100).toFixed(1)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleTrailingOffsetChange(val / 100);
                  }}
                  size="small"
                  sx={{ width: 100 }}
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    },
                    htmlInput: { step: 0.1 }
                  }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Exit Signal */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={value.use_exit_signal}
                onChange={(e) => handleUseExitSignalChange(e.target.checked)}
              />
            }
            label="Use exit signal"
          />
          <Tooltip title="Enable exit conditions to trigger trade closes">
            <Info fontSize="small" color="action" />
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary">
          When enabled, trades will close when exit conditions are met
        </Typography>
      </Paper>
    </Box>
  );
}
