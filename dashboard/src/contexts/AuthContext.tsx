import React, { ReactNode, useEffect, useMemo, useRef } from 'react';
import { AuthProvider as OidcAuthProvider, useAuth } from 'react-oidc-context';
import { Box, CircularProgress, Typography } from '@mui/material';
import { createOidcConfig, buildSigninState } from '../config/keycloak';
import { useConfigValue } from './ConfigContext';
import { ORG_ID_PARAM } from '../constants/url';

/**
 * Checks if this is an invitation callback (OAuth params without stored state).
 * Returns true if we should skip normal OIDC callback processing.
 */
function isInvitationCallback(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  const hasCode = urlParams.has('code');
  const hasOrgId = urlParams.has(ORG_ID_PARAM);

  if (!hasCode || !hasOrgId) {
    return false;
  }

  // Check if there's a stored state that would match this callback
  // oidc-client-ts stores state in sessionStorage with prefix "oidc."
  const hasStoredState = Object.keys(sessionStorage).some(key => key.startsWith('oidc.'));

  // If we have code + orgId but no stored OIDC state, this is likely an invitation callback
  return !hasStoredState;
}

/**
 * Handles invitation callback by clearing OAuth params and preserving orgId.
 * The user will then be redirected to login (and auto-logged-in if Keycloak session is active).
 */
function handleInvitationCallback(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const orgId = urlParams.get(ORG_ID_PARAM);

  // Clear OAuth params, keep orgId
  const newUrl = orgId ? `/?${ORG_ID_PARAM}=${orgId}` : '/';

  console.log('Detected invitation callback, clearing OAuth params and preserving orgId');
  window.location.replace(newUrl);
}

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
 * Inner component that handles authentication state and renders children
 * Must be inside OidcAuthProvider to use useAuth hook
 */
const AuthStateHandler: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const hasRefreshedOnLoad = useRef(false);

  // Force token refresh on every page load
  useEffect(() => {
    // Skip if already refreshed this session, still loading, or during callback
    if (hasRefreshedOnLoad.current || auth.isLoading || window.location.search.includes('code=')) {
      return;
    }

    // Force token refresh on page load if user is authenticated
    if (auth.isAuthenticated && auth.user) {
      hasRefreshedOnLoad.current = true;
      console.log('Refreshing token on page load...');
      auth.signinSilent().then(() => {
        console.log('Token refreshed successfully on page load');
      }).catch((err) => {
        console.error('Failed to refresh token on page load:', err);
        // If silent refresh fails, redirect to login with state to preserve orgId
        auth.signinRedirect({ state: buildSigninState() });
      });
    }
  }, [auth]);

  // Handle authentication state changes
  useEffect(() => {
    // Handle redirect callback after login
    if (window.location.search.includes('code=') || window.location.search.includes('state=')) {
      return;
    }

    // Auto sign-in if not authenticated - pass state to preserve orgId
    if (!auth.isAuthenticated && !auth.isLoading && !auth.error) {
      auth.signinRedirect({ state: buildSigninState() });
    }
  }, [auth]);

  // Monitor session and detect external logouts
  useEffect(() => {
    // Skip if still loading or during callback
    if (auth.isLoading || window.location.search.includes('code=')) {
      return;
    }

    // Detect when user becomes unauthenticated (external logout)
    // This happens when Keycloak session is terminated from another source
    if (!auth.isAuthenticated && !auth.error) {
      console.log('Session terminated externally, redirecting to login...');
      auth.signinRedirect({ state: buildSigninState() });
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.error, auth]);

  // Monitor auth events for session changes
  useEffect(() => {
    // Listen for session terminated event
    const handleUserUnloaded = () => {
      console.log('User session unloaded, redirecting to login...');
      auth.signinRedirect({ state: buildSigninState() });
    };

    // Subscribe to auth events
    auth.events.addUserUnloaded(handleUserUnloaded);

    // Cleanup event listener
    return () => {
      auth.events.removeUserUnloaded(handleUserUnloaded);
    };
  }, [auth]);

  // Handle authentication errors - always redirect to login for better UX
  useEffect(() => {
    if (auth.error && !auth.isLoading) {
      console.error('Authentication error detected:', auth.error.message);
      console.log('Redirecting to login page...');
      // Clear error state and redirect to login
      // This handles all auth errors: expired tokens, invalid tokens, network issues, etc.
      void auth.removeUser();
      auth.signinRedirect({ state: buildSigninState() });
    }
  }, [auth.error, auth.isLoading, auth]);

  // Show loading state
  if (auth.isLoading) {
    return <AuthLoading />;
  }

  // If there's an error, show loading while redirecting to login
  if (auth.error) {
    return <AuthLoading />;
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
  const authority = useConfigValue('VOLATICLOUD__KEYCLOAK_AUTHORITY');
  const clientId = useConfigValue('VOLATICLOUD__KEYCLOAK_CLIENT_ID');
  const redirectUri = useConfigValue('VOLATICLOUD__KEYCLOAK_REDIRECT_URI');
  const postLogoutRedirectUri = useConfigValue('VOLATICLOUD__KEYCLOAK_POST_LOGOUT_REDIRECT_URI');

  // Handle invitation callback before OIDC initialization
  // This detects when user returns from invitation registration with OAuth params
  // but no stored OIDC state (because login wasn't initiated by our app)
  useEffect(() => {
    if (isInvitationCallback()) {
      handleInvitationCallback();
    }
  }, []);

  // Create OIDC config with memoization
  const oidcConfig = useMemo(
    () => createOidcConfig(authority, clientId, redirectUri, postLogoutRedirectUri),
    [authority, clientId, redirectUri, postLogoutRedirectUri]
  );

  // If handling invitation callback, show loading while redirecting
  if (isInvitationCallback()) {
    return <AuthLoading />;
  }

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
