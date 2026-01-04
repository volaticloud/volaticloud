import { Alert, Box } from '@mui/material';
import { ProfileInfo } from '../../components/Profile/ProfileInfo';
import { useKeycloakAccount } from '../../hooks/useKeycloakAccount';

export const ProfilePage = () => {
  const account = useKeycloakAccount();

  return (
    <Box>
      {account.errorProfile && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {account.errorProfile}
        </Alert>
      )}

      <ProfileInfo
        profile={account.profile}
        loading={account.loadingProfile}
        onUpdate={account.updateProfile}
      />
    </Box>
  );
};
