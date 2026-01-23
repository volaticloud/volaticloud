import { useState, useMemo } from 'react';
import {
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
  Typography,
  TextField,
  InputAdornment,
  ListSubheader,
  Divider,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { ORG_ID_PARAM } from '../../constants/url';
import { CreateOrganizationDrawer } from '../Organization/CreateOrganizationDrawer';

interface OrganizationSwitcherProps {
  fullWidth?: boolean;
}

const CREATE_ORG_VALUE = '__create_new_org__';

export function OrganizationSwitcher({ fullWidth = false }: OrganizationSwitcherProps) {
  const navigate = useNavigate();
  const { activeOrganizationId, activeOrganization, organizations, setActiveOrganization } =
    useActiveOrganization();
  const [searchText, setSearchText] = useState('');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const handleChange = (event: SelectChangeEvent) => {
    const newValue = event.target.value;

    if (newValue === CREATE_ORG_VALUE) {
      setCreateDrawerOpen(true);
      return;
    }

    setActiveOrganization(newValue);
    navigate(`/?${ORG_ID_PARAM}=${newValue}`);
  };

  const filteredOrgs = useMemo(() => {
    if (!searchText) return organizations;
    const searchLower = searchText.toLowerCase();
    return organizations.filter(
      (org) =>
        org.title.toLowerCase().includes(searchLower) ||
        org.id.toLowerCase().includes(searchLower)
    );
  }, [organizations, searchText]);

  // Don't render if no organizations available
  if (organizations.length === 0) {
    return null;
  }

  // Don't render switcher if only one organization - just show the org name and add button
  if (organizations.length === 1) {
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2 }}>
          <BusinessIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {activeOrganization?.title || activeOrganizationId}
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateDrawerOpen(true)}
            sx={{ ml: 1, minWidth: 'auto', fontSize: '0.75rem' }}
          >
            New
          </Button>
        </Box>
        <CreateOrganizationDrawer
          open={createDrawerOpen}
          onClose={() => setCreateDrawerOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <Select
        size="small"
        id="organization-select"
        value={activeOrganizationId || ''}
        onChange={handleChange}
        displayEmpty
        fullWidth={fullWidth}
        startAdornment={<BusinessIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
        onClose={() => setSearchText('')}
        MenuProps={{
          autoFocus: false,
          PaperProps: {
            sx: { maxHeight: 350 },
          },
        }}
        sx={{
          minWidth: fullWidth ? undefined : 200,
          '& .MuiSelect-select': {
            py: 1,
            fontSize: '0.875rem',
          },
        }}
      >
        <ListSubheader sx={{ p: 1, lineHeight: 'unset' }}>
          <TextField
            size="small"
            autoFocus
            placeholder="Search..."
            fullWidth
            aria-label="Search organizations"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: '0.875rem',
              },
            }}
          />
        </ListSubheader>
        {filteredOrgs.map((org) => (
          <MenuItem key={org.id} value={org.id} sx={{ fontSize: '0.875rem' }}>
            {org.title}
          </MenuItem>
        ))}
        {filteredOrgs.length === 0 && (
          <MenuItem disabled sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            No organizations found
          </MenuItem>
        )}
        <Divider sx={{ my: 1 }} />
        <MenuItem value={CREATE_ORG_VALUE} sx={{ fontSize: '0.875rem', color: 'primary.main' }}>
          <AddIcon fontSize="small" sx={{ mr: 1 }} />
          Create New Organization
        </MenuItem>
      </Select>
      <CreateOrganizationDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
      />
    </>
  );
}