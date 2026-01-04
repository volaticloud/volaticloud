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
    // Token revocation config (best practice for Keycloak 18+)
    revokeTokensOnSignout: true,
    revokeTokenTypes: ['access_token', 'refresh_token'],
    onSigninCallback: () => {
      // Required: Remove OIDC parameters from URL to enable silent token renewal
      const urlParams = new URLSearchParams(window.location.search);

      // Get return path from sessionStorage (Keycloak overwrites state parameter)
      const returnPath = sessionStorage.getItem('kc_return_path') || '/';
      sessionStorage.removeItem('kc_return_path');

      // Remove OIDC-specific parameters
      urlParams.delete('code');
      urlParams.delete('state');
      urlParams.delete('session_state');
      urlParams.delete('iss');

      // Build final URL with return path and any remaining Keycloak params
      const finalUrl = urlParams.toString()
        ? `${returnPath}?${urlParams.toString()}`
        : returnPath;

      console.log('[onSigninCallback] Navigating to:', finalUrl);

      // Use window.location.replace to actually navigate (triggers React Router)
      window.location.replace(finalUrl);
    },
    onSignoutCallback: () => {
      // Clean up after logout
      window.history.replaceState({}, document.title, window.location.pathname);
    },
  };
};