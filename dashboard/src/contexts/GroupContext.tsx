import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from './AuthContext';
import { ORG_ID_PARAM } from '../constants/url';
import { NoOrganizationView } from '../components/Organization/NoOrganizationView';

/**
 * Organization data from Keycloak native organizations claim.
 * Key is the organization alias, value contains id and optional title.
 */
interface OrganizationClaim {
  id: string;
  organization_title?: string[];
}

interface JwtPayload {
  /** Keycloak native organization claim (Keycloak 26+) */
  organization?: Record<string, OrganizationClaim>;
  [key: string]: unknown;
}

interface Organization {
  id: string;
  alias: string;
  title: string;
}

interface GroupContextValue {
  activeGroupId: string | null;
  activeOrganization: Organization | null;
  availableGroups: string[];
  organizations: Organization[];
  setActiveGroup: (groupId: string) => void;
}

const GroupContext = createContext<GroupContextValue | undefined>(undefined);

/**
 * Extracts organizations from Keycloak native organization claim (Keycloak 26+).
 * The claim format is:
 * {
 *   "organization": {
 *     "alias": { "id": "uuid", "organization_title": ["Title"] },
 *     ...
 *   }
 * }
 *
 * SECURITY NOTE: These organizations are extracted for UI display only.
 * All backend operations verify permissions via Keycloak UMA (ADR-0008).
 * Never trust client-side claims for authorization decisions.
 */
function extractOrganizationsFromToken(token: string | null | undefined): Organization[] {
  if (!token) {
    return [];
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const organizationClaim = decoded.organization;

    if (!organizationClaim || Object.keys(organizationClaim).length === 0) {
      return [];
    }

    // Key is the organization alias, inner object contains id and optional title
    return Object.entries(organizationClaim).map(([alias, orgData]) => ({
      // Use nested id if available, otherwise use the alias
      id: orgData.id || alias,
      alias,
      // Use first title from array, fallback to alias if no title
      title: orgData.organization_title?.[0] || alias,
    }));
  } catch (error) {
    console.error('Failed to extract organizations from token:', error);
    return [];
  }
}

interface GroupProviderProps {
  children: React.ReactNode;
}

export function GroupProvider({ children }: GroupProviderProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  // Extract organizations from token
  // Re-extracts automatically when token refreshes via useMemo dependency on access_token
  const organizations = useMemo(
    () => extractOrganizationsFromToken(auth.user?.access_token),
    [auth.user?.access_token]
  );

  // Derive available group IDs from organizations
  const availableGroups = useMemo(
    () => organizations.map((org) => org.id),
    [organizations]
  );

  // Get orgId from URL parameter
  const orgIdFromUrl = searchParams.get(ORG_ID_PARAM);

  // Determine active group
  const activeGroupId = useMemo(() => {
    // If orgId is in URL and valid, use it
    if (orgIdFromUrl && availableGroups.includes(orgIdFromUrl)) {
      return orgIdFromUrl;
    }

    // Otherwise, use the first available group as default
    return availableGroups.length > 0 ? availableGroups[0] : null;
  }, [orgIdFromUrl, availableGroups]);

  // Get active organization with title
  const activeOrganization = useMemo(() => {
    if (!activeGroupId) return null;
    return organizations.find((org) => org.id === activeGroupId) || null;
  }, [activeGroupId, organizations]);

  // Sync URL with active group
  useEffect(() => {
    if (!activeGroupId) {
      // No groups available - user might not be authenticated
      return;
    }

    // If URL doesn't have orgId or has invalid orgId, update it
    if (!orgIdFromUrl || !availableGroups.includes(orgIdFromUrl)) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set(ORG_ID_PARAM, activeGroupId);

      // Replace history to avoid creating extra navigation entries
      navigate(
        {
          pathname: location.pathname,
          search: newSearchParams.toString(),
        },
        { replace: true }
      );
    }
  }, [activeGroupId, orgIdFromUrl, availableGroups, searchParams, navigate, location.pathname]);

  // Function to change active group
  const setActiveGroup = (groupId: string) => {
    if (!availableGroups.includes(groupId)) {
      console.warn(`Group ${groupId} is not available for this user`);
      return;
    }

    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set(ORG_ID_PARAM, groupId);
    setSearchParams(newSearchParams);
  };

  const value: GroupContextValue = {
    activeGroupId,
    activeOrganization,
    availableGroups,
    organizations,
    setActiveGroup,
  };

  // Show create organization view if no groups available
  if (availableGroups.length === 0) {
    return <NoOrganizationView />;
  }

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

/**
 * Hook to access the active group context
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useActiveGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useActiveGroup must be used within a GroupProvider');
  }
  return context;
}

/**
 * Hook to navigate while preserving the orgId query parameter.
 * Use this instead of useNavigate() to ensure orgId is always in the URL.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useGroupNavigate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return useCallback(
    (to: string, options?: { replace?: boolean; state?: unknown }) => {
      const orgId = searchParams.get(ORG_ID_PARAM);

      // Parse the target path to handle paths that might already have query params
      const [pathname, existingSearch] = to.split('?');
      const newParams = new URLSearchParams(existingSearch || '');

      // Preserve orgId if it exists and isn't already in the target URL
      if (orgId && !newParams.has(ORG_ID_PARAM)) {
        newParams.set(ORG_ID_PARAM, orgId);
      }

      const search = newParams.toString();
      navigate(
        {
          pathname,
          search: search ? `?${search}` : '',
        },
        options
      );
    },
    [navigate, searchParams]
  );
}
