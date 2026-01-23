import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from 'react-oidc-context';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Snackbar,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Search as SearchIcon,
  VerifiedUser as VerifiedIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ArrowUpward,
  ArrowDownward,
  PersonAdd as PersonAddIcon,
  MoreVert as MoreVertIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import { ResourceGroupMembersDocument, ChangeOrganizationUserRoleDocument } from './organization.generated';
import { ResourceGroupMemberOrderField, OrderDirection } from '../../generated/types';
import { InviteUserDrawer } from './InviteUserDrawer';
import { ChangeRoleDrawer } from './ChangeRoleDrawer';
import { useCanPerform } from '../../hooks/useCanPerform';

interface ResourceGroupMembersTableProps {
  organizationId: string;
  resourceGroupId: string;
  resourceGroupName: string;
}

interface SelectedUser {
  id: string;
  username: string;
  primaryRole: string;
}

export const ResourceGroupMembersTable = ({
  organizationId,
  resourceGroupId,
  resourceGroupName,
}: ResourceGroupMembersTableProps) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [enabledFilter, setEnabledFilter] = useState<boolean | undefined>(undefined);
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState<boolean | undefined>(undefined);
  const [orderBy, setOrderBy] = useState<ResourceGroupMemberOrderField>(
    ResourceGroupMemberOrderField.Username
  );
  const [orderDirection, setOrderDirection] = useState<OrderDirection>(OrderDirection.Asc);
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  // Change role dialog state
  const [changeRoleDrawerOpen, setChangeRoleDrawerOpen] = useState(false);

  // Get current user ID from auth context
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.profile?.sub;

  // Check if user can change roles
  const { can: canChangeRolesResult, loading: permissionLoadingResult } = useCanPerform({
    resourceId: organizationId,
    scope: 'change-user-roles',
  });

  // Treat as loading if organizationId is not yet available
  const canChangeRoles = organizationId ? canChangeRolesResult : false;
  const permissionLoading = organizationId ? permissionLoadingResult : true;

  // Show invite button and actions column only at organization level
  const isOrganizationLevel = organizationId === resourceGroupId;

  // Always show actions column at organization level - button will be disabled if no permission
  const showActionsColumn = isOrganizationLevel;

  // Query with pagination, search, and filters
  const { data, loading, error } = useQuery(ResourceGroupMembersDocument, {
    variables: {
      organizationId,
      resourceGroupId,
      where: {
        ...(searchTerm && { searchContainsFold: searchTerm }),
        ...(selectedRoles.length > 0 && { roleIn: selectedRoles }),
        ...(enabledFilter !== undefined && { enabled: enabledFilter }),
        ...(emailVerifiedFilter !== undefined && { emailVerified: emailVerifiedFilter }),
      },
      orderBy: {
        field: orderBy,
        direction: orderDirection,
      },
      first: rowsPerPage,
      offset: page * rowsPerPage,
    },
    skip: !organizationId || !resourceGroupId,
  });

  // Mutation for changing user roles
  const [changeUserRole, { loading: changingRole }] = useMutation(ChangeOrganizationUserRoleDocument, {
    refetchQueries: [ResourceGroupMembersDocument],
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: SelectedUser) => {
    setMenuAnchor(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleChangeRoleClick = () => {
    handleMenuClose();
    if (availableRoles.length === 0) {
      setSnackbar({
        open: true,
        message: 'No roles available for this organization',
        severity: 'error',
      });
      return;
    }
    setChangeRoleDrawerOpen(true);
  };

  const handleRoleChange = async (newRole: string) => {
    if (!selectedUser) return;

    await changeUserRole({
      variables: {
        organizationId,
        userId: selectedUser.id,
        newRole,
      },
    });

    setSnackbar({
      open: true,
      message: `Successfully changed ${selectedUser.username}'s role to ${newRole}`,
      severity: 'success',
    });
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const toggleSortDirection = () => {
    setOrderDirection((prev) =>
      prev === OrderDirection.Asc ? OrderDirection.Desc : OrderDirection.Asc
    );
  };

  const members = data?.resourceGroupMembers?.edges || [];
  const totalCount = data?.resourceGroupMembers?.totalCount || 0;

  // Available roles from API (strict - no fallback)
  const availableRoles = data?.resourceGroupMembers?.availableRoles || [];

  if (error) {
    return <Alert severity="error">Failed to load members: {error.message}</Alert>;
  }

  return (
    <Paper>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Members of {resourceGroupName}</Typography>
          {isOrganizationLevel && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setInviteDrawerOpen(true)}
            >
              Invite User
            </Button>
          )}
        </Box>

        {/* Search and Filters */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search username, email, name..."
            value={searchTerm}
            onChange={handleSearchChange}
            size="small"
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Roles</InputLabel>
            <Select
              multiple
              value={selectedRoles}
              onChange={(e) => {
                setSelectedRoles(
                  typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                );
                setPage(0);
              }}
              label="Roles"
              renderValue={(selected) => selected.join(', ')}
            >
              {availableRoles.map((role: string) => (
                <MenuItem key={role} value={role}>
                  <Checkbox checked={selectedRoles.indexOf(role) > -1} />
                  {role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as ResourceGroupMemberOrderField)}
              label="Sort by"
            >
              <MenuItem value={ResourceGroupMemberOrderField.Username}>Username</MenuItem>
              <MenuItem value={ResourceGroupMemberOrderField.Email}>Email</MenuItem>
              <MenuItem value={ResourceGroupMemberOrderField.FirstName}>First Name</MenuItem>
              <MenuItem value={ResourceGroupMemberOrderField.LastName}>Last Name</MenuItem>
              <MenuItem value={ResourceGroupMemberOrderField.CreatedAt}>Created Date</MenuItem>
              <MenuItem value={ResourceGroupMemberOrderField.PrimaryRole}>Primary Role</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title={`Sort ${orderDirection === OrderDirection.Asc ? 'descending' : 'ascending'}`}>
            <IconButton onClick={toggleSortDirection} size="small">
              {orderDirection === OrderDirection.Asc ? <ArrowUpward /> : <ArrowDownward />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Additional Filters */}
        <FormGroup row sx={{ mt: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={enabledFilter === true}
                indeterminate={enabledFilter === undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    setEnabledFilter(true);
                  } else if (enabledFilter === true) {
                    setEnabledFilter(false);
                  } else {
                    setEnabledFilter(undefined);
                  }
                  setPage(0);
                }}
              />
            }
            label="Active users only"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={emailVerifiedFilter === true}
                indeterminate={emailVerifiedFilter === undefined}
                onChange={(e) => {
                  if (e.target.checked) {
                    setEmailVerifiedFilter(true);
                  } else if (emailVerifiedFilter === true) {
                    setEmailVerifiedFilter(false);
                  } else {
                    setEmailVerifiedFilter(undefined);
                  }
                  setPage(0);
                }}
              />
            }
            label="Verified emails only"
          />
        </FormGroup>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Primary Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              {showActionsColumn && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showActionsColumn ? 8 : 7} align="center">
                  <Box sx={{ py: 4 }}>
                    <CircularProgress size={40} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showActionsColumn ? 8 : 7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    {searchTerm || selectedRoles.length > 0
                      ? 'No members match your filters'
                      : 'No members found in this resource group'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              members.map((edge) => {
                const member = edge.node;
                const user = member.user;
                const isCurrentUser = user.id === currentUserId;

                return (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {user.username}
                        {user.emailVerified && (
                          <VerifiedIcon
                            sx={{ fontSize: 16, color: 'primary.main' }}
                            titleAccess="Email verified"
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : '-'}
                    </TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {member.roles.map((role) => (
                          <Chip
                            key={role}
                            label={role}
                            size="small"
                            variant="outlined"
                            color={role === member.primaryRole ? 'primary' : 'default'}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={member.primaryRole} size="small" color="primary" />
                    </TableCell>
                    <TableCell>
                      {user.enabled ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Active"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip icon={<CancelIcon />} label="Disabled" color="error" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    {showActionsColumn && (
                      <TableCell align="right">
                        <Tooltip
                          title={
                            permissionLoading
                              ? 'Loading...'
                              : !canChangeRoles
                                ? 'No permission'
                                : isCurrentUser
                                  ? 'You cannot change your own role'
                                  : 'Actions'
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) =>
                                handleMenuOpen(e, {
                                  id: user.id,
                                  username: user.username,
                                  primaryRole: member.primaryRole,
                                })
                              }
                              disabled={isCurrentUser || permissionLoading || !canChangeRoles}
                            >
                              <MoreVertIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[25, 50, 100]}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleChangeRoleClick}>
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Change Role</ListItemText>
        </MenuItem>
      </Menu>

      {/* Invite User Drawer */}
      <InviteUserDrawer
        open={inviteDrawerOpen}
        onClose={() => setInviteDrawerOpen(false)}
        organizationId={organizationId}
        organizationName={resourceGroupName}
      />

      {/* Change Role Drawer */}
      {selectedUser && (
        <ChangeRoleDrawer
          open={changeRoleDrawerOpen}
          onClose={() => {
            setChangeRoleDrawerOpen(false);
            setSelectedUser(null);
          }}
          onConfirm={handleRoleChange}
          username={selectedUser.username}
          currentRole={selectedUser.primaryRole}
          availableRoles={availableRoles}
          loading={changingRole}
        />
      )}

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};
