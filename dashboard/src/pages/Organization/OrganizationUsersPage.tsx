import { Paper, Typography, Box } from '@mui/material';
import { People as PeopleIcon } from '@mui/icons-material';

export const OrganizationUsersPage = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Users & Access
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <PeopleIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h6">
            User Management
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Manage users, roles, and access permissions for your organization.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Coming soon...
        </Typography>
      </Paper>
    </Box>
  );
};