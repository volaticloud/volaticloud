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
  groups?: string[];
  organization_titles?: Record<string, string>;
  /** Keycloak native organizations claim (Keycloak 26+) */
  organizations?: Record<string, OrganizationClaim>;
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
 * Extracts organizations from Keycloak native organizations claim (Keycloak 26+).
 * The claim format is:
 * {
 *   "alias": { "id": "uuid", "organization_title": ["Title"] },
 *   ...
 * }
 */
function extractOrganizationsFromToken(token: string | null | undefined): Organization[] {
  if (!token) {
    return [];
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const organizationsClaim = decoded.organizations;

    if (organizationsClaim && Object.keys(organizationsClaim).length > 0) {
      // Use new Keycloak native organizations claim
      // Key can be alias or ID, inner object may have 'id' field
      return Object.entries(organizationsClaim).map(([key, orgData]) => ({
        // Use nested id if available, otherwise use the key (which is alias or id)
        id: orgData.id || key,
        alias: key,
        // Use first title from array, fallback to key if no title
        title: orgData.organization_title?.[0] || key,
      }));
    }

    // Fallback to legacy groups-based extraction for backwards compatibility
    return extractOrganizationsFromLegacyGroups(decoded);
  } catch (error) {
    console.error('Failed to extract organizations from token:', error);
    return [];
  }
}

/**
 * Legacy extraction from groups claim for backwards compatibility.
 * Groups format: "/uuid/resource/role:admin" or "/uuid/role:admin"
 */
function extractOrganizationsFromLegacyGroups(decoded: JwtPayload): Organization[] {
  const groups = decoded.groups || [];
  const organizationTitles = decoded.organization_titles || {};

  // Extract unique UUIDs from group paths
  const uuids = groups
    .map((groupPath) => {
      const segments = groupPath.split('/').filter(Boolean);
      return segments.length > 0 ? segments[0] : null;
    })
    .filter((uuid): uuid is string => uuid !== null);

  const uniqueIds = Array.from(new Set(uuids));

  return uniqueIds.map((id) => ({
    id,
    alias: id, // Legacy format doesn't have alias, use id
    title: organizationTitles[id] || id,
  }));
}

interface GroupProviderProps {
  children: React.ReactNode;
}

export function GroupProvider({ children }: GroupProviderProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  // Extract organizations from token (supports both new and legacy formats)
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
