import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useKeycloakAccount } from './useKeycloakAccount';
import type { KeycloakUserProfile } from '../services/keycloak/accountApi.types';

// Mock dependencies
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      access_token: 'mock-token',
    },
  }),
}));

vi.mock('../contexts/ConfigContext', () => ({
  useConfigValue: (key: string) => {
    if (key === 'VOLATICLOUD__KEYCLOAK_AUTHORITY') {
      return 'http://localhost:8180/realms/test';
    }
    return 'test-value';
  },
}));

// Mock the API module
const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockGetSessions = vi.fn();
const mockDeleteSession = vi.fn();
const mockChangePassword = vi.fn();
const mockGetCredentials = vi.fn();
const mockDeleteCredential = vi.fn();

vi.mock('../services/keycloak', () => ({
  createKeycloakAccountApi: () => ({
    getProfile: mockGetProfile,
    updateProfile: mockUpdateProfile,
    getSessions: mockGetSessions,
    deleteSession: mockDeleteSession,
    changePassword: mockChangePassword,
    getCredentials: mockGetCredentials,
    deleteCredential: mockDeleteCredential,
  }),
  KeycloakAccountApiError: class KeycloakAccountApiError extends Error {
    constructor(message: string, public statusCode?: number, public keycloakError?: string) {
      super(message);
      this.name = 'KeycloakAccountApiError';
    }
  },
}));

