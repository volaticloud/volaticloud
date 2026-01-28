import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
} from '@mui/material';
import {
  PlayArrow,
  Edit,
  Delete,
  ArrowBack,
  Restore,
  Public as PublicIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetStrategyDetailQuery, useGetStrategyVersionsQuery } from './strategy-detail.generated';
import { CreateBacktestDrawer } from '../Backtests/CreateBacktestDrawer';
import { DeleteStrategyDrawer } from './DeleteStrategyDrawer';
import { StrategyInfo } from './StrategyInfo';
import { StrategyVersionHistory } from './StrategyVersionHistory';
import { BacktestResults } from '../Backtests/BacktestResults';
import { ToolbarActions, ToolbarAction } from '../shared/ToolbarActions';
import { VisibilityToggleDrawer } from '../shared/VisibilityToggleDrawer';
import { useOrganizationNavigate } from '../../contexts/OrganizationContext';
import { useDocumentTitle, useCanPerform } from '../../hooks';
import { useSetStrategyVisibilityMutation } from './strategies.generated';

const StrategyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useOrganizationNavigate();
  const [backtestDrawerOpen, setBacktestDrawerOpen] = useState(false);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [visibilityDrawerOpen, setVisibilityDrawerOpen] = useState(false);

  const { data, loading, error, refetch } = useGetStrategyDetailQuery({
    variables: { id: id! },
    skip: !id,
  });

  const strategy = data?.strategies?.edges?.[0]?.node;

  // Set dynamic page title based on strategy name
  useDocumentTitle(strategy?.name ? `${strategy.name} - Strategy` : 'Strategy Details');

  const { data: versionsData, loading: versionsLoading } = useGetStrategyVersionsQuery({
    variables: { name: strategy?.name || '' },
    skip: !strategy?.name,
  });

  // Visibility mutation and permission check
  const [setStrategyVisibility, { loading: visibilityLoading }] = useSetStrategyVisibilityMutation();
  const { can: canMakePublic, loading: permissionLoading } = useCanPerform({
    resourceId: id || '',
    scope: 'make-public',
  });

  const handleVisibilityConfirm = async () => {
    if (!strategy) return;
    await setStrategyVisibility({
      variables: {
        id: strategy.id,
        public: !strategy.public,
      },
    });
    refetch();
  };

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

  // Build toolbar actions
  const toolbarActions: ToolbarAction[] = [
    {
      id: 'run-backtest',
      label: 'Run Backtest',
      icon: <PlayArrow />,
      onClick: () => setBacktestDrawerOpen(true),
      primary: true,
      variant: 'contained',
      tooltip: 'Run Backtest',
      iconOnlyOnSmallScreen: true,
    },
    ...(strategy.isLatest
      ? [
          {
            id: 'edit',
            label: 'Edit',
            icon: <Edit />,
            onClick: () => navigate(`/strategies/${strategy.id}/edit`),
          },
        ]
      : [
          {
            id: 'restore',
            label: 'Restore to this version',
            icon: <Restore />,
            onClick: () => navigate(`/strategies/${strategy.id}/edit`),
          },
        ]),
    {
      id: 'visibility',
      label: strategy.public ? 'Make Private' : 'Make Public',
      icon: strategy.public ? <LockIcon /> : <PublicIcon />,
      onClick: () => setVisibilityDrawerOpen(true),
      disabled: !canMakePublic || permissionLoading,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Delete />,
      onClick: () => setDeleteDrawerOpen(true),
      color: 'error',
      dividerBefore: true,
    },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 2,
          mb: 3,
          mx: -3,
          mt: -3,
          pt: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <IconButton onClick={() => navigate('/strategies')} size="small">
          <ArrowBack />
        </IconButton>

        {/* Title and Chips */}
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h5" fontWeight={600}>
              {strategy.name}
            </Typography>
            <Chip
              label={`v${strategy.versionNumber}`}
              size="small"
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {strategy.description}
            </Typography>
          )}
        </Box>

        {/* Toolbar Actions */}
        <ToolbarActions actions={toolbarActions} size="medium" />
      </Paper>

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

      {/* Drawers */}
      <CreateBacktestDrawer
        open={backtestDrawerOpen}
        onClose={() => setBacktestDrawerOpen(false)}
        onSuccess={(newStrategyId) => {
          setBacktestDrawerOpen(false);
          // Navigate to the new strategy version if it's different from current
          if (newStrategyId && newStrategyId !== strategy.id) {
            navigate(`/strategies/${newStrategyId}`);
          } else {
            refetch();
          }
        }}
        preSelectedStrategyId={strategy.id}
      />

      <DeleteStrategyDrawer
        open={deleteDrawerOpen}
        onClose={() => setDeleteDrawerOpen(false)}
        onSuccess={() => {
          setDeleteDrawerOpen(false);
          navigate('/strategies');
        }}
        strategy={strategy}
      />

      <VisibilityToggleDrawer
        open={visibilityDrawerOpen}
        onClose={() => setVisibilityDrawerOpen(false)}
        onConfirm={handleVisibilityConfirm}
        resourceType="strategy"
        resourceName={strategy.name}
        currentlyPublic={strategy.public}
        loading={visibilityLoading}
      />
    </Box>
  );
};

export default StrategyDetail;