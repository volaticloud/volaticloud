/**
 * Keycloak Account API Client
 *
 * Client for interacting with the Keycloak Account REST API.
 * Provides methods for user profile management, session management,
 * password changes, and credential management.
 *
 * Note: The Keycloak Account API is not officially documented but is stable.
 * See: https://github.com/keycloak/keycloak/discussions/10796
 */

import {
  KeycloakUserProfile,
  UpdateProfileRequest,
  ChangePasswordRequest,
  KeycloakSession,
  KeycloakCredentialType,
  LinkedAccount,
  KeycloakErrorResponse,
  KeycloakAccountApiError,
  OTPRegistrationResponse,
  OTPVerifyRequest,
} from './accountApi.types';

/**
 * Keycloak Account API Client
 *
 * Base URL pattern: {KEYCLOAK_URL}/realms/{REALM}/account
 */
export class KeycloakAccountApi {
  constructor(
    private baseUrl: string,  // e.g., "https://auth.volaticloud.com"
    private realm: string,    // e.g., "volaticloud"
    private getAccessToken: () => string | undefined
  ) {}

  private get accountBaseUrl(): string {
    return `${this.baseUrl}/realms/${this.realm}/account`;
  }

  /**
   * Generic request method with authentication and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAccessToken();
    if (!token) {
      throw new KeycloakAccountApiError('No access token available', 401);
    }

    const url = `${this.accountBaseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    // Handle 401/403 - token expired or insufficient permissions
    if (response.status === 401) {
      throw new KeycloakAccountApiError('Unauthorized - token may be expired', 401);
    }

    if (response.status === 403) {
      throw new KeycloakAccountApiError('Forbidden - insufficient permissions', 403);
    }

    // Parse response
    let data: T | KeycloakErrorResponse;
    try {
      data = await response.json();
    } catch {
      // Some endpoints return empty responses (e.g., DELETE)
      if (response.ok) {
        return {} as T;
      }
      throw new KeycloakAccountApiError(
        `Request failed: ${response.statusText}`,
        response.status
      );
    }

    // Check for Keycloak error response
    if (!response.ok) {
      const errorResponse = data as KeycloakErrorResponse;
      throw new KeycloakAccountApiError(
        errorResponse.errorMessage || errorResponse.error || 'Unknown error',
        response.status,
        errorResponse.error
      );
    }

    return data as T;
  }

  // ==================== Profile Methods ====================

  /**
   * Get current user profile
   * GET /account
   */
  async getProfile(): Promise<KeycloakUserProfile> {
    return this.request<KeycloakUserProfile>('/');
  }

  /**
   * Update user profile
   * POST /account
   */
  async updateProfile(profile: UpdateProfileRequest): Promise<KeycloakUserProfile> {
    return this.request<KeycloakUserProfile>('/', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }

  // ==================== Sessions Methods ====================

  /**
   * Get all active sessions
   * GET /account/sessions
   */
  async getSessions(): Promise<KeycloakSession[]> {
    return this.request<KeycloakSession[]>('/sessions');
  }

  /**
   * Delete a specific session (logout from that device)
   * DELETE /account/sessions/{sessionId}
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.request<void>(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // ==================== Password Methods ====================

  /**
   * Change password
   * POST /account/credentials/password
   */
  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await this.request<void>('/credentials/password', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ==================== Credentials Methods ====================

  /**
   * Get user credentials (2FA, password, etc.)
   * GET /account/credentials
   *
   * Returns credential types with their associated credentials
   */
  async getCredentials(): Promise<KeycloakCredentialType[]> {
    return this.request<KeycloakCredentialType[]>('/credentials');
  }

  /**
   * Delete a credential
   * DELETE /account/credentials/{credentialId}
   */
  async deleteCredential(credentialId: string): Promise<void> {
    await this.request<void>(`/credentials/${credentialId}`, {
      method: 'DELETE',
    });
  }

  // ==================== OTP Methods ====================

  /**
   * Register OTP device (start 2FA setup)
   * POST /account/credentials/otp/register
   * Returns QR code and secret for authenticator app
   */
  async registerOTP(): Promise<OTPRegistrationResponse> {
    return this.request<OTPRegistrationResponse>('/credentials/otp/register', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  /**
   * Verify OTP code and complete registration
   * POST /account/credentials/otp/verify
   */
  async verifyOTP(request: OTPVerifyRequest): Promise<void> {
    await this.request<void>('/credentials/otp/verify', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ==================== Linked Accounts Methods ====================

  /**
   * Get linked OAuth accounts (Google, GitHub, etc.)
   * GET /account/linked-accounts
   */
  async getLinkedAccounts(): Promise<LinkedAccount[]> {
    return this.request<LinkedAccount[]>('/linked-accounts');
  }
}

/**
 * Factory function to create Keycloak Account API client
 */
export function createKeycloakAccountApi(
  keycloakUrl: string,
  realm: string,
  getAccessToken: () => string | undefined
): KeycloakAccountApi {
  return new KeycloakAccountApi(keycloakUrl, realm, getAccessToken);
}
