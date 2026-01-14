import { AuthProviderProps } from 'react-oidc-context';
import { User } from 'oidc-client-ts';
import { ORG_ID_PARAM } from '../constants/url';

// Custom state passed through OAuth flow
interface OAuthState {
  orgId?: string;
}

/**
 * Creates OIDC configuration for Keycloak integration.
 * Uses the OIDC state parameter to preserve orgId through the OAuth flow.
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
    revokeTokensOnSignout: true,
    revokeTokenTypes: ['access_token', 'refresh_token'],
    // onSigninCallback receives the User object with our custom state
    onSigninCallback: (user: User | void) => {
      // Get orgId from OIDC state (passed via signinRedirect)
      const state = user ? (user.state as OAuthState | undefined) : undefined;
      const orgIdFromState = state?.orgId;

      // Also check URL for orgId (invitation flow)
      const urlParams = new URLSearchParams(window.location.search);
      const orgIdFromUrl = urlParams.get(ORG_ID_PARAM);

      // Use state first, then URL fallback
      const orgId = orgIdFromState || orgIdFromUrl;

      // Build clean URL with orgId preserved
      const finalUrl = orgId ? `/?${ORG_ID_PARAM}=${orgId}` : '/';

      window.location.replace(finalUrl);
    },
    onSignoutCallback: () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    },
  };
};

/**
 * Builds the state object for signinRedirect, preserving orgId from URL.
 * This is the OIDC-standard way to pass data through the OAuth flow.
 */
export function buildSigninState(): OAuthState | undefined {
  const urlParams = new URLSearchParams(window.location.search);
  const orgId = urlParams.get(ORG_ID_PARAM);

  if (orgId) {
    return { orgId };
  }

  return undefined;
}
