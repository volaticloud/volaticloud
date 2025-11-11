import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  PlayArrow,
  Edit,
  Delete,
  ArrowBack,
  Restore,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetStrategyDetailQuery, useGetStrategyVersionsQuery } from './strategy-detail.generated';
import { CreateBacktestDialog } from '../Backtests/CreateBacktestDialog';
import { EditStrategyDialog } from './EditStrategyDialog';
import { DeleteStrategyDialog } from './DeleteStrategyDialog';
import { StrategyInfo } from './StrategyInfo';
import { StrategyCode } from './StrategyCode';
import { StrategyVersionHistory } from './StrategyVersionHistory';
import { BacktestResults } from '../Backtests/BacktestResults';

const StrategyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [backtestDialogOpen, setBacktestDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data, loading, error, refetch } = useGetStrategyDetailQuery({
    variables: { id: id! },
    skip: !id,
  });

  const strategy = data?.strategies?.edges?.[0]?.node;

  const { data: versionsData, loading: versionsLoading } = useGetStrategyVersionsQuery({
    variables: { name: strategy?.name || '' },
    skip: !strategy?.name,
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">Error loading strategy: {error.message}</Alert>
      </Box>
    );
  }

  if (!strategy) {
    return (
      <Box p={3}>
        <Alert severity="warning">Strategy not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/strategies')}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
            <Typography variant="h4" fontWeight={600}>
              {strategy.name}
            </Typography>
            <Chip
              label={`v${strategy.versionNumber}`}
              size="medium"
              color="primary"
              variant="outlined"
            />
            {strategy.isLatest && (
              <Chip label="Latest" size="small" color="success" />
            )}
          </Box>
          {strategy.description && (
            <Typography variant="body2" color="text.secondary">
              {strategy.description}
            </Typography>
          )}
        </Box>
        {!strategy.backtest && (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={() => setBacktestDialogOpen(true)}
          >
            Run Backtest
          </Button>
        )}
        {strategy.isLatest ? (
          <IconButton onClick={() => setEditDialogOpen(true)}>
            <Edit />
          </IconButton>
        ) : (
          <Button
            variant="outlined"
            startIcon={<Restore />}
            onClick={() => setEditDialogOpen(true)}
          >
            Restore to this version
          </Button>
        )}
        <IconButton color="error" onClick={() => setDeleteDialogOpen(true)}>
          <Delete />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Top Section: Strategy Info and Version History */}
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3
        }}>
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 33%' } }}>
            <StrategyInfo
              versionNumber={strategy.versionNumber}
              botsCount={strategy.bots?.totalCount || 0}
              hasBacktest={!!strategy.backtest}
              createdAt={strategy.createdAt}
              updatedAt={strategy.updatedAt}
            />
          </Box>

          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 67%' } }}>
            <StrategyVersionHistory
              currentStrategyId={strategy.id}
              versions={versionsData?.strategyVersions || []}
              loading={versionsLoading}
              onVersionClick={(versionId) => navigate(`/strategies/${versionId}`)}
            />
          </Box>
        </Box>

        {/* Backtest Results */}
        {strategy.backtest && (
          <BacktestResults backtest={strategy.backtest} />
        )}

        {/* Strategy Code */}
        <StrategyCode code={strategy.code} />
      </Box>

      {/* Dialogs */}
      <CreateBacktestDialog
        open={backtestDialogOpen}
        onClose={() => setBacktestDialogOpen(false)}
        onSuccess={() => {
          setBacktestDialogOpen(false);
          refetch();
        }}
        preSelectedStrategyId={strategy.id}
      />

      <EditStrategyDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={(newStrategyId) => {
          setEditDialogOpen(false);
          navigate(`/strategies/${newStrategyId}`);
        }}
        strategy={strategy}
      />

      <DeleteStrategyDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onSuccess={() => {
          setDeleteDialogOpen(false);
          navigate('/strategies');
        }}
        strategy={strategy}
      />
    </Box>
  );
};

export default StrategyDetail;