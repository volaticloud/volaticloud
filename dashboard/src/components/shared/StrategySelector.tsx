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
  Search as SearchIcon,
} from '@mui/icons-material';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGetStrategiesForSelectorQuery, useGetStrategyForSelectorQuery } from './shared.generated';
import { useActiveGroup } from '../../contexts/GroupContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface StrategySelectorProps {
  value: string;
  onChange: (strategyId: string) => void;
  required?: boolean;
  label?: string;
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  /** Initial state for latest only filter (default: true) */
  defaultLatestOnly?: boolean;
}

interface StrategyOption {
  id: string;
  name: string;
  isLatest: boolean;
  versionNumber: number;
  public: boolean;
  isOwn: boolean;
}

export const StrategySelector = ({
  value,
  onChange,
  required = false,
  label = 'Strategy',
  helperText,
  error = false,
  disabled = false,
  defaultLatestOnly = true,
}: StrategySelectorProps) => {
  const { activeGroupId } = useActiveGroup();
  const [showPublicStrategies, setShowPublicStrategies] = useState(false);
  const [latestOnly, setLatestOnly] = useState(defaultLatestOnly);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Main query for strategy list
  const { data, loading, fetchMore } = useGetStrategiesForSelectorQuery({
    variables: {
      ownerID: activeGroupId || undefined,
      search: debouncedSearch || undefined,
      includePublic: showPublicStrategies,
      latestOnly: latestOnly ? true : undefined,
      first: 20,
    },
    skip: !activeGroupId,
  });

  // Query for selected strategy (to ensure it's always in the list)
  const { data: selectedStrategyData } = useGetStrategyForSelectorQuery({
    variables: { id: value },
    skip: !value,
  });

  // Combine and deduplicate strategies
  const strategies = useMemo((): StrategyOption[] => {
    const myStrategies = data?.myStrategies?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      .map(strategy => ({
        id: strategy.id,
        name: strategy.name,
        isLatest: strategy.isLatest,
        versionNumber: strategy.versionNumber,
        public: strategy.public,
        isOwn: true,
      })) || [];

    const publicStrategies = data?.publicStrategies?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      .map(strategy => ({
        id: strategy.id,
        name: strategy.name,
        isLatest: strategy.isLatest,
        versionNumber: strategy.versionNumber,
        public: strategy.public,
        isOwn: false,
      })) || [];

    const allStrategies = [...myStrategies, ...publicStrategies];

    // Add selected strategy if not in list
    if (value && selectedStrategyData?.node?.__typename === 'Strategy') {
      const selectedStrategy = selectedStrategyData.node;
      const exists = allStrategies.some(s => s.id === selectedStrategy.id);
      if (!exists) {
        allStrategies.unshift({
          id: selectedStrategy.id,
          name: selectedStrategy.name,
          isLatest: selectedStrategy.isLatest,
          versionNumber: selectedStrategy.versionNumber,
          public: selectedStrategy.public,
          isOwn: selectedStrategy.public === false,
        });
      }
    }

    return allStrategies;
  }, [data, value, selectedStrategyData]);

  // Handle scroll to load more
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;

    if (bottom && data?.myStrategies?.pageInfo?.hasNextPage && !loading) {
      fetchMore({
        variables: {
          after: data.myStrategies.pageInfo.endCursor,
        },
      });
    }
  }, [data?.myStrategies?.pageInfo, loading, fetchMore]);

  // Prevent menu close when clicking search
  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent) => {
    event.stopPropagation();
  }, []);

  // Reset search when unmounting
  useEffect(() => {
    return () => setSearchInput('');
  }, []);

  const totalCount = (data?.myStrategies?.totalCount ?? 0) +
    (showPublicStrategies ? (data?.publicStrategies?.totalCount ?? 0) : 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {totalCount} strateg{totalCount !== 1 ? 'ies' : 'y'} available
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={latestOnly}
                onChange={(e) => setLatestOnly(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption">
                Latest only
              </Typography>
            }
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showPublicStrategies}
                onChange={(e) => setShowPublicStrategies(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption">
                Public
              </Typography>
            }
          />
        </Box>
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
              placeholder="Search strategies..."
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
          {strategies.map((strategy) => (
            <MenuItem key={strategy.id} value={strategy.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>{strategy.name}</Typography>
                  {!strategy.isOwn && (
                    <Chip
                      icon={<PublicIcon />}
                      label="Public"
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Chip
                    label={`v${strategy.versionNumber}`}
                    size="small"
                    color={strategy.isLatest ? 'primary' : 'default'}
                    variant={strategy.isLatest ? 'filled' : 'outlined'}
                  />
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
        {strategies.length === 0 && !loading && (
          <FormHelperText error>
            No strategies available.
          </FormHelperText>
        )}
      </FormControl>
    </Box>
  );
};