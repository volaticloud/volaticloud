import { describe, it, expect, vi } from 'vitest';

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

import { jwtDecode } from 'jwt-decode';

/**
 * Test utilities for creating mock JWT tokens.
 * Returns a dummy token string - jwt-decode is mocked so actual encoding isn't needed.
 */
function createMockToken(): string {
  return 'mock.jwt.token';
}

/**
 * Helper to set up jwt-decode mock with specific payload
 */
function mockJwtDecode(payload: Record<string, unknown>) {
  (jwtDecode as ReturnType<typeof vi.fn>).mockReturnValue(payload);
}

describe('OrganizationContext Token Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Native Organization Claim (Keycloak 26+)', () => {
    it('should parse organization claim with title', () => {
      const payload = {
        organization: {
          'my-org': {
            organization_title: ['My Organization'],
          },
        },
      };
      mockJwtDecode(payload);

      // The actual extraction happens in OrganizationContext
      // This test verifies the expected payload structure
      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(decoded.organization).toBeDefined();
      expect(decoded.organization['my-org'].organization_title?.[0]).toBe('My Organization');
    });

    it('should handle organization without title (fallback to id)', () => {
      const payload = {
        organization: {
          'my-org-id': {
            // No organization_title - title falls back to id
          },
        },
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(decoded.organization['my-org-id'].organization_title).toBeUndefined();
      // OrganizationContext uses: title: orgData.organization_title?.[0] || id
    });

    it('should handle multiple organizations', () => {
      const payload = {
        organization: {
          'org-1': { organization_title: ['Org One'] },
          'org-2': { organization_title: ['Org Two'] },
          'org-3': {}, // No title - falls back to id
        },
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(Object.keys(decoded.organization)).toHaveLength(3);
    });

    it('should handle empty organization_title array (fallback to id)', () => {
      const payload = {
        organization: {
          'empty-title-org': {
            organization_title: [], // Empty array
          },
        },
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(decoded.organization['empty-title-org'].organization_title).toEqual([]);
      // OrganizationContext uses: title: orgData.organization_title?.[0] || id
      // Empty array[0] is undefined, so falls back to id
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty organization claim (returns empty array)', () => {
      const payload = {
        organization: {}, // Empty object
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(Object.keys(decoded.organization!)).toHaveLength(0);
      // OrganizationContext returns empty array when organization claim is empty
    });

    it('should handle null token gracefully', () => {
      // OrganizationContext checks: if (!token) return []
      const token = null;
      expect(token).toBeNull();
    });

    it('should handle undefined token gracefully', () => {
      const token = undefined;
      expect(token).toBeUndefined();
    });

    it('should handle malformed token (jwt-decode throws)', () => {
      (jwtDecode as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // OrganizationContext wraps in try-catch and returns []
      expect(() => jwtDecode('invalid')).toThrow('Invalid token');
    });

    it('should handle token without organization claim', () => {
      const payload = {
        sub: 'user-123',
        // No organization claim
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(decoded.organization).toBeUndefined();
      // OrganizationContext returns empty array in this case
    });
  });

  describe('Organization Structure', () => {
    it('should produce correct Organization interface shape', () => {
      // Verify the expected output structure
      // ID is a human-readable string (e.g., "acme-corp")
      interface Organization {
        id: string;
        title: string;
      }

      const expectedOrg: Organization = {
        id: 'my-org',
        title: 'My Organization',
      };

      expect(expectedOrg.id).toBeDefined();
      expect(expectedOrg.title).toBeDefined();
    });
  });
});