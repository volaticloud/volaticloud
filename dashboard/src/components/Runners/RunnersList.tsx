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
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudDownload as CloudDownloadIcon,
  Public as PublicIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetRunnersQuery, useRefreshRunnerDataMutation, useSetRunnerVisibilityMutation } from './runners.generated';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { CreateRunnerDialog } from './CreateRunnerDialog';
import { EditRunnerDialog } from './EditRunnerDialog';
import { DeleteRunnerDialog } from './DeleteRunnerDialog';
import { VisibilityToggleDialog } from '../shared/VisibilityToggleDialog';
import { useActiveGroup } from '../../contexts/GroupContext';

type ViewMode = 'mine' | 'public';

export const RunnersList = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<any | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  // Get active group for filtering
  const { activeGroupId } = useActiveGroup();

  const { data, loading, error, refetch } = useGetRunnersQuery({
    variables: {
      first: 50,
      where: {
        ...(viewMode === 'mine'
          ? { ownerID: activeGroupId || undefined }
          : { public: true })
      }
    },
    pollInterval: 10000, // Poll every 10 seconds to update download status
    fetchPolicy: 'network-only', // Force fetch from network to get updated schema
    skip: viewMode === 'mine' && !activeGroupId, // Skip query if viewing "mine" without active group
  });

  const [refreshRunnerData] = useRefreshRunnerDataMutation();
  const [setRunnerVisibility, { loading: visibilityLoading }] = useSetRunnerVisibilityMutation();

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="mine">
              <LockIcon sx={{ mr: 0.5 }} fontSize="small" />
              My Runners
            </ToggleButton>
            <ToggleButton value="public">
              <PublicIcon sx={{ mr: 0.5 }} fontSize="small" />
              Public
            </ToggleButton>
          </ToggleButtonGroup>
          {viewMode === 'mine' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ flexShrink: 0 }}
            >
              Create Runner
            </Button>
          )}
        </Box>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {runner.name}
                      </Typography>
                      {runner.public && (
                        <Chip
                          icon={<PublicIcon />}
                          label="Public"
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      )}
                    </Box>
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
                    {viewMode === 'mine' && (
                      <>
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
                        <Tooltip title={runner.public ? 'Make Private' : 'Make Public'}>
                          <IconButton
                            size="small"
                            color={runner.public ? 'info' : 'default'}
                            onClick={() => {
                              setSelectedRunner(runner);
                              setVisibilityDialogOpen(true);
                            }}
                          >
                            {runner.public ? <PublicIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Runner">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              // Refetch to ensure we have the latest data including config
                              const result = await refetch();
                              // Find the updated runner from the fresh data
                              const updatedRunner = result.data?.botRunners?.edges
                                ?.find(edge => edge?.node?.id === runner.id)?.node;
                              if (updatedRunner) {
                                setSelectedRunner(updatedRunner);
                                setEditDialogOpen(true);
                              }
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
                      </>
                    )}
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

          <VisibilityToggleDialog
            open={visibilityDialogOpen}
            onClose={() => {
              setVisibilityDialogOpen(false);
              setSelectedRunner(null);
            }}
            onConfirm={async () => {
              const result = await setRunnerVisibility({
                variables: {
                  id: selectedRunner.id,
                  public: !selectedRunner.public,
                },
              });
              if (result.errors) {
                throw new Error(result.errors[0]?.message || 'Failed to update visibility');
              }
              refetch();
              setSnackbar({
                open: true,
                message: `Runner is now ${selectedRunner.public ? 'private' : 'public'}`,
                severity: 'success',
              });
            }}
            resourceType="runner"
            resourceName={selectedRunner.name}
            currentlyPublic={selectedRunner.public || false}
            loading={visibilityLoading}
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