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
  TextField,
  InputAdornment,
  ListSubheader,
} from '@mui/material';
import {
  Public as PublicIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGetRunnersForSelectorQuery, useGetRunnerByIdQuery } from './shared.generated';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

// Type for available data metadata from runner
export interface RunnerDataAvailable {
  exchanges?: Array<{
    name: string;
    pairs?: Array<{
      pair: string;
      timeframes?: Array<{
        timeframe: string;
        from?: string | null;
        to?: string | null;
      }>;
    }>;
  }>;
}

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
  /** Callback when runner's data availability is loaded */
  onDataAvailableLoaded?: (data: RunnerDataAvailable | null) => void;
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
  onDataAvailableLoaded,
}: RunnerSelectorProps) => {
  const { activeOrganizationId } = useActiveOrganization();
  const [showPublicRunners, setShowPublicRunners] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Main query for runner list
  const { data, loading, error: queryError, fetchMore } = useGetRunnersForSelectorQuery({
    variables: {
      ownerID: activeOrganizationId || undefined,
      search: debouncedSearch || undefined,
      includePublic: showPublicRunners,
      dataReadyOnly: dataReadyOnly ? true : undefined,
      first: 20,
    },
    skip: !activeOrganizationId,
  });

  // Query for selected runner (to ensure it's always in the list)
  const { data: selectedRunnerData } = useGetRunnerByIdQuery({
    variables: { id: value },
    skip: !value,
  });

  // Extract selected runner from query result
  const selectedRunner = useMemo(() => {
    return selectedRunnerData?.botRunners?.edges?.[0]?.node ?? null;
  }, [selectedRunnerData]);

  // Combine and deduplicate runners
  const runners = useMemo((): RunnerOption[] => {
    const myRunners = data?.myRunners?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      .map(runner => ({
        id: runner.id,
        name: runner.name,
        type: runner.type,
        public: runner.public,
        dataIsReady: runner.dataIsReady,
        isOwn: true,
      })) || [];

    const publicRunners = data?.publicRunners?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      .map(runner => ({
        id: runner.id,
        name: runner.name,
        type: runner.type,
        public: runner.public,
        dataIsReady: runner.dataIsReady,
        isOwn: false,
      })) || [];

    const allRunners = [...myRunners, ...publicRunners];

    // Add selected runner if not in list
    if (value && selectedRunner) {
      const exists = allRunners.some(r => r.id === selectedRunner.id);
      if (!exists) {
        allRunners.unshift({
          id: selectedRunner.id,
          name: selectedRunner.name,
          type: selectedRunner.type,
          public: selectedRunner.public,
          dataIsReady: selectedRunner.dataIsReady,
          isOwn: selectedRunner.public === false,
        });
      }
    }

    return allRunners;
  }, [data, value, selectedRunner]);

  // Handle scroll to load more
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;

    if (bottom && data?.myRunners?.pageInfo?.hasNextPage && !loading) {
      fetchMore({
        variables: {
          after: data.myRunners.pageInfo.endCursor,
        },
      });
    }
  }, [data?.myRunners?.pageInfo, loading, fetchMore]);

  // Prevent menu close when clicking search
  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent) => {
    event.stopPropagation();
  }, []);

  // Reset search when unmounting
  useEffect(() => {
    return () => setSearchInput('');
  }, []);

  // Notify parent when data availability changes
  useEffect(() => {
    if (onDataAvailableLoaded && selectedRunner) {
      const dataAvailable = selectedRunner.dataAvailable as RunnerDataAvailable | null;
      onDataAvailableLoaded(dataAvailable);
    } else if (onDataAvailableLoaded && !value) {
      onDataAvailableLoaded(null);
    }
  }, [selectedRunner, value, onDataAvailableLoaded]);

  const totalCount = (data?.myRunners?.totalCount ?? 0) +
    (showPublicRunners ? (data?.publicRunners?.totalCount ?? 0) : 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {totalCount} runner{totalCount !== 1 ? 's' : ''} available
        </Typography>
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
      </Box>
      <FormControl fullWidth required={required} error={error} disabled={disabled}>
        <InputLabel>{label}</InputLabel>
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          label={label}
          MenuProps={{
            PaperProps: {
              onScroll: handleScroll,
              sx: { maxHeight: 400 },
            },
            autoFocus: false,
          }}
          startAdornment={loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : undefined}
        >
          <ListSubheader sx={{ bgcolor: 'background.paper' }}>
            <TextField
              size="small"
              autoFocus
              placeholder="Search runners..."
              fullWidth
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </ListSubheader>
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
          {loading && (
            <MenuItem disabled>
              <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                <CircularProgress size={20} />
              </Box>
            </MenuItem>
          )}
        </Select>
        {helperText && <FormHelperText>{helperText}</FormHelperText>}
        {queryError && (
          <FormHelperText error>
            Failed to load runners: {queryError.message}
          </FormHelperText>
        )}
        {runners.length === 0 && !loading && !queryError && (
          <FormHelperText error>
            No runners available. Please add a runner first.
          </FormHelperText>
        )}
      </FormControl>
    </Box>
  );
};