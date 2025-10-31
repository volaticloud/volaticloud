import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RestartIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetBotsQuery, useStartBotMutation, useStopBotMutation, useRestartBotMutation } from '../../generated/graphql';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { CreateBotDialog } from './CreateBotDialog';
import { EditBotDialog } from './EditBotDialog';
import { DeleteBotDialog } from './DeleteBotDialog';

// Reusable BotsList component
export const BotsList = () => {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBot, setSelectedBot] = useState<{
    id: string;
    name: string;
    mode: string;
    exchange: { id: string; name: string };
    strategy: { id: string; name: string };
    runner: { id: string; name: string };
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  // Use generated Apollo hooks with polling for real-time updates
  const { data, loading, error, refetch } = useGetBotsQuery({
    variables: { first: 50 },
    pollInterval: 30000, // Poll every 30 seconds to sync with monitor interval
  });

  // Mutations with refetch on completion
  const [startBot] = useStartBotMutation({
    onCompleted: () => refetch()
  });

  const [stopBot] = useStopBotMutation({
    onCompleted: () => refetch()
  });

  const [restartBot] = useRestartBotMutation({
    onCompleted: () => refetch()
  });

  const handleStartBot = async (id: string) => {
    try {
      const result = await startBot({ variables: { id } });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.startBot) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to start bot';
        setSnackbar({
          open: true,
          message: errorMsg,
          severity: 'error',
        });
      } else {
        setSnackbar({
          open: true,
          message: 'Bot started successfully',
          severity: 'success',
        });
      }
    } catch (err) {
      // Catch network errors
      console.error('Failed to start bot:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to start bot',
        severity: 'error',
      });
    }
  };

  const handleStopBot = async (id: string) => {
    try {
      const result = await stopBot({ variables: { id } });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.stopBot) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to stop bot';
        setSnackbar({
          open: true,
          message: errorMsg,
          severity: 'error',
        });
      } else {
        setSnackbar({
          open: true,
          message: 'Bot stopped successfully',
          severity: 'success',
        });
      }
    } catch (err) {
      // Catch network errors
      console.error('Failed to stop bot:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to stop bot',
        severity: 'error',
      });
    }
  };

  const handleRestartBot = async (id: string) => {
    try {
      const result = await restartBot({ variables: { id } });

      // Check for GraphQL errors (errorPolicy: 'all' means errors don't throw)
      if (result.errors || !result.data?.restartBot) {
        const errorMsg = result.errors?.[0]?.message || 'Failed to restart bot';
        setSnackbar({
          open: true,
          message: errorMsg,
          severity: 'error',
        });
      } else {
        setSnackbar({
          open: true,
          message: 'Bot restarted successfully',
          severity: 'success',
        });
      }
    } catch (err) {
      // Catch network errors
      console.error('Failed to restart bot:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to restart bot',
        severity: 'error',
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'unhealthy':
        return 'warning'; // Orange/yellow for unhealthy but running
      case 'stopped':
        return 'default';
      case 'creating':
        return 'info';
      case 'error':
        return 'error';
      case 'backtesting':
      case 'hyperopt':
        return 'info';
      default:
        return 'default';
    }
  };

  // Helper to check if bot can be started
  const canStart = (status: string) => {
    return status === 'stopped' || status === 'error';
  };

  // Helper to check if bot can be stopped/restarted
  const canStopOrRestart = (status: string) => {
    return status === 'running' || status === 'unhealthy';
  };

  if (loading) return <LoadingSpinner message="Loading bots..." />;
  if (error) return <ErrorAlert error={error} />;

  const bots = (data?.bots?.edges
    ?.map(edge => edge?.node)
    .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined) || []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            Bots
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.bots?.totalCount || 0} total bots
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Bot
        </Button>
      </Box>

      {bots.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No bots yet. Create your first bot to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Exchange</TableCell>
                <TableCell>Strategy</TableCell>
                <TableCell>Runner</TableCell>
                <TableCell>Version</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bots.map((bot) => (
                <TableRow
                  key={bot.id}
                  hover
                  onClick={() => navigate(`/bots/${bot.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {bot.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={bot.status}
                      color={getStatusColor(bot.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={bot.mode}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{bot.exchange.name}</TableCell>
                  <TableCell>{bot.strategy.name}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {bot.runner.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {bot.runner.type}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {bot.freqtradeVersion}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Start">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartBot(bot.id);
                        }}
                        disabled={!canStart(bot.status)}
                      >
                        <StartIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Stop">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopBot(bot.id);
                        }}
                        disabled={!canStopOrRestart(bot.status)}
                      >
                        <StopIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Restart">
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestartBot(bot.id);
                        }}
                        disabled={!canStopOrRestart(bot.status)}
                      >
                        <RestartIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBot(bot);
                          setEditDialogOpen(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBot(bot);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateBotDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      {selectedBot && (
        <>
          <EditBotDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedBot(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedBot(null);
            }}
            bot={selectedBot}
          />

          <DeleteBotDialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false);
              setSelectedBot(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedBot(null);
            }}
            bot={selectedBot}
          />
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
