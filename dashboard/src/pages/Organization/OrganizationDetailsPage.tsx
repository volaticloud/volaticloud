import { Paper, Typography, Box } from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const OrganizationDetailsPage = () => {
  useDocumentTitle('Organization Details');
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Organization Details
      </Typography>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <BusinessIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h6">
            Organization Information
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Manage your organization's name, settings, and configuration.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Coming soon...
        </Typography>
      </Paper>
    </Box>
  );
};