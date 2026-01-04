import { useState, useEffect } from 'react';
import { Box, TextField, Button, Alert, CircularProgress } from '@mui/material';
import type { KeycloakUserProfile, UpdateProfileRequest } from '../../services/keycloak';

interface ProfileInfoFormProps {
  profile: KeycloakUserProfile;
  onSave: (data: UpdateProfileRequest) => Promise<boolean>;
  onCancel: () => void;
  loading: boolean;
}

export const ProfileInfoForm = ({
  profile,
  onSave,
  onCancel,
  loading,
}: ProfileInfoFormProps) => {
  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [email, setEmail] = useState(profile.email || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstName(profile.firstName || '');
    setLastName(profile.lastName || '');
    setEmail(profile.email || '');
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const data: UpdateProfileRequest = {
        firstName,
        lastName,
        email,
      };

      const success = await onSave(data);
      if (!success) {
        setError('Failed to update profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const isChanged =
    firstName !== (profile.firstName || '') ||
    lastName !== (profile.lastName || '') ||
    email !== (profile.email || '');

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 3 }}>
        <TextField
          label="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          fullWidth
          autoComplete="given-name"
        />

        <TextField
          label="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          fullWidth
          autoComplete="family-name"
        />

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          autoComplete="email"
          helperText="Changing your email may require verification"
        />

        {error && <Alert severity="error">{error}</Alert>}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={saving || !isChanged || loading}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
};
