import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Box, Container, Paper, Typography, Alert } from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import { useAuth } from './AuthContext';

interface JwtPayload {
  groups?: string[];
  [key: string]: any;
}

interface GroupContextValue {
  activeGroupId: string | null;
  availableGroups: string[];
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

  // Get groupId from URL parameter
  const groupIdFromUrl = searchParams.get('groupId');

  // Determine active group
  const activeGroupId = useMemo(() => {
    // If groupId is in URL and valid, use it
    if (groupIdFromUrl && availableGroups.includes(groupIdFromUrl)) {
      return groupIdFromUrl;
    }

    // Otherwise, use the first available group as default
    return availableGroups.length > 0 ? availableGroups[0] : null;
  }, [groupIdFromUrl, availableGroups]);

  // Sync URL with active group
  useEffect(() => {
    if (!activeGroupId) {
      // No groups available - user might not be authenticated
      return;
    }

    // If URL doesn't have groupId or has invalid groupId, update it
    if (!groupIdFromUrl || !availableGroups.includes(groupIdFromUrl)) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('groupId', activeGroupId);

      // Replace history to avoid creating extra navigation entries
      navigate(
        {
          pathname: location.pathname,
          search: newSearchParams.toString(),
        },
        { replace: true }
      );
    }
  }, [activeGroupId, groupIdFromUrl, availableGroups, searchParams, navigate, location.pathname]);

  // Function to change active group
  const setActiveGroup = (groupId: string) => {
    if (!availableGroups.includes(groupId)) {
      console.warn(`Group ${groupId} is not available for this user`);
      return;
    }

    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('groupId', groupId);
    setSearchParams(newSearchParams);
  };

  const value: GroupContextValue = {
    activeGroupId,
    availableGroups,
    setActiveGroup,
  };

  // Show blocking message if no groups available
  if (availableGroups.length === 0) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={3}
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 2,
            }}
          >
            <BusinessIcon
              sx={{
                fontSize: 64,
                color: 'text.secondary',
                mb: 2,
              }}
            />
            <Typography variant="h5" gutterBottom fontWeight="bold">
              No Organization Access
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your account is not assigned to any organization. Please contact your administrator
              to get access to an organization.
            </Typography>
            <Alert severity="warning" sx={{ mt: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                <strong>Why am I seeing this?</strong>
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                This application requires you to be a member of at least one organization. The
                system administrator needs to assign you to an organization before you can access
                the application.
              </Typography>
            </Alert>
          </Paper>
        </Container>
      </Box>
    );
  }

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

/**
 * Hook to access the active group context
 */
export function useActiveGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useActiveGroup must be used within a GroupProvider');
  }
  return context;
}