import { useParams } from 'react-router-dom';
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
  Public as PublicIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetStrategyDetailQuery, useGetStrategyVersionsQuery } from './strategy-detail.generated';
import { CreateBacktestDialog } from '../Backtests/CreateBacktestDialog';
import { DeleteStrategyDialog } from './DeleteStrategyDialog';
import { StrategyVisibilityButton } from './StrategyVisibilityButton';
import { StrategyInfo } from './StrategyInfo';
import { StrategyVersionHistory } from './StrategyVersionHistory';
import { BacktestResults } from '../Backtests/BacktestResults';
import { useOrganizationNavigate } from '../../contexts/OrganizationContext';

const StrategyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useOrganizationNavigate();
  const [backtestDialogOpen, setBacktestDialogOpen] = useState(false);
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
    return <Alert severity="error">Error loading strategy: {error.message}</Alert>;
  }

  if (!strategy) {
    return <Alert severity="warning">Strategy not found</Alert>;
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
          {strategy.description && (
            <Typography variant="body2" color="text.secondary">
              {strategy.description}
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<PlayArrow />}
          onClick={() => setBacktestDialogOpen(true)}
        >
          Run Backtest
        </Button>
        {strategy.isLatest ? (
          <IconButton onClick={() => navigate(`/strategies/${strategy.id}/edit`)}>
            <Edit />
          </IconButton>
        ) : (
          <Button
            variant="outlined"
            startIcon={<Restore />}
            onClick={() => navigate(`/strategies/${strategy.id}/edit`)}
          >
            Restore to this version
          </Button>
        )}
        <StrategyVisibilityButton
          strategyId={strategy.id}
          strategyName={strategy.name}
          isPublic={strategy.public}
          onSuccess={() => refetch()}
        />
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
      </Box>

      {/* Dialogs */}
      <CreateBacktestDialog
        open={backtestDialogOpen}
        onClose={() => setBacktestDialogOpen(false)}
        onSuccess={(newStrategyId) => {
          setBacktestDialogOpen(false);
          // Navigate to the new strategy version if it's different from current
          if (newStrategyId && newStrategyId !== strategy.id) {
            navigate(`/strategies/${newStrategyId}`);
          } else {
            refetch();
          }
        }}
        preSelectedStrategyId={strategy.id}
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