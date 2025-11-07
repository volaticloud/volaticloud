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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetStrategiesQuery } from './strategies.generated';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { CreateStrategyDialog } from './CreateStrategyDialog';
import { EditStrategyDialog } from './EditStrategyDialog';
import { DeleteStrategyDialog } from './DeleteStrategyDialog';
import { CreateBacktestDialog } from '../Backtests/CreateBacktestDialog';

export const StrategiesList = () => {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [backtestDialogOpen, setBacktestDialogOpen] = useState(false);
  const [selectedStrategyForBacktest, setSelectedStrategyForBacktest] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<{
    id: string;
    name: string;
    description?: string | null;
    code: string;
    version: string;
  } | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'error' });

  const { data, loading, error, refetch } = useGetStrategiesQuery({
    variables: { first: 50 }
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
            {data?.strategies?.totalCount || 0} total strategies
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Create Strategy
        </Button>
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
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {strategy.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {strategy.version || '-'}
                    </Typography>
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
        onSuccess={() => {
          setBacktestDialogOpen(false);
          setSelectedStrategyForBacktest(null);
          setSnackbar({
            open: true,
            message: 'Backtest created successfully',
            severity: 'success',
          });
        }}
        preSelectedStrategyId={selectedStrategyForBacktest || undefined}
      />

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