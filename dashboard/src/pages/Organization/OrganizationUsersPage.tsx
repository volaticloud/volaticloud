import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Alert, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon, Folder as FolderIcon, FolderOpen as FolderOpenIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { useActiveOrganization, useGroupNavigate } from '../../contexts/OrganizationContext';
import { CollapsibleSidebar } from '../../components/Layout/CollapsibleSidebar';
import { ResourceGroupsTable } from '../../components/Organization/ResourceGroupsTable';
import { ResourceGroupMembersTable } from '../../components/Organization/ResourceGroupMembersTable';

interface BreadcrumbItem {
  id: string;
  title: string;
}

export const OrganizationUsersPage = () => {
  const { activeOrganizationId } = useActiveOrganization();
  const { resourceGroupId } = useParams<{ resourceGroupId?: string }>();
  const navigate = useGroupNavigate();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: activeOrganizationId || '', title: 'Organization' },
  ]);

  // Update breadcrumbs when resourceGroupId or selectedGroupName changes
  useEffect(() => {
    if (resourceGroupId && selectedGroupName) {
      setBreadcrumbs([
        { id: activeOrganizationId || '', title: 'Organization' },
        { id: resourceGroupId, title: selectedGroupName },
      ]);
    } else {
      setBreadcrumbs([{ id: activeOrganizationId || '', title: 'Organization' }]);
    }
  }, [resourceGroupId, selectedGroupName, activeOrganizationId]);

  // Read resourceGroupId from URL params on mount and when it changes
  useEffect(() => {
    if (resourceGroupId) {
      setSelectedGroupId(resourceGroupId);
      // Name will be set by ResourceGroupsTable when it loads
    } else {
      setSelectedGroupId(null);
      setSelectedGroupName(null);
    }
  }, [resourceGroupId]);

  const handleGroupSelect = (groupId: string, groupName: string) => {
    setSelectedGroupId(groupId);
    setSelectedGroupName(groupName);

    // Navigate to the resource group path (preserves organization groupId query param)
    navigate(`/organization/users/${groupId}`);
  };

  const handleBreadcrumbClick = () => {
    // Navigate back to organization level
    navigate('/organization/users');
    setSelectedGroupId(null);
    setSelectedGroupName(null);
  };

  if (!activeOrganizationId) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Users & Access
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          Please select an organization from the header to view users.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Users & Access
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Manage access to resources (bots, strategies, etc.) within your organization
      </Typography>

      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        separator={<ChevronRightIcon fontSize="small" />}
        sx={{ mt: 2, mb: 2 }}
        maxItems={4}
      >
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const isFirst = index === 0;

          if (isLast) {
            return (
              <Typography key={crumb.id} color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isFirst ? <HomeIcon fontSize="small" /> : <FolderOpenIcon fontSize="small" />}
                {crumb.title}
              </Typography>
            );
          }

          return (
            <Link
              key={crumb.id}
              component="button"
              variant="body2"
              onClick={handleBreadcrumbClick}
              underline="hover"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
            >
              {isFirst ? <HomeIcon fontSize="small" /> : <FolderIcon fontSize="small" />}
              {crumb.title}
            </Link>
          );
        })}
      </Breadcrumbs>

      {/* Main content - Members Table */}
      <Box sx={{ mt: 1 }}>
        <ResourceGroupMembersTable
          organizationId={activeOrganizationId}
          resourceGroupId={selectedGroupId || activeOrganizationId}
          resourceGroupName={selectedGroupName || 'Organization'}
        />
      </Box>

      {/* Right Sidebar - Resource Groups Navigation */}
      <CollapsibleSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        width={500}
        side="right"
        toggleButtonLabel="Browse resource groups"
      >
        <ResourceGroupsTable
          organizationId={activeOrganizationId}
          onGroupSelect={handleGroupSelect}
          selectedGroupId={selectedGroupId}
          initialGroupId={resourceGroupId}
        />
      </CollapsibleSidebar>
    </Box>
  );
};