import { describe, it, expect } from 'vitest';
import { extractOrganizationsFromToken } from './organizationUtils';

/**
 * Creates a JWT token with the given payload (no signature verification needed for jwtDecode).
 */
function createToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('extractOrganizationsFromToken', () => {
  it('extracts single organization with title', () => {
    const token = createToken({
      organization: {
        'my-org': { organization_title: ['My Organization'] },
      },
    });
    const orgs = extractOrganizationsFromToken(token);
    expect(orgs).toEqual([{ id: 'my-org', title: 'My Organization' }]);
  });

  it('extracts multiple organizations', () => {
    const token = createToken({
      organization: {
        'org-1': { organization_title: ['Org One'] },
        'org-2': { organization_title: ['Org Two'] },
      },
    });
    const orgs = extractOrganizationsFromToken(token);
    expect(orgs).toHaveLength(2);
    expect(orgs).toContainEqual({ id: 'org-1', title: 'Org One' });
    expect(orgs).toContainEqual({ id: 'org-2', title: 'Org Two' });
  });

  it('falls back to id when organization_title is missing', () => {
    const token = createToken({
      organization: {
        'my-org-id': {},
      },
    });
    const orgs = extractOrganizationsFromToken(token);
    expect(orgs).toEqual([{ id: 'my-org-id', title: 'my-org-id' }]);
  });

  it('falls back to id when organization_title array is empty', () => {
    const token = createToken({
      organization: {
        'empty-title': { organization_title: [] },
      },
    });
    const orgs = extractOrganizationsFromToken(token);
    expect(orgs).toEqual([{ id: 'empty-title', title: 'empty-title' }]);
  });

  it('returns empty array for empty organization claim', () => {
    const token = createToken({ organization: {} });
    const orgs = extractOrganizationsFromToken(token);
    expect(orgs).toEqual([]);
  });

  it('returns empty array when organization claim is missing', () => {
    const token = createToken({ sub: 'user-123' });
    const orgs = extractOrganizationsFromToken(token);
    expect(orgs).toEqual([]);
  });

  it('returns empty array for null token', () => {
    expect(extractOrganizationsFromToken(null)).toEqual([]);
  });

  it('returns empty array for undefined token', () => {
    expect(extractOrganizationsFromToken(undefined)).toEqual([]);
  });

  it('returns empty array for empty string token', () => {
    expect(extractOrganizationsFromToken('')).toEqual([]);
  });

  it('returns empty array for malformed token', () => {
    expect(extractOrganizationsFromToken('not-a-jwt')).toEqual([]);
  });

  it('uses first title when multiple titles exist', () => {
    const token = createToken({
      organization: {
        'multi-title': { organization_title: ['First', 'Second'] },
      },
    });
    const orgs = extractOrganizationsFromToken(token);
    expect(orgs).toEqual([{ id: 'multi-title', title: 'First' }]);
  });
});
