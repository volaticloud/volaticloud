import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from './AuthContext';
import { ORG_ID_PARAM } from '../constants/url';
import { NoOrganizationView } from '../components/Organization/NoOrganizationView';

interface JwtPayload {
  groups?: string[];
  organization_titles?: Record<string, string>;
  [key: string]: unknown;
}

interface Organization {
  id: string;
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
 * Extracts organization UUIDs from group paths in JWT token.
 * Groups format: "/uuid/resource/role:admin" or "/uuid/role:admin"
 * We extract only the first UUID (organization/tenant level)
 */
function extractGroupsFromToken(token: string | null | undefined): string[] {
  if (!token) {
    return [];
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const groups = decoded.groups || [];

    // Extract UUIDs from group paths
    const uuids = groups
      .map((groupPath) => {
        // Split by "/" and get the first non-empty segment (the UUID)
        const segments = groupPath.split('/').filter(Boolean);
        return segments.length > 0 ? segments[0] : null;
      })
      .filter((uuid): uuid is string => uuid !== null);

    // Return unique UUIDs (organization-level groups)
    return Array.from(new Set(uuids));
  } catch (error) {
    console.error('Failed to decode token:', error);
    return [];
  }
}

/**
 * Extracts organizations with their titles from JWT token.
 * Uses organization_titles claim for human-readable names.
 */
function extractOrganizationsFromToken(
  token: string | null | undefined,
  groupIds: string[]
): Organization[] {
  if (!token || groupIds.length === 0) {
    return [];
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const organizationTitles = decoded.organization_titles || {};

    return groupIds.map((id) => ({
      id,
      title: organizationTitles[id] || id, // Fallback to UUID if no title
    }));
  } catch (error) {
    console.error('Failed to extract organization titles:', error);
    return groupIds.map((id) => ({ id, title: id }));
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

  // Extract available groups from token (reactive to token changes)
  const availableGroups = useMemo(
    () => extractGroupsFromToken(auth.user?.access_token),
    [auth.user?.access_token]
  );

  // Extract organizations with titles from token
  const organizations = useMemo(
    () => extractOrganizationsFromToken(auth.user?.access_token, availableGroups),
    [auth.user?.access_token, availableGroups]
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
