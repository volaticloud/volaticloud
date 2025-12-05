import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  Chip,
  FormControlLabel,
  Switch,
  CircularProgress,
} from '@mui/material';
import {
  Public as PublicIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useState, useMemo } from 'react';
import { useGetRunnersForSelectorQuery } from './shared.generated';
import { useActiveGroup } from '../../contexts/GroupContext';

interface RunnerSelectorProps {
  value: string;
  onChange: (runnerId: string) => void;
  required?: boolean;
  label?: string;
  helperText?: string;
  error?: boolean;
  /** Filter to only show runners with data ready (for backtesting) */
  dataReadyOnly?: boolean;
  disabled?: boolean;
}

interface RunnerOption {
  id: string;
  name: string;
  type: string;
  public: boolean;
  dataIsReady: boolean;
  isOwn: boolean;
}

export const RunnerSelector = ({
  value,
  onChange,
  required = false,
  label = 'Runner',
  helperText,
  error = false,
  dataReadyOnly = false,
  disabled = false,
}: RunnerSelectorProps) => {
  const [showPublicRunners, setShowPublicRunners] = useState(true);
  const { activeGroupId } = useActiveGroup();

  const { data, loading } = useGetRunnersForSelectorQuery({
    variables: {
      ownerID: activeGroupId || undefined,
    },
    skip: !activeGroupId,
  });

  // Combine and deduplicate runners
  const runners = useMemo((): RunnerOption[] => {
    const myRunners = data?.myRunners?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      .map(runner => ({
        ...runner,
        isOwn: true,
      })) || [];

    const publicRunners = data?.publicRunners?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      // Exclude own runners from public list (avoid duplicates)
      .filter(runner => runner.ownerID !== activeGroupId)
      .map(runner => ({
        id: runner.id,
        name: runner.name,
        type: runner.type,
        public: runner.public,
        dataIsReady: runner.dataIsReady,
        isOwn: false,
      })) || [];

    let allRunners = [...myRunners, ...publicRunners];

    // Filter by visibility preference
    if (!showPublicRunners) {
      allRunners = allRunners.filter(runner => runner.isOwn);
    }

    // Filter by data ready if required
    if (dataReadyOnly) {
      allRunners = allRunners.filter(runner => runner.dataIsReady);
    }

    return allRunners;
  }, [data, activeGroupId, showPublicRunners, dataReadyOnly]);

  const hasPublicRunners = useMemo(() => {
    const publicRunners = data?.publicRunners?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      .filter(runner => runner.ownerID !== activeGroupId) || [];

    if (dataReadyOnly) {
      return publicRunners.some(r => r.dataIsReady);
    }
    return publicRunners.length > 0;
  }, [data, activeGroupId, dataReadyOnly]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {runners.length} runner{runners.length !== 1 ? 's' : ''} available
        </Typography>
        {hasPublicRunners && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showPublicRunners}
                onChange={(e) => setShowPublicRunners(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption">
                Show public runners
              </Typography>
            }
          />
        )}
      </Box>
      <FormControl fullWidth required={required} error={error} disabled={disabled || loading}>
        <InputLabel>{label}</InputLabel>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          label={label}
          startAdornment={loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : undefined}
        >
          {runners.map((runner) => (
            <MenuItem key={runner.id} value={runner.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>{runner.name}</Typography>
                  {!runner.isOwn && (
                    <Chip
                      icon={<PublicIcon />}
                      label="Public"
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Chip
                    label={runner.type}
                    size="small"
                    variant="outlined"
                  />
                  {dataReadyOnly && (
                    runner.dataIsReady ? (
                      <CheckCircleIcon fontSize="small" color="success" />
                    ) : (
                      <WarningIcon fontSize="small" color="warning" />
                    )
                  )}
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
        {helperText && <FormHelperText>{helperText}</FormHelperText>}
        {runners.length === 0 && !loading && (
          <FormHelperText error>
            No runners available. Please add a runner first.
          </FormHelperText>
        )}
      </FormControl>
    </Box>
  );
};