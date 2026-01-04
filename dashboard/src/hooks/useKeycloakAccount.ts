import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConfigValue } from '../contexts/ConfigContext';
import {
  createKeycloakAccountApi,
  KeycloakAccountApiError,
  type KeycloakUserProfile,
  type UpdateProfileRequest,
  type ChangePasswordRequest,
  type KeycloakSession,
  type KeycloakCredentialType,
} from '../services/keycloak';

interface UseKeycloakAccountReturn {
  // Profile
  profile: KeycloakUserProfile | null;
  loadingProfile: boolean;
  errorProfile: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<boolean>;

  // Sessions
  sessions: KeycloakSession[];
  loadingSessions: boolean;
  errorSessions: string | null;
  refreshSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<boolean>;

  // Password
  changePassword: (data: ChangePasswordRequest) => Promise<boolean>;

  // Credentials (for 2FA status)
  credentials: KeycloakCredentialType[];
  loadingCredentials: boolean;
  refreshCredentials: () => Promise<void>;
  deleteCredential: (credentialId: string) => Promise<boolean>;
}

/**
 * Hook to interact with Keycloak Account API
 * Provides methods to manage user profile, sessions, and credentials
 */
export function useKeycloakAccount(): UseKeycloakAccountReturn {
  const auth = useAuth();
  const authority = useConfigValue('VOLATICLOUD__KEYCLOAK_AUTHORITY');

  // Parse authority to extract base URL and realm
  // Authority format: http://localhost:8180/realms/dev
  const { keycloakUrl, realm } = useMemo(() => {
    const authorityUrl = new URL(authority);
    const pathParts = authorityUrl.pathname.split('/');
    const realmIndex = pathParts.indexOf('realms');
    const realm = realmIndex !== -1 ? pathParts[realmIndex + 1] : 'dev';
    const keycloakUrl = `${authorityUrl.protocol}//${authorityUrl.host}`;
    return { keycloakUrl, realm };
  }, [authority]);

  // Create API client
  const api = useMemo(() => {
    const getAccessToken = () => auth.user?.access_token;
    return createKeycloakAccountApi(keycloakUrl, realm, getAccessToken);
  }, [keycloakUrl, realm, auth.user?.access_token]);

  // Profile state
  const [profile, setProfile] = useState<KeycloakUserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);

  // Sessions state
  const [sessions, setSessions] = useState<KeycloakSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [errorSessions, setErrorSessions] = useState<string | null>(null);

  // Credentials state
  const [credentials, setCredentials] = useState<KeycloakCredentialType[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(false);

  // Fetch profile
  const refreshProfile = useCallback(async () => {
    setLoadingProfile(true);
    setErrorProfile(null);
    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (error) {
      const message =
        error instanceof KeycloakAccountApiError
          ? error.message
          : 'Failed to load profile';
      setErrorProfile(message);
      console.error('Error fetching profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  }, [api]);

  // Update profile
  const updateProfile = useCallback(
    async (data: UpdateProfileRequest): Promise<boolean> => {
      setLoadingProfile(true);
      setErrorProfile(null);
      try {
        const updated = await api.updateProfile(data);
        setProfile(updated);
        return true;
      } catch (error) {
        const message =
          error instanceof KeycloakAccountApiError
            ? error.message
            : 'Failed to update profile';
        setErrorProfile(message);
        console.error('Error updating profile:', error);
        return false;
      } finally {
        setLoadingProfile(false);
      }
    },
    [api]
  );

  // Fetch sessions
  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    setErrorSessions(null);
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (error) {
      const message =
        error instanceof KeycloakAccountApiError
          ? error.message
          : 'Failed to load sessions';
      setErrorSessions(message);
      console.error('Error fetching sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, [api]);

  // Delete session
  const deleteSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        await api.deleteSession(sessionId);
        // Refresh sessions list after deletion
        await refreshSessions();
        return true;
      } catch (error) {
        const message =
          error instanceof KeycloakAccountApiError
            ? error.message
            : 'Failed to delete session';
        setErrorSessions(message);
        console.error('Error deleting session:', error);
        return false;
      }
    },
    [api, refreshSessions]
  );

  // Change password
  const changePassword = useCallback(
    async (data: ChangePasswordRequest): Promise<boolean> => {
      await api.changePassword(data);
      return true;
    },
    [api]
  );

  // Fetch credentials (for 2FA status)
  const refreshCredentials = useCallback(async () => {
    setLoadingCredentials(true);
    try {
      const data = await api.getCredentials();
      setCredentials(data);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      // Don't throw - credentials are optional
    } finally {
      setLoadingCredentials(false);
    }
  }, [api]);

  // Delete credential (OTP device, etc.)
  const deleteCredential = useCallback(
    async (credentialId: string): Promise<boolean> => {
      try {
        await api.deleteCredential(credentialId);
        // Refresh credentials to update list
        await refreshCredentials();
        return true;
      } catch (error) {
        console.error('Error deleting credential:', error);
        throw error;
      }
    },
    [api, refreshCredentials]
  );

  // Load profile on mount
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return {
    profile,
    loadingProfile,
    errorProfile,
    refreshProfile,
    updateProfile,

    sessions,
    loadingSessions,
    errorSessions,
    refreshSessions,
    deleteSession,

    changePassword,

    credentials,
    loadingCredentials,
    refreshCredentials,
    deleteCredential,
  };
}
