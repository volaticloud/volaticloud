import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOrganizationPermission } from './useOrganizationPermission';

// Mock dependencies
const mockActiveOrganizationId = vi.fn<[], string | null>();
const mockCan = vi.fn<[string, string], boolean>();
const mockErrors = new Map<string, string>();

vi.mock('../contexts/OrganizationContext', () => ({
  useActiveOrganization: () => ({
    activeOrganizationId: mockActiveOrganizationId(),
  }),
}));

vi.mock('../contexts/PermissionContext', () => ({
  usePermissionContext: () => ({
    can: mockCan,
    loading: false,
    errors: mockErrors,
  }),
}));

describe('useOrganizationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockErrors.clear();
    mockActiveOrganizationId.mockReturnValue('test-org');
    mockCan.mockReturnValue(true);
  });

  describe('when no active organization', () => {
    it('should return allowed: false when no active organization', () => {
      mockActiveOrganizationId.mockReturnValue(null);

      const { result } = renderHook(() => useOrganizationPermission('create-bot'));

      expect(result.current.allowed).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.organizationId).toBeNull();
    });
  });

  describe('when active organization exists', () => {
    it('should call can() with correct parameters', () => {
      mockActiveOrganizationId.mockReturnValue('acme-corp');
      mockCan.mockReturnValue(true);

      renderHook(() => useOrganizationPermission('create-strategy'));

      expect(mockCan).toHaveBeenCalledWith('acme-corp', 'create-strategy');
    });

    it('should return allowed: true when permission is granted', () => {
      mockActiveOrganizationId.mockReturnValue('my-org');
      mockCan.mockReturnValue(true);

      const { result } = renderHook(() => useOrganizationPermission('create-bot'));

      expect(result.current.allowed).toBe(true);
      expect(result.current.organizationId).toBe('my-org');
    });

    it('should return allowed: false when permission is denied', () => {
      mockActiveOrganizationId.mockReturnValue('my-org');
      mockCan.mockReturnValue(false);

      const { result } = renderHook(() => useOrganizationPermission('create-exchange'));

      expect(result.current.allowed).toBe(false);
      expect(result.current.organizationId).toBe('my-org');
    });
  });

  describe('error handling', () => {
    it('should return error from permission context', () => {
      mockActiveOrganizationId.mockReturnValue('error-org');
      mockErrors.set('error-org:create-runner', 'Network error - max retries exceeded');

      const { result } = renderHook(() => useOrganizationPermission('create-runner'));

      expect(result.current.error).toBe('Network error - max retries exceeded');
    });

    it('should return null error when no error exists', () => {
      mockActiveOrganizationId.mockReturnValue('ok-org');
      // No error set for 'ok-org:create-bot'

      const { result } = renderHook(() => useOrganizationPermission('create-bot'));

      expect(result.current.error).toBeNull();
    });
  });

  describe('different scopes', () => {
    it.each([
      'create-strategy',
      'create-bot',
      'create-exchange',
      'create-runner',
      'view',
      'edit',
    ] as const)('should work with %s scope', (scope) => {
      mockActiveOrganizationId.mockReturnValue('test-org');
      mockCan.mockReturnValue(true);

      const { result } = renderHook(() => useOrganizationPermission(scope));

      expect(mockCan).toHaveBeenCalledWith('test-org', scope);
      expect(result.current.allowed).toBe(true);
    });
  });

  describe('memoization', () => {
    it('should return same object reference when inputs unchanged', () => {
      mockActiveOrganizationId.mockReturnValue('stable-org');
      mockCan.mockReturnValue(true);

      const { result, rerender } = renderHook(() => useOrganizationPermission('create-bot'));

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      // With useMemo, the object reference should be stable
      expect(firstResult).toBe(secondResult);
    });
  });
});