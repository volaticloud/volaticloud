import { jwtDecode } from 'jwt-decode';

/**
 * Organization data from Keycloak native organizations claim.
 * The claim key is the organization ID (human-readable string).
 */
interface OrganizationClaim {
  organization_title?: string[];
}

interface JwtPayload {
  /** Keycloak native organization claim (Keycloak 26+) */
  organization?: Record<string, OrganizationClaim>;
  [key: string]: unknown;
}

/**
 * Organization representation in the dashboard.
 * The ID is a human-readable string (e.g., "acme-corp", "my-team").
 */
export interface Organization {
  id: string;
  title: string;
}

/**
 * Extracts organizations from Keycloak native organization claim (Keycloak 26+).
 * The claim format is:
 * {
 *   "organization": {
 *     "org-id": { "organization_title": ["Title"] },
 *     ...
 *   }
 * }
 *
 * The claim key is the organization ID (human-readable string like "acme-corp").
 *
 * SECURITY NOTE: These organizations are extracted for UI display only.
 * All backend operations verify permissions via Keycloak UMA (ADR-0008).
 * Never trust client-side claims for authorization decisions.
 */
export function extractOrganizationsFromToken(token: string | null | undefined): Organization[] {
  if (!token) {
    return [];
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const organizationClaim = decoded.organization;

    if (!organizationClaim || Object.keys(organizationClaim).length === 0) {
      return [];
    }

    // Key is the organization ID, inner object contains optional title
    return Object.entries(organizationClaim).map(([id, orgData]) => ({
      id,
      title: orgData.organization_title?.[0] || id,
    }));
  } catch (error) {
    console.error('Failed to extract organizations from token:', error);
    return [];
  }
}
