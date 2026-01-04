import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { ProfileInfoForm } from './ProfileInfoForm';
import type { KeycloakUserProfile, UpdateProfileRequest } from '../../services/keycloak';

interface ProfileInfoProps {
  profile: KeycloakUserProfile | null;
  loading: boolean;
  onUpdate: (data: UpdateProfileRequest) => Promise<boolean>;
}

export const ProfileInfo = ({ profile, loading, onUpdate }: ProfileInfoProps) => {
  const [editing, setEditing] = useState(false);

  if (loading && !profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary">
          Unable to load profile information
        </Typography>
      </Box>
    );
  }

  const handleSave = async (data: UpdateProfileRequest) => {
    const success = await onUpdate(data);
    if (success) {
      setEditing(false);
    }
    return success;
  };

  if (editing) {
    return (
      <ProfileInfoForm
        profile={profile}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
        loading={loading}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>
          Profile Information
        </Typography>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setEditing(true)}
        >
          Edit Profile
        </Button>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Username
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {profile.username || 'Not set'}
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary">
                Email
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" fontWeight={500}>
                  {profile.email || 'Not set'}
                </Typography>
                {profile.emailVerified && (
                  <Chip label="Verified" color="success" size="small" />
                )}
                {profile.emailVerified === false && (
                  <Chip label="Not Verified" color="warning" size="small" />
                )}
              </Box>
            </Box>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary">
                First Name
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {profile.firstName || 'Not set'}
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary">
                Last Name
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {profile.lastName || 'Not set'}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
