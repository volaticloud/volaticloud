import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KeycloakAccountApi,
  createKeycloakAccountApi,
} from './accountApi';
import { KeycloakAccountApiError } from './accountApi.types';
import type { KeycloakUserProfile, UpdateProfileRequest, ChangePasswordRequest } from './accountApi.types';

describe('KeycloakAccountApi', () => {
  let api: KeycloakAccountApi;
  let mockGetAccessToken: ReturnType<typeof vi.fn>;
  const baseUrl = 'https://keycloak.example.com';
  const realm = 'test-realm';

  beforeEach(() => {
    mockGetAccessToken = vi.fn(() => 'mock-token');
    api = new KeycloakAccountApi(baseUrl, realm, mockGetAccessToken);

    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe('constructor and factory', () => {
    it('should create instance with factory function', () => {
      const instance = createKeycloakAccountApi(baseUrl, realm, mockGetAccessToken);
      expect(instance).toBeInstanceOf(KeycloakAccountApi);
    });

    it('should construct correct account base URL', () => {
      const url = (api as any).accountBaseUrl;
      expect(url).toBe(`${baseUrl}/realms/${realm}/account`);
    });
  });

  describe('request method - authentication', () => {
    it('should throw error when no access token is available', async () => {
      const apiWithoutToken = new KeycloakAccountApi(baseUrl, realm, () => undefined);

      await expect(apiWithoutToken.getProfile()).rejects.toThrow('No access token available');
      await expect(apiWithoutToken.getProfile()).rejects.toThrow(KeycloakAccountApiError);
    });

    it('should include Bearer token in Authorization header', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'user-1' }),
      });

      await api.getProfile();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });
  });

  describe('request method - error handling', () => {
    it('should throw KeycloakAccountApiError on 401 Unauthorized', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      try {
        await api.getProfile();
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Unauthorized - token may be expired');
        expect(error.statusCode).toBe(401);
      }
    });

    it('should throw KeycloakAccountApiError on 403 Forbidden', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      try {
        await api.getProfile();
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Forbidden - insufficient permissions');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should handle JSON parse errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(api.getProfile()).rejects.toThrow('Request failed: Internal Server Error');
    });

    it('should parse and throw Keycloak error responses', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_request',
          errorMessage: 'Email already exists',
        }),
      });

      try {
        await api.getProfile();
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('Email already exists');
        expect(error.statusCode).toBe(400);
        expect(error.keycloakError).toBe('invalid_request');
      }
    });
  });

  describe('getProfile', () => {
    it('should fetch and return user profile', async () => {
      const mockProfile: KeycloakUserProfile = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProfile,
      });

      const result = await api.getProfile();

      expect(result).toEqual(mockProfile);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile and return updated data', async () => {
      const updateRequest: UpdateProfileRequest = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const mockResponse: KeycloakUserProfile = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        emailVerified: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.updateProfile(updateRequest);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(updateRequest),
        })
      );
    });
  });

  describe('getSessions', () => {
    it('should fetch and return sessions list', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          ipAddress: '192.168.1.1',
          started: new Date('2024-01-01').getTime(),
          lastAccess: new Date('2024-01-02').getTime(),
          expires: new Date('2024-01-03').getTime(),
          clients: [],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      });

      const result = await api.getSessions();

      expect(result).toEqual(mockSessions);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/sessions`,
        expect.any(Object)
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete session successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(api.deleteSession('session-123')).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/sessions/session-123`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle delete errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'not_found',
          errorMessage: 'Session not found',
        }),
      });

      await expect(api.deleteSession('invalid-session')).rejects.toThrow('Session not found');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const passwordChange: ChangePasswordRequest = {
        currentPassword: 'old-pass',
        newPassword: 'new-pass',
        confirmation: 'new-pass',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(api.changePassword(passwordChange)).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/credentials/password`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(passwordChange),
        })
      );
    });
  });

  describe('getCredentials', () => {
    it('should fetch credential types', async () => {
      const mockCredentials = [
        {
          type: 'password',
          category: 'basic-authentication',
          displayName: 'Password',
          userCredentialMetadatas: [],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCredentials,
      });

      const result = await api.getCredentials();

      expect(result).toEqual(mockCredentials);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/credentials`,
        expect.any(Object)
      );
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(api.deleteCredential('cred-123')).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/credentials/cred-123`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('OTP methods', () => {
    it('should register OTP device', async () => {
      const mockResponse = {
        qrCode: 'data:image/png;base64,...',
        secret: 'SECRET123',
        otpUrl: 'otpauth://totp/...',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.registerOTP();

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/credentials/otp/register`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should verify OTP code', async () => {
      const verifyRequest = {
        totp: '123456',
        userLabel: 'My Phone',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await expect(api.verifyOTP(verifyRequest)).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/credentials/otp/verify`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(verifyRequest),
        })
      );
    });
  });

  describe('getLinkedAccounts', () => {
    it('should fetch linked OAuth accounts', async () => {
      const mockLinkedAccounts = [
        {
          providerName: 'google',
          providerAlias: 'google',
          displayName: 'Google',
          linked: true,
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockLinkedAccounts,
      });

      const result = await api.getLinkedAccounts();

      expect(result).toEqual(mockLinkedAccounts);
      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/realms/${realm}/account/linked-accounts`,
        expect.any(Object)
      );
    });
  });
});

describe('KeycloakAccountApiError', () => {
  it('should create error with message and status', () => {
    const error = new KeycloakAccountApiError('Test error', 400);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.keycloakError).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
  });

  it('should create error with error code', () => {
    const error = new KeycloakAccountApiError('Invalid request', 400, 'invalid_input');

    expect(error.message).toBe('Invalid request');
    expect(error.statusCode).toBe(400);
    expect(error.keycloakError).toBe('invalid_input');
  });
});