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
import { useActiveGroup } from '../../contexts/GroupContext';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { ORG_ID_PARAM } from '../../constants/url';
import { CreateOrganizationDialog } from '../Organization/CreateOrganizationDialog';

interface GroupSwitcherProps {
  fullWidth?: boolean;
}

const CREATE_ORG_VALUE = '__create_new_org__';

export function GroupSwitcher({ fullWidth = false }: GroupSwitcherProps) {
  const navigate = useNavigate();
  const { activeGroupId, activeOrganization, organizations, setActiveGroup } = useActiveGroup();
  const [searchText, setSearchText] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleChange = (event: SelectChangeEvent) => {
    const newValue = event.target.value;

    if (newValue === CREATE_ORG_VALUE) {
      setCreateDialogOpen(true);
      return;
    }

    setActiveGroup(newValue);
    navigate(`/?${ORG_ID_PARAM}=${newValue}`);
  };

  const filteredOrgs = useMemo(() => {
    if (!searchText) return organizations;
    return organizations.filter((org) =>
      org.title.toLowerCase().includes(searchText.toLowerCase())
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
            {activeOrganization?.title || activeGroupId}
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ ml: 1, minWidth: 'auto', fontSize: '0.75rem' }}
          >
            New
          </Button>
        </Box>
        <CreateOrganizationDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <Select
        size="small"
        id="group-select"
        value={activeGroupId || ''}
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
      <CreateOrganizationDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </>
  );
}
