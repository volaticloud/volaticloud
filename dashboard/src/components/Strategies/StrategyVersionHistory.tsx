import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Collapse,
} from '@mui/material';
import {
  History as HistoryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Assessment,
} from '@mui/icons-material';
import { useState } from 'react';

interface Version {
  id: string;
  versionNumber: number;
  version?: string | null;
  isLatest: boolean;
  createdAt: string;
  bots?: {
    totalCount: number;
  };
  backtest?: {
    id: string;
    status: string;
    summary?: {
      totalTrades: number;
      wins: number;
      losses: number;
      winRate?: number | null;
      profitTotal?: number | null;
      profitTotalAbs?: number | null;
      maxDrawdown?: number | null;
      profitFactor?: number | null;
    } | null;
  } | null;
}

interface StrategyVersionHistoryProps {
  currentStrategyId: string;
  versions: Version[];
  loading: boolean;
  onVersionClick: (versionId: string) => void;
}

export const StrategyVersionHistory = ({
  currentStrategyId,
  versions,
  loading,
  onVersionClick,
}: StrategyVersionHistoryProps) => {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: open ? 2 : 0,
            cursor: 'pointer',
          }}
          onClick={() => setOpen(!open)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            <Typography variant="h6">Version History</Typography>
          </Box>
          <IconButton size="small">
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        <Collapse in={open}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={2}>
              <CircularProgress size={24} />
            </Box>
          ) : versions && versions.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Version</TableCell>
                    <TableCell align="center">Bots</TableCell>
                    <TableCell align="center">Backtest</TableCell>
                    <TableCell align="right">Trades</TableCell>
                    <TableCell align="right">Win Rate</TableCell>
                    <TableCell align="right">Profit</TableCell>
                    <TableCell align="right">Max DD</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {versions
                    .slice()
                    .sort((a, b) => b.versionNumber - a.versionNumber)
                    .map((version) => (
                      <TableRow
                        key={version.id}
                        hover
                        selected={version.id === currentStrategyId}
                        sx={{
                          backgroundColor:
                            version.id === currentStrategyId
                              ? 'action.selected'
                              : undefined,
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={`v${version.versionNumber}`}
                              size="small"
                              color="primary"
                              variant={version.id === currentStrategyId ? 'filled' : 'outlined'}
                            />
                            {version.isLatest && (
                              <Chip label="Latest" size="small" color="success" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="center">{version.bots?.totalCount || 0}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={version.backtest?.status || 'N/A'}
                            size="small"
                            color={version.backtest?.status === 'completed' ? 'success' : version.backtest?.status === 'failed' ? 'error' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">
                            {version.backtest?.summary?.totalTrades ?? '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="caption"
                            color={
                              version.backtest?.summary?.winRate
                                ? version.backtest.summary.winRate * 100 >= 50
                                  ? 'success.main'
                                  : 'text.secondary'
                                : 'text.secondary'
                            }
                          >
                            {version.backtest?.summary?.winRate
                              ? `${(version.backtest.summary.winRate * 100).toFixed(1)}%`
                              : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="caption"
                            color={
                              version.backtest?.summary?.profitTotal
                                ? version.backtest.summary.profitTotal >= 0
                                  ? 'success.main'
                                  : 'error.main'
                                : 'text.secondary'
                            }
                          >
                            {version.backtest?.summary?.profitTotal
                              ? `${version.backtest.summary.profitTotal.toFixed(2)}%`
                              : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="error.main">
                            {version.backtest?.summary?.maxDrawdown
                              ? `${(version.backtest.summary.maxDrawdown * 100).toFixed(1)}%`
                              : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(version.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {version.id !== currentStrategyId && (
                            <Tooltip title="View Version">
                              <IconButton
                                size="small"
                                onClick={() => onVersionClick(version.id)}
                              >
                                <Assessment fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No other versions available.</Alert>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};
