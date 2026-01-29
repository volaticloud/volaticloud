import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ORG_ID_PARAM } from '../constants/url';
import { NoOrganizationView } from '../components/Organization/NoOrganizationView';
import { extractOrganizationsFromToken } from './organizationUtils';
import type { Organization } from './organizationUtils';

export type { Organization };

interface OrganizationContextValue {
  activeOrganizationId: string | null;
  activeOrganization: Organization | null;
  availableOrganizationIds: string[];
  organizations: Organization[];
  setActiveOrganization: (organizationId: string) => void;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

interface OrganizationProviderProps {
  children: React.ReactNode;
}

export function OrganizationProvider({ children }: OrganizationProviderProps) {
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

  // Derive available organization IDs from organizations
  const availableOrganizationIds = useMemo(
    () => organizations.map((org) => org.id),
    [organizations]
  );

  // Get orgId from URL parameter
  const orgIdFromUrl = searchParams.get(ORG_ID_PARAM);

  // Determine active organization
  const activeOrganizationId = useMemo(() => {
    // If orgId is in URL and valid, use it
    if (orgIdFromUrl && availableOrganizationIds.includes(orgIdFromUrl)) {
      return orgIdFromUrl;
    }

    // Otherwise, use the first available organization as default
    return availableOrganizationIds.length > 0 ? availableOrganizationIds[0] : null;
  }, [orgIdFromUrl, availableOrganizationIds]);

  // Get active organization with title
  const activeOrganization = useMemo(() => {
    if (!activeOrganizationId) return null;
    return organizations.find((org) => org.id === activeOrganizationId) || null;
  }, [activeOrganizationId, organizations]);

  // Sync URL with active organization
  useEffect(() => {
    if (!activeOrganizationId) {
      // No organizations available - user might not be authenticated
      return;
    }

    // If URL doesn't have orgId or has invalid orgId, update it
    if (!orgIdFromUrl || !availableOrganizationIds.includes(orgIdFromUrl)) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set(ORG_ID_PARAM, activeOrganizationId);

      // Replace history to avoid creating extra navigation entries
      navigate(
        {
          pathname: location.pathname,
          search: newSearchParams.toString(),
        },
        { replace: true }
      );
    }
  }, [activeOrganizationId, orgIdFromUrl, availableOrganizationIds, searchParams, navigate, location.pathname]);

  // Function to change active organization
  const setActiveOrganization = (organizationId: string) => {
    if (!availableOrganizationIds.includes(organizationId)) {
      console.warn(`Organization ${organizationId} is not available for this user`);
      return;
    }

    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set(ORG_ID_PARAM, organizationId);
    setSearchParams(newSearchParams);
  };

  const value: OrganizationContextValue = {
    activeOrganizationId,
    activeOrganization,
    availableOrganizationIds,
    organizations,
    setActiveOrganization,
  };

  // Show create organization view if no organizations available
  if (availableOrganizationIds.length === 0) {
    return <NoOrganizationView />;
  }

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

/**
 * Hook to access the active organization context
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useActiveOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useActiveOrganization must be used within an OrganizationProvider');
  }
  return context;
}

/**
 * Hook to navigate while preserving the orgId query parameter.
 * Use this instead of useNavigate() to ensure orgId is always in the URL.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOrganizationNavigate() {
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