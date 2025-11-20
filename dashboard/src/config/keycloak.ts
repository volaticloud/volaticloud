import { AuthProviderProps } from 'react-oidc-context';

/**
 * Creates OIDC configuration for Keycloak integration
 * Configuration values are passed from the config context
 */
export const createOidcConfig = (
  authority: string,
  clientId: string,
  redirectUri?: string,
  postLogoutRedirectUri?: string
): AuthProviderProps => {
  return {
    authority,
    client_id: clientId,
    redirect_uri: redirectUri || window.location.origin,
    post_logout_redirect_uri: postLogoutRedirectUri || window.location.origin,
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: true,
    loadUserInfo: true,
    // Enable session monitoring to detect external logouts
    monitorSession: true,
    // Check session every 2 seconds (Keycloak default)
    checkSessionInterval: 2000,
    // Token revocation config (best practice for Keycloak 18+)
    revokeTokensOnSignout: true,
    revokeTokenTypes: ['access_token', 'refresh_token'],
    onSigninCallback: () => {
      // Remove query parameters after successful login
      window.history.replaceState({}, document.title, window.location.pathname);
    },
    onSignoutCallback: () => {
      // Clean up after logout
      window.history.replaceState({}, document.title, window.location.pathname);
    },
  };
};