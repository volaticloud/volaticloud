import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import { Close, OpenInNew } from '@mui/icons-material';
import { useGetBacktestQuery } from './backtests.generated';
import { BacktestResults } from './BacktestResults';
import { useOrganizationNavigate } from '../../contexts/OrganizationContext';

interface BacktestResultsDialogProps {
  open: boolean;
  onClose: () => void;
  backtestId: string | null;
  polling?: boolean;
}

export const BacktestResultsDialog = ({
  open,
  onClose,
  backtestId,
  polling = true,
}: BacktestResultsDialogProps) => {
  const navigate = useOrganizationNavigate();

  const { data, loading, error } = useGetBacktestQuery({
    variables: { id: backtestId! },
    skip: !backtestId || !open,
    pollInterval: polling ? 3000 : 0,
  });

  const backtest = data?.backtests?.edges?.[0]?.node;

  const handleViewDetails = () => {
    if (backtestId) {
      navigate(`/backtests/${backtestId}`);
      onClose();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'info';
      case 'failed':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh', maxHeight: '90vh' },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">Backtest Results</Typography>
            {backtest && (
              <Chip
                label={backtest.status}
                color={getStatusColor(backtest.status)}
                size="small"
              />
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && !backtest && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error">
            Error loading backtest: {error.message}
          </Alert>
        )}

        {backtest && (
          <BacktestResults
            backtest={{
              id: backtest.id,
              status: backtest.status,
              createdAt: backtest.createdAt,
              result: backtest.result,
              logs: backtest.logs,
              errorMessage: backtest.errorMessage,
              summary: backtest.result ? {
                totalTrades: backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.total_trades || 0,
                wins: backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.wins || 0,
                losses: backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.losses || 0,
                winRate: backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.wins
                  ? (backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.wins /
                     backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.total_trades)
                  : null,
                profitTotal: backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.profit_total || null,
                maxDrawdown: backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.max_drawdown || null,
                profitFactor: backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.profit_factor || null,
                expectancy: backtest.result?.strategy?.[Object.keys(backtest.result?.strategy || {})[0]]?.expectancy || null,
              } : null,
            }}
          />
        )}

        {!loading && !error && !backtest && (
          <Alert severity="info">
            No backtest data available
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {backtest && (
          <Button
            variant="outlined"
            startIcon={<OpenInNew />}
            onClick={handleViewDetails}
          >
            View Full Details
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};