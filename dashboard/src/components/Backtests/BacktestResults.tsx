import {
  Box,
  Typography,
  Chip,
  Divider,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
} from '@mui/material';
import { Assessment, ExpandMore, Code } from '@mui/icons-material';
import { BacktestMetrics } from './BacktestMetrics';
import { BacktestCharts } from './BacktestCharts';
import { extractStrategyData, extractTrades } from '../../types/freqtrade';

interface BacktestResultsProps {
  backtest: {
    id: string;
    status: string;
    createdAt: string;
    result?: any;
    logs?: string | null;
    errorMessage?: string | null;
    summary?: {
      totalTrades: number;
      wins: number;
      losses: number;
      winRate?: number | null;
      profitTotal?: number | null;
      maxDrawdown?: number | null;
      profitFactor?: number | null;
      expectancy?: number | null;
    } | null;
  };
}

export const BacktestResults = ({ backtest }: BacktestResultsProps) => {
  // Extract strategy data and trades for charts
  const strategyData = backtest.result ? extractStrategyData(backtest.result) : null;
  const trades = backtest.result ? extractTrades(backtest.result) : [];

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment />
            <Typography variant="h6">Backtest Results</Typography>
          </Box>
          <Chip
            label={backtest.status}
            color={
              backtest.status === 'completed' ? 'success' :
              backtest.status === 'running' ? 'primary' :
              backtest.status === 'failed' ? 'error' : 'default'
            }
            size="small"
          />
        </Box>
        <Divider sx={{ mb: 2 }} />

        <BacktestMetrics
          status={backtest.status}
          summary={backtest.summary}
          createdAt={backtest.createdAt}
        />

        {/* Charts Section */}
        {backtest.status === 'completed' && strategyData && trades.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <BacktestCharts
              strategyData={strategyData}
              trades={trades}
              exchange="binance"
              timeframe={strategyData.timeframe}
              backtestStart={strategyData.backtest_start}
              backtestEnd={strategyData.backtest_end}
            />
          </Box>
        )}

        {/* Backtest Logs */}
        {backtest.logs && (
          <Accordion sx={{ mt: 3 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" alignItems="center">
                <Code sx={{ mr: 1 }} />
                <Typography variant="h6">Backtest Logs</Typography>
                <Chip
                  label={`${backtest.logs.length} bytes`}
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  maxHeight: '500px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {backtest.logs}
              </Paper>
            </AccordionDetails>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};