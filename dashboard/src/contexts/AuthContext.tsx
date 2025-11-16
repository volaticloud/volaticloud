import React, { ReactNode, useEffect, useMemo } from 'react';
import { AuthProvider as OidcAuthProvider, useAuth } from 'react-oidc-context';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { createOidcConfig } from '../config/keycloak';
import { useConfigValue } from './ConfigContext';

interface AuthProviderWrapperProps {
  children: ReactNode;
}

/**
 * Loading component shown during authentication state initialization
 */
const AuthLoading: React.FC = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" color="textSecondary">
        Authenticating...
      </Typography>
    </Box>
  );
};

/**
 * Error component shown when authentication fails
 */
const AuthError: React.FC<{ error: Error }> = ({ error }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2,
        p: 3,
      }}
    >
      <Alert severity="error" sx={{ maxWidth: 600 }}>
        <Typography variant="h6" gutterBottom>
          Authentication Error
        </Typography>
        <Typography variant="body2">{error.message}</Typography>
      </Alert>
    </Box>
  );
};

/**
 * Inner component that handles authentication state and renders children
 * Must be inside OidcAuthProvider to use useAuth hook
 */
const AuthStateHandler: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();

  useEffect(() => {
    // Handle redirect callback after login
    if (window.location.search.includes('code=') || window.location.search.includes('state=')) {
      return;
    }

    // Auto sign-in if not authenticated
    if (!auth.isAuthenticated && !auth.isLoading && !auth.error) {
      auth.signinRedirect();
    }
  }, [auth]);

  // Show loading state
  if (auth.isLoading) {
    return <AuthLoading />;
  }

  // Show error state
  if (auth.error) {
    return <AuthError error={auth.error} />;
  }

  // User must be authenticated to see content
  if (!auth.isAuthenticated) {
    return <AuthLoading />;
  }

  // User is authenticated, render children
  return <>{children}</>;
};

/**
 * Auth Provider that wraps the app with OIDC authentication
 * Handles automatic sign-in and authentication state
 */
export const AuthProvider: React.FC<AuthProviderWrapperProps> = ({ children }) => {
  // Get config values from ConfigContext
  const authority = useConfigValue('ANYTRADE__KEYCLOAK_AUTHORITY');
  const clientId = useConfigValue('ANYTRADE__KEYCLOAK_CLIENT_ID');
  const redirectUri = useConfigValue('ANYTRADE__KEYCLOAK_REDIRECT_URI');
  const postLogoutRedirectUri = useConfigValue('ANYTRADE__KEYCLOAK_POST_LOGOUT_REDIRECT_URI');

  // Create OIDC config with memoization
  const oidcConfig = useMemo(
    () => createOidcConfig(authority, clientId, redirectUri, postLogoutRedirectUri),
    [authority, clientId, redirectUri, postLogoutRedirectUri]
  );

  return (
    <OidcAuthProvider {...oidcConfig}>
      <AuthStateHandler>{children}</AuthStateHandler>
    </OidcAuthProvider>
  );
};

/**
 * Export useAuth hook for use in components
 */
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth };