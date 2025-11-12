import {
  Box,
  Typography,
  Chip,
  Divider,
  Card,
  CardContent,
} from '@mui/material';
import { Assessment } from '@mui/icons-material';
import { BacktestMetrics } from './BacktestMetrics';
import { BacktestTrades } from './BacktestTrades';

interface BacktestResultsProps {
  backtest: {
    id: string;
    status: string;
    createdAt: string;
    result?: any;
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

        {backtest.result && <BacktestTrades result={backtest.result} />}
      </CardContent>
    </Card>
  );
};