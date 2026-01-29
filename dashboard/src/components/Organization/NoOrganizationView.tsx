import { useState } from 'react';
import { Box, Container, Paper, Typography, Button, Alert } from '@mui/material';
import { Business as BusinessIcon, Add as AddIcon } from '@mui/icons-material';
import { CreateOrganizationDrawer } from './CreateOrganizationDrawer';

export function NoOrganizationView() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={3}
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 2,
            }}
          >
            <BusinessIcon
              sx={{
                fontSize: 64,
                color: 'primary.main',
                mb: 2,
              }}
            />
            <Typography variant="h5" gutterBottom fontWeight="bold">
              Create Your Organization
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              You don't have any organizations yet. Create one to get started with VolatiCloud.
            </Typography>

            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<AddIcon />}
              onClick={() => setDrawerOpen(true)}
              sx={{ mt: 2 }}
            >
              Create Organization
            </Button>

            <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                As the creator, you will automatically become the administrator of this organization.
                You can invite other users after creating the organization.
              </Typography>
            </Alert>
          </Paper>
        </Container>
      </Box>
      <CreateOrganizationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        // onSuccess not needed — CreateOrganizationDrawer triggers signinRedirect
        // which creates a new Keycloak session with updated org claims
      />
    </>
  );
}
