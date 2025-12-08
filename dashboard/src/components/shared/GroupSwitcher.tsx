import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Box,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useActiveGroup } from '../../contexts/GroupContext';
import BusinessIcon from '@mui/icons-material/Business';

export function GroupSwitcher() {
  const navigate = useNavigate();
  const { activeGroupId, availableGroups, setActiveGroup } = useActiveGroup();

  const handleChange = (event: SelectChangeEvent) => {
    const newGroupId = event.target.value;
    setActiveGroup(newGroupId);
    // Redirect to home page with the NEW organization (not preserving current)
    navigate(`/?groupId=${newGroupId}`);
  };

  // Don't render if no groups available
  if (availableGroups.length === 0) {
    return null;
  }

  // Don't render switcher if only one group
  if (availableGroups.length === 1) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2 }}>
        <BusinessIcon fontSize="small" color="action" />
        <Typography variant="body2" color="text.secondary">
          {activeGroupId}
        </Typography>
      </Box>
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="group-select-label">Organization</InputLabel>
      <Select
        labelId="group-select-label"
        id="group-select"
        value={activeGroupId || ''}
        label="Organization"
        onChange={handleChange}
        startAdornment={<BusinessIcon fontSize="small" sx={{ mr: 1 }} />}
      >
        {availableGroups.map((groupId) => (
          <MenuItem key={groupId} value={groupId}>
            {groupId}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}