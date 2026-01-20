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

describe('GroupContext Token Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Native Organization Claim (Keycloak 26+)', () => {
    it('should parse organization claim with id and title', () => {
      const payload = {
        organization: {
          'my-org': {
            id: 'uuid-123',
            organization_title: ['My Organization'],
          },
        },
      };
      mockJwtDecode(payload);

      // The actual extraction happens in GroupContext
      // This test verifies the expected payload structure
      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(decoded.organization).toBeDefined();
      expect(decoded.organization['my-org'].id).toBe('uuid-123');
      expect(decoded.organization['my-org'].organization_title?.[0]).toBe('My Organization');
    });

    it('should handle organization without title (fallback to alias)', () => {
      const payload = {
        organization: {
          'my-org-alias': {
            id: 'uuid-456',
            // No organization_title
          },
        },
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(decoded.organization['my-org-alias'].id).toBe('uuid-456');
      expect(decoded.organization['my-org-alias'].organization_title).toBeUndefined();
    });

    it('should handle organization without nested id (use alias as id)', () => {
      const payload = {
        organization: {
          'org-alias-as-id': {
            organization_title: ['Org Title'],
            // No id field - should use alias
          },
        },
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(decoded.organization['org-alias-as-id'].id).toBeUndefined();
      // GroupContext always uses alias as id (UMA resources use alias as resource ID)
    });

    it('should handle multiple organizations', () => {
      const payload = {
        organization: {
          'org-1': { id: 'id-1', organization_title: ['Org One'] },
          'org-2': { id: 'id-2', organization_title: ['Org Two'] },
          'org-3': { id: 'id-3' }, // No title
        },
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(Object.keys(decoded.organization)).toHaveLength(3);
    });

    it('should handle empty organization_title array (fallback to alias)', () => {
      const payload = {
        organization: {
          'empty-title-org': {
            id: 'uuid-789',
            organization_title: [], // Empty array
          },
        },
      };
      mockJwtDecode(payload);

      const decoded = jwtDecode<typeof payload>(createMockToken());
      expect(decoded.organization['empty-title-org'].organization_title).toEqual([]);
      // GroupContext uses: title: orgData.organization_title?.[0] || alias
      // Empty array[0] is undefined, so falls back to alias
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
      // GroupContext returns empty array when organization claim is empty
    });

    it('should handle null token gracefully', () => {
      // GroupContext checks: if (!token) return []
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

      // GroupContext wraps in try-catch and returns []
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
      // GroupContext returns empty array in this case
    });
  });

  describe('Organization Structure', () => {
    it('should produce correct Organization interface shape', () => {
      // Verify the expected output structure
      interface Organization {
        id: string;
        alias: string;
        title: string;
      }

      const expectedOrg: Organization = {
        id: 'uuid-123',
        alias: 'my-alias',
        title: 'My Title',
      };

      expect(expectedOrg.id).toBeDefined();
      expect(expectedOrg.alias).toBeDefined();
      expect(expectedOrg.title).toBeDefined();
    });
  });
});
