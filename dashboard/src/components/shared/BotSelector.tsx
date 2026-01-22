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
import { useGetBotsForSelectorQuery, useGetBotByIdQuery } from './shared.generated';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface BotSelectorProps {
  value: string;
  onChange: (botId: string) => void;
  required?: boolean;
  label?: string;
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
}

interface BotOption {
  id: string;
  name: string;
  status: string;
  public: boolean;
  isOwn: boolean;
}

export const BotSelector = ({
  value,
  onChange,
  required = false,
  label = 'Bot',
  helperText,
  error = false,
  disabled = false,
}: BotSelectorProps) => {
  const { activeOrganizationId } = useActiveOrganization();
  const [showPublicBots, setShowPublicBots] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Main query for bot list
  const { data, loading, fetchMore } = useGetBotsForSelectorQuery({
    variables: {
      ownerID: activeOrganizationId || undefined,
      search: debouncedSearch || undefined,
      includePublic: showPublicBots,
      first: 20,
    },
    skip: !activeOrganizationId,
  });

  // Query for selected bot (to ensure it's always in the list)
  const { data: selectedBotData } = useGetBotByIdQuery({
    variables: { id: value },
    skip: !value,
  });

  // Extract selected bot from query result
  const selectedBot = useMemo(() => {
    return selectedBotData?.bots?.edges?.[0]?.node ?? null;
  }, [selectedBotData]);

  // Combine and deduplicate bots
  const bots = useMemo((): BotOption[] => {
    const myBots = data?.myBots?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      .map(bot => ({
        id: bot.id,
        name: bot.name,
        status: bot.status,
        public: bot.public,
        isOwn: true,
      })) || [];

    const publicBots = data?.publicBots?.edges
      ?.map(edge => edge?.node)
      .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
      .map(bot => ({
        id: bot.id,
        name: bot.name,
        status: bot.status,
        public: bot.public,
        isOwn: false,
      })) || [];

    const allBots = [...myBots, ...publicBots];

    // Add selected bot if not in list
    if (value && selectedBot) {
      const exists = allBots.some(b => b.id === selectedBot.id);
      if (!exists) {
        allBots.unshift({
          id: selectedBot.id,
          name: selectedBot.name,
          status: selectedBot.status,
          public: selectedBot.public,
          isOwn: selectedBot.public === false, // Assume own if not public
        });
      }
    }

    return allBots;
  }, [data, value, selectedBot]);

  // Handle scroll to load more
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;

    if (bottom && data?.myBots?.pageInfo?.hasNextPage && !loading) {
      fetchMore({
        variables: {
          after: data.myBots.pageInfo.endCursor,
        },
      });
    }
  }, [data?.myBots?.pageInfo, loading, fetchMore]);

  // Prevent menu close when clicking search
  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent) => {
    event.stopPropagation();
  }, []);

  // Reset search when opening
  useEffect(() => {
    return () => setSearchInput('');
  }, []);

  const totalCount = (data?.myBots?.totalCount ?? 0) + (showPublicBots ? (data?.publicBots?.totalCount ?? 0) : 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {totalCount} bot{totalCount !== 1 ? 's' : ''} available
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showPublicBots}
              onChange={(e) => setShowPublicBots(e.target.checked)}
            />
          }
          label={
            <Typography variant="caption">
              Show public bots
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
              placeholder="Search bots..."
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
          {bots.map((bot) => (
            <MenuItem key={bot.id} value={bot.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>{bot.name}</Typography>
                  {!bot.isOwn && (
                    <Chip
                      icon={<PublicIcon />}
                      label="Public"
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                  )}
                </Box>
                <Chip
                  label={bot.status}
                  size="small"
                  color={bot.status === 'running' ? 'success' : bot.status === 'error' ? 'error' : 'default'}
                  variant="outlined"
                />
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
        {bots.length === 0 && !loading && (
          <FormHelperText error>
            No bots available.
          </FormHelperText>
        )}
      </FormControl>
    </Box>
  );
};