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
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetRunnersQuery, useRefreshRunnerDataMutation } from '../../generated/graphql';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { CreateRunnerDialog } from './CreateRunnerDialog';
import { EditRunnerDialog } from './EditRunnerDialog';
import { DeleteRunnerDialog } from './DeleteRunnerDialog';

export const RunnersList = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<any | null>(null);

  const { data, loading, error, refetch } = useGetRunnersQuery({
    variables: { first: 50 },
    pollInterval: 10000, // Poll every 10 seconds to update download status
  });

  const [refreshRunnerData] = useRefreshRunnerDataMutation();

  const handleRefreshData = async (id: string, name: string) => {
    try {
      await refreshRunnerData({ variables: { id } });
      // Refetch immediately to show the updated status
      refetch();
    } catch (err) {
      console.error(`Failed to refresh data for runner ${name}:`, err);
    }
  };

  const renderDataStatus = (runner: any) => {
    const status = runner.dataDownloadStatus;
    const progress = runner.dataDownloadProgress;
    const isReady = runner.dataIsReady;
    const lastUpdated = runner.dataLastUpdated;
    const errorMsg = runner.dataErrorMessage;

    // Downloading status
    if (status === 'downloading') {
      const percentComplete = progress?.percent_complete || 0;
      return (
        <Box sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <CloudDownloadIcon fontSize="small" color="primary" />
            <Typography variant="caption">
              Downloading... {Math.round(percentComplete)}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={percentComplete} />
          {progress?.current_pair && (
            <Typography variant="caption" color="text.secondary">
              {progress.current_pair} ({progress.pairs_completed}/{progress.pairs_total})
            </Typography>
          )}
        </Box>
      );
    }

    // Failed status
    if (status === 'failed') {
      return (
        <Box>
          <Chip
            icon={<ErrorIcon />}
            label="Failed"
            color="error"
            size="small"
            sx={{ mb: 0.5 }}
          />
          {errorMsg && (
            <Typography variant="caption" color="error" display="block">
              {errorMsg.substring(0, 50)}...
            </Typography>
          )}
        </Box>
      );
    }

    // Completed/Ready status
    if (isReady && status === 'completed') {
      return (
        <Box>
          <Chip
            icon={<CheckCircleIcon />}
            label="Ready"
            color="success"
            size="small"
            sx={{ mb: 0.5 }}
          />
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary" display="block">
              Updated {new Date(lastUpdated).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      );
    }

    // Idle/Not ready status
    return (
      <Chip
        label="No Data"
        color="default"
        size="small"
        variant="outlined"
      />
    );
  };

  if (loading) return <LoadingSpinner message="Loading runners..." />;
  if (error) return <ErrorAlert error={error} />;

  const runners = (data?.botRunners?.edges
    ?.map(edge => edge?.node)
    .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined) || []);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 3
      }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            Runners
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.botRunners?.totalCount || 0} total runners
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Create Runner
        </Button>
      </Box>

      {runners.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No runners yet. Create your first runner to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Paper sx={{ width: '100%', mb: 2 }}>
          <TableContainer>
            <Table sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Data Status</TableCell>
                <TableCell>Bots</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runners.map((runner) => (
                <TableRow key={runner.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {runner.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={runner.type}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 200 }}>
                    {renderDataStatus(runner)}
                  </TableCell>
                  <TableCell>{runner.bots?.totalCount || 0}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(runner.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Refresh Data">
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={runner.dataDownloadStatus === 'downloading'}
                        onClick={() => handleRefreshData(runner.id, runner.name)}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Runner">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedRunner(runner);
                          setEditDialogOpen(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Runner">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedRunner(runner);
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
        </Paper>
      )}

      <CreateRunnerDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      {selectedRunner && (
        <>
          <EditRunnerDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedRunner(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedRunner(null);
            }}
            runner={selectedRunner}
          />

          <DeleteRunnerDialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false);
              setSelectedRunner(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedRunner(null);
            }}
            runner={selectedRunner}
          />
        </>
      )}
    </Box>
  );
};