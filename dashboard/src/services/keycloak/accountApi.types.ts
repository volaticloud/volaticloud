/**
 * Keycloak Account API Type Definitions
 *
 * Type definitions for the Keycloak Account REST API.
 * Based on Keycloak source code and community usage patterns.
 *
 * Base URL: {KEYCLOAK_URL}/realms/{REALM}/account
 */

// ==================== User Profile Types ====================

export interface KeycloakUserProfile {
  id?: string;
  username?: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, string[]>;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  attributes?: Record<string, string[]>;
}

// ==================== Password Types ====================

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}

// ==================== Session Types ====================

export interface SessionClient {
  clientId: string;
  clientName?: string;
}

export interface KeycloakSession {
  id: string;
  ipAddress?: string;
  started?: number;  // Unix timestamp in seconds
  lastAccess?: number;  // Unix timestamp in seconds
  expires?: number;  // Unix timestamp in seconds
  clients?: SessionClient[];
  browser?: string;
  current?: boolean;
}

// ==================== Credential Types ====================

export interface KeycloakCredential {
  id: string;
  type: string;
  userLabel?: string;
  createdDate?: number;  // Unix timestamp in milliseconds
  credentialData?: string;
}

export interface KeycloakCredentialType {
  type: string;  // "password", "otp", etc.
  category: string;
  displayName: string;
  helptext: string;
  iconCssClass: string;
  createAction?: string;
  updateAction?: string;
  removeable: boolean;
  userCredentialMetadatas: Array<{
    credential: KeycloakCredential;
  }>;
}

// ==================== OTP Types ====================

export interface OTPRegistrationResponse {
  secret: string;
  qrCode: string;  // Data URL for QR code image
  totpSecretQrCode?: string;  // Alternative field name
  manualEntryEncoding?: string;
}

export interface OTPVerifyRequest {
  totp: string;
  userLabel?: string;
}

export interface OTPDeviceInfo {
  id: string;
  userLabel?: string;
  createdDate?: number;
}

// ==================== Linked Account Types ====================

export interface LinkedAccount {
  providerName: string;
  providerAlias: string;
  linked: boolean;
  social: boolean;
  displayName?: string;
}

// ==================== Error Types ====================

export interface KeycloakErrorResponse {
  error?: string;
  errorMessage?: string;
}

/**
 * Custom error class for Keycloak Account API errors
 */
export class KeycloakAccountApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public keycloakError?: string
  ) {
    super(message);
    this.name = 'KeycloakAccountApiError';
  }
}