describe('useKeycloakAccount', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have initial state for all properties', async () => {
      mockGetProfile.mockResolvedValueOnce({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });

      const { result } = renderHook(() => useKeycloakAccount());

      // Wait for initial mount effect to complete
      await waitFor(() => {
        expect(result.current.loadingProfile).toBe(false);
      });

      expect(result.current.profile).toBeTruthy();
      expect(result.current.errorProfile).toBeNull();
      expect(result.current.sessions).toEqual([]);
      expect(result.current.loadingSessions).toBe(false);
      expect(result.current.errorSessions).toBeNull();
      expect(result.current.credentials).toEqual([]);
      expect(result.current.loadingCredentials).toBe(false);
    });
  });

  describe('refreshProfile', () => {
    it('should fetch profile on mount', async () => {
      const mockProfile: KeycloakUserProfile = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
      };

      mockGetProfile.mockResolvedValueOnce(mockProfile);

      const { result } = renderHook(() => useKeycloakAccount());

      await waitFor(() => {
        expect(result.current.profile).toEqual(mockProfile);
      });

      expect(mockGetProfile).toHaveBeenCalledTimes(1);
      expect(result.current.loadingProfile).toBe(false);
      expect(result.current.errorProfile).toBeNull();
    });

    it('should handle profile fetch errors', async () => {
      mockGetProfile.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useKeycloakAccount());

      await waitFor(() => {
        expect(result.current.errorProfile).toBeTruthy();
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.errorProfile).toContain('Failed to load profile');
    });

    it('should set loading state during fetch', async () => {
      let resolveGetProfile: (value: KeycloakUserProfile) => void;
      const profilePromise = new Promise<KeycloakUserProfile>((resolve) => {
        resolveGetProfile = resolve;
      });

      mockGetProfile.mockReturnValueOnce(profilePromise);

      const { result } = renderHook(() => useKeycloakAccount());

      // Should be loading immediately
      await waitFor(() => {
        expect(result.current.loadingProfile).toBe(true);
      });

      // Resolve the promise
      resolveGetProfile!({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });

      // Should not be loading after resolution
      await waitFor(() => {
        expect(result.current.loadingProfile).toBe(false);
      });
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const initialProfile: KeycloakUserProfile = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
      };

      const updatedProfile: KeycloakUserProfile = {
        ...initialProfile,
        firstName: 'Updated',
      };

      mockGetProfile.mockResolvedValueOnce(initialProfile);
      mockUpdateProfile.mockResolvedValueOnce(updatedProfile);

      const { result } = renderHook(() => useKeycloakAccount());

      await waitFor(() => {
        expect(result.current.profile).toEqual(initialProfile);
      });

      // Update profile
      const success = await result.current.updateProfile({ firstName: 'Updated' });

      expect(success).toBe(true);
      expect(mockUpdateProfile).toHaveBeenCalledWith({ firstName: 'Updated' });

      await waitFor(() => {
        expect(result.current.profile).toEqual(updatedProfile);
      });
    });

    it('should handle update errors', async () => {
      mockGetProfile.mockResolvedValueOnce({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockUpdateProfile.mockRejectedValueOnce(new Error('Update failed'));

      const { result } = renderHook(() => useKeycloakAccount());

      await waitFor(() => {
        expect(result.current.profile).toBeTruthy();
      });

      const success = await result.current.updateProfile({ firstName: 'Updated' });

      expect(success).toBe(false);

      await waitFor(() => {
        expect(result.current.errorProfile).toContain('Failed to update profile');
      });
    });
  });

  describe('refreshSessions', () => {
    it('should fetch sessions', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });

      const mockSessions = [
        {
          id: 'session-1',
          ipAddress: '192.168.1.1',
          started: Date.now(),
          lastAccess: Date.now(),
          expires: Date.now() + 3600000,
          clients: [],
        },
      ];

      mockGetSessions.mockResolvedValueOnce(mockSessions);

      const { result } = renderHook(() => useKeycloakAccount());

      await result.current.refreshSessions();

      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions);
      });

      expect(mockGetSessions).toHaveBeenCalled();
      expect(result.current.loadingSessions).toBe(false);
      expect(result.current.errorSessions).toBeNull();
    });

    it('should handle session fetch errors', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockGetSessions.mockRejectedValueOnce(new Error('Fetch failed'));

      const { result } = renderHook(() => useKeycloakAccount());

      await result.current.refreshSessions();

      await waitFor(() => {
        expect(result.current.errorSessions).toBeTruthy();
      });

      expect(result.current.errorSessions).toContain('Failed to load sessions');
    });
  });

  describe('deleteSession', () => {
    it('should delete session and refresh list', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockDeleteSession.mockResolvedValueOnce(undefined);
      mockGetSessions.mockResolvedValue([]);

      const { result } = renderHook(() => useKeycloakAccount());

      const success = await result.current.deleteSession('session-123');

      expect(success).toBe(true);
      expect(mockDeleteSession).toHaveBeenCalledWith('session-123');
      expect(mockGetSessions).toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockDeleteSession.mockRejectedValueOnce(new Error('Delete failed'));

      const { result } = renderHook(() => useKeycloakAccount());

      const success = await result.current.deleteSession('session-123');

      expect(success).toBe(false);

      await waitFor(() => {
        expect(result.current.errorSessions).toContain('Failed to delete session');
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockChangePassword.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useKeycloakAccount());

      const success = await result.current.changePassword({
        currentPassword: 'old',
        newPassword: 'new',
        confirmation: 'new',
      });

      expect(success).toBe(true);
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'old',
        newPassword: 'new',
        confirmation: 'new',
      });
    });

    it('should throw error on password change failure', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockChangePassword.mockRejectedValueOnce(new Error('Wrong password'));

      const { result } = renderHook(() => useKeycloakAccount());

      await expect(
        result.current.changePassword({
          currentPassword: 'wrong',
          newPassword: 'new',
          confirmation: 'new',
        })
      ).rejects.toThrow();
    });
  });

  describe('refreshCredentials', () => {
    it('should fetch credentials', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });

      const mockCredentials = [
        {
          type: 'otp',
          category: 'two-factor',
          displayName: 'OTP',
          userCredentialMetadatas: [],
        },
      ];

      mockGetCredentials.mockResolvedValueOnce(mockCredentials);

      const { result } = renderHook(() => useKeycloakAccount());

      await result.current.refreshCredentials();

      await waitFor(() => {
        expect(result.current.credentials).toEqual(mockCredentials);
      });

      expect(result.current.loadingCredentials).toBe(false);
    });

    it('should handle credential fetch errors gracefully', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockGetCredentials.mockRejectedValueOnce(new Error('Fetch failed'));

      const { result } = renderHook(() => useKeycloakAccount());

      // Should not throw, just log error
      await result.current.refreshCredentials();

      await waitFor(() => {
        expect(result.current.loadingCredentials).toBe(false);
      });

      expect(result.current.credentials).toEqual([]);
    });
  });

  describe('deleteCredential', () => {
    it('should delete credential and refresh list', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockDeleteCredential.mockResolvedValueOnce(undefined);
      mockGetCredentials.mockResolvedValue([]);

      const { result } = renderHook(() => useKeycloakAccount());

      const success = await result.current.deleteCredential('cred-123');

      expect(success).toBe(true);
      expect(mockDeleteCredential).toHaveBeenCalledWith('cred-123');
      expect(mockGetCredentials).toHaveBeenCalled();
    });

    it('should throw error on delete failure', async () => {
      mockGetProfile.mockResolvedValue({
        id: 'user-1',
        username: 'test',
        email: 'test@test.com',
        emailVerified: true,
      });
      mockDeleteCredential.mockRejectedValueOnce(new Error('Delete failed'));

      const { result } = renderHook(() => useKeycloakAccount());

      await expect(result.current.deleteCredential('cred-123')).rejects.toThrow();
    });
  });
});