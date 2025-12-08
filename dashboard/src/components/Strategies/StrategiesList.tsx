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
  Paper,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Public as PublicIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetStrategiesQuery, useSetStrategyVisibilityMutation } from './strategies.generated';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { CreateStrategyDialog } from './CreateStrategyDialog';
import { EditStrategyDialog } from './EditStrategyDialog';
import { DeleteStrategyDialog } from './DeleteStrategyDialog';
import { CreateBacktestDialog } from '../Backtests/CreateBacktestDialog';
import { VisibilityToggleDialog } from '../shared/VisibilityToggleDialog';
import { useActiveGroup, useGroupNavigate } from '../../contexts/GroupContext';

type ViewMode = 'mine' | 'public';

export const StrategiesList = () => {
  const navigate = useGroupNavigate();
  const { activeGroupId } = useActiveGroup();
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backtestDialogOpen, setBacktestDialogOpen] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [selectedStrategyForBacktest, setSelectedStrategyForBacktest] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<{
    id: string;
    name: string;
    description?: string | null;
    code: string;
    versionNumber: number;
    public?: boolean;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  const [setStrategyVisibility, { loading: visibilityLoading }] = useSetStrategyVisibilityMutation();

  const { data, loading, error, refetch } = useGetStrategiesQuery({
    variables: {
      first: 50,
      where: {
        isLatest: true,
        ...(viewMode === 'mine'
          ? { ownerID: activeGroupId || undefined }
          : { public: true })
      }
    },
    skip: viewMode === 'mine' && !activeGroupId, // Skip query if viewing "mine" without active group
  });

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  if (loading) return <LoadingSpinner message="Loading strategies..." />;
  if (error) return <ErrorAlert error={error} />;

  const strategies = (data?.strategies?.edges
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
            Strategies
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.strategies?.totalCount || 0} latest strategies
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
              My Strategies
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
              Create Strategy
            </Button>
          )}
        </Box>
      </Box>

      {strategies.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No strategies yet. Create your first strategy to get started.
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
                <TableCell>Description</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Bots</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {strategies.map((strategy) => (
                <TableRow key={strategy.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { color: 'primary.main' }
                        }}
                        onClick={() => navigate(`/strategies/${strategy.id}`)}
                      >
                        {strategy.name}
                      </Typography>
                      <Chip
                        label={`v${strategy.versionNumber}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {strategy.public && (
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
                    <Typography variant="body2" color="text.secondary">
                      {strategy.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`v${strategy.versionNumber}`}
                      size="small"
                      color="default"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{strategy.bots?.totalCount || 0}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(strategy.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Quick Backtest">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          setSelectedStrategyForBacktest(strategy.id);
                          setBacktestDialogOpen(true);
                        }}
                      >
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {viewMode === 'mine' && (
                      <>
                        <Tooltip title={strategy.public ? 'Make Private' : 'Make Public'}>
                          <IconButton
                            size="small"
                            color={strategy.public ? 'info' : 'default'}
                            onClick={() => {
                              setSelectedStrategy(strategy);
                              setVisibilityDialogOpen(true);
                            }}
                          >
                            {strategy.public ? <PublicIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedStrategy(strategy);
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
                            onClick={() => {
                              setSelectedStrategy(strategy);
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

      <CreateStrategyDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          refetch();
          setSnackbar({
            open: true,
            message: 'Strategy created successfully',
            severity: 'success',
          });
        }}
      />

      {selectedStrategy && (
        <>
          <EditStrategyDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedStrategy(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedStrategy(null);
              setSnackbar({
                open: true,
                message: 'Strategy updated successfully',
                severity: 'success',
              });
            }}
            strategy={selectedStrategy}
          />

          <DeleteStrategyDialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false);
              setSelectedStrategy(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedStrategy(null);
              setSnackbar({
                open: true,
                message: 'Strategy deleted successfully',
                severity: 'success',
              });
            }}
            strategy={selectedStrategy}
          />
        </>
      )}

      <CreateBacktestDialog
        open={backtestDialogOpen}
        onClose={() => {
          setBacktestDialogOpen(false);
          setSelectedStrategyForBacktest(null);
        }}
        onSuccess={(newStrategyId) => {
          setBacktestDialogOpen(false);
          setSelectedStrategyForBacktest(null);
          setSnackbar({
            open: true,
            message: 'Backtest created successfully',
            severity: 'success',
          });
          // Navigate to the new strategy version if provided
          if (newStrategyId) {
            navigate(`/strategies/${newStrategyId}`);
          }
        }}
        preSelectedStrategyId={selectedStrategyForBacktest || undefined}
      />

      {selectedStrategy && (
        <VisibilityToggleDialog
          open={visibilityDialogOpen}
          onClose={() => {
            setVisibilityDialogOpen(false);
            setSelectedStrategy(null);
          }}
          onConfirm={async () => {
            const result = await setStrategyVisibility({
              variables: {
                id: selectedStrategy.id,
                public: !selectedStrategy.public,
              },
            });
            if (result.errors) {
              throw new Error(result.errors[0]?.message || 'Failed to update visibility');
            }
            refetch();
            setSnackbar({
              open: true,
              message: `Strategy is now ${selectedStrategy.public ? 'private' : 'public'}`,
              severity: 'success',
            });
          }}
          resourceType="strategy"
          resourceName={selectedStrategy.name}
          currentlyPublic={selectedStrategy.public || false}
          loading={visibilityLoading}
        />
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