import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  Paper,
  Divider,
  FormHelperText,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Restore,
  ExitToApp,
  PlayArrow,
  Assessment,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useGetStrategyForStudioQuery } from './strategy-studio.generated';
import { useUpdateStrategyMutation } from './strategies.generated';
import { useGetBacktestQuery } from '../Backtests/backtests.generated';
import { FreqtradeConfigForm } from '../Freqtrade/FreqtradeConfigForm';
import { PythonCodeEditor } from './PythonCodeEditor';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { CreateBacktestDialog } from '../Backtests/CreateBacktestDialog';
import { BacktestResultsDialog } from '../Backtests/BacktestResultsDialog';
import { useGroupNavigate } from '../../contexts/GroupContext';
import { useSidebar } from '../../contexts/SidebarContext';

const StrategyStudio = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useGroupNavigate();
  const { setCollapsed } = useSidebar();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [config, setConfig] = useState<object | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [backtestDialogOpen, setBacktestDialogOpen] = useState(false);
  const [activeBacktestId, setActiveBacktestId] = useState<string | null>(null);
  const [backtestResultsDialogOpen, setBacktestResultsDialogOpen] = useState(false);

  const { data, loading, error } = useGetStrategyForStudioQuery({
    variables: { id: id! },
    skip: !id,
  });

  const [updateStrategy, { loading: saving, error: saveError }] = useUpdateStrategyMutation();

  const strategy = data?.strategies?.edges?.[0]?.node;

  // Poll for active backtest status
  const { data: backtestData } = useGetBacktestQuery({
    variables: { id: activeBacktestId! },
    skip: !activeBacktestId,
    pollInterval: activeBacktestId ? 3000 : 0,
  });

  const activeBacktest = backtestData?.backtests?.edges?.[0]?.node;
  const isBacktestRunning = activeBacktest?.status === 'running' || activeBacktest?.status === 'pending';
  const isBacktestCompleted = activeBacktest?.status === 'completed';
  const isBacktestFailed = activeBacktest?.status === 'failed';

  // Auto-collapse sidebar on mount, restore on unmount
  useEffect(() => {
    // Only collapse on mount, don't store current state as it causes issues
    setCollapsed(true);

    return () => {
      // Restore to expanded on unmount
      setCollapsed(false);
    };
  }, [setCollapsed]);

  useEffect(() => {
    if (strategy) {
      setName(strategy.name);
      setDescription(strategy.description || '');
      setCode(strategy.code);
      setConfig(strategy.config || null);
      setHasChanges(false);
    }
  }, [strategy]);

  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => (value: T) => {
    setter(value);
    setHasChanges(true);
  };

  const handleSave = async (closeAfterSave = false) => {
    if (!name || !code || !strategy) {
      return;
    }

    try {
      const result = await updateStrategy({
        variables: {
          id: strategy.id,
          input: {
            name,
            description: description || undefined,
            code,
            config: config || undefined,
          },
        },
      });

      if (result.data?.updateStrategy) {
        const newStrategyId = result.data.updateStrategy.id;
        if (closeAfterSave) {
          navigate(`/strategies/${newStrategyId}`);
        } else {
          // Stay on the page but navigate to the new version
          navigate(`/strategies/${newStrategyId}/edit`, { replace: true });
          setHasChanges(false);
        }
      }
    } catch (err) {
      console.error('Failed to update strategy:', err);
    }
  };

  const handleCancel = () => {
    navigate(`/strategies/${id}`);
  };

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <IconButton onClick={handleCancel}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h5" fontWeight={600}>
              Strategy Studio
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
            {!strategy.isLatest && (
              <Chip
                icon={<Restore />}
                label="Restoring old version"
                size="small"
                color="warning"
              />
            )}
            {hasChanges && (
              <Chip label="Unsaved changes" size="small" color="warning" variant="outlined" />
            )}
          </Box>
        </Box>
        {/* Backtest Status Indicator */}
        {activeBacktestId && (
          <>
            {isBacktestRunning && (
              <Tooltip title="Backtest in progress">
                <Chip
                  icon={<CircularProgress size={14} />}
                  label="Backtest Running"
                  color="info"
                  size="small"
                />
              </Tooltip>
            )}
            {isBacktestCompleted && (
              <Tooltip title="Click to view results">
                <Chip
                  icon={<CheckCircle />}
                  label="Backtest Complete"
                  color="success"
                  size="small"
                  onClick={() => setBacktestResultsDialogOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
            )}
            {isBacktestFailed && (
              <Tooltip title="Click to view details">
                <Chip
                  icon={<ErrorIcon />}
                  label="Backtest Failed"
                  color="error"
                  size="small"
                  onClick={() => setBacktestResultsDialogOpen(true)}
                  sx={{ cursor: 'pointer' }}
                />
              </Tooltip>
            )}
            {(isBacktestCompleted || isBacktestFailed) && (
              <Button
                variant="outlined"
                color={isBacktestCompleted ? 'success' : 'error'}
                startIcon={<Assessment />}
                onClick={() => setBacktestResultsDialogOpen(true)}
                size="small"
              >
                View Results
              </Button>
            )}
          </>
        )}
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<PlayArrow />}
          onClick={() => setBacktestDialogOpen(true)}
          disabled={hasChanges || isBacktestRunning}
        >
          {isBacktestRunning ? 'Running...' : 'Run Backtest'}
        </Button>
        <Button variant="outlined" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          startIcon={<Save />}
          onClick={() => handleSave(false)}
          disabled={saving || !name || !code || !hasChanges}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          variant="contained"
          startIcon={<ExitToApp />}
          onClick={() => handleSave(true)}
          disabled={saving || !name || !code || !hasChanges}
        >
          {saving ? 'Saving...' : 'Save & Close'}
        </Button>
      </Paper>

      {saveError && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
          Error saving strategy: {saveError.message}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Code Editor */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Strategy Code
            </Typography>
          </Box>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <PythonCodeEditor
                value={code}
                onChange={handleChange(setCode)}
                height="100%"
                label=""
              />
            </Box>
          </Box>
        </Box>

        {/* Right Panel - Configuration */}
        <Box
          sx={{
            width: { xs: '100%', md: '400px', lg: '500px' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Strategy Settings
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Strategy Name */}
              <TextField
                label="Strategy Name"
                value={name}
                onChange={(e) => handleChange(setName)(e.target.value)}
                required
                fullWidth
                size="small"
              />

              {/* Description */}
              <TextField
                label="Description"
                value={description}
                onChange={(e) => handleChange(setDescription)(e.target.value)}
                fullWidth
                multiline
                rows={3}
                size="small"
              />

              <Divider />

              {/* Freqtrade Config */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Freqtrade Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Configure trading parameters for backtesting and live trading.
                </Typography>
                <FreqtradeConfigForm
                  value={config}
                  onChange={handleChange(setConfig)}
                  hideSubmitButton
                />
              </Box>

              <Divider />

              {/* Version History */}
              <VersionHistoryPanel
                strategyName={strategy.name}
                currentCode={code}
                currentVersionNumber={strategy.versionNumber}
                onCopyFromVersion={handleChange(setCode)}
              />

              {saveError && (
                <FormHelperText error>
                  Error updating strategy: {saveError.message}
                </FormHelperText>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Backtest Dialog */}
      <CreateBacktestDialog
        open={backtestDialogOpen}
        onClose={() => setBacktestDialogOpen(false)}
        onSuccess={() => {
          // Don't navigate away - stay in studio
        }}
        onBacktestCreated={(backtestId) => {
          setActiveBacktestId(backtestId);
        }}
        preSelectedStrategyId={strategy.id}
      />

      {/* Backtest Results Dialog */}
      <BacktestResultsDialog
        open={backtestResultsDialogOpen}
        onClose={() => setBacktestResultsDialogOpen(false)}
        backtestId={activeBacktestId}
        polling={isBacktestRunning}
      />
    </Box>
  );
};

export default StrategyStudio;