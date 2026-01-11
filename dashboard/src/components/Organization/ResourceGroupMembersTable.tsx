import { useState } from 'react';
import { useQuery } from '@apollo/client';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  VerifiedUser as VerifiedIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { ResourceGroupMembersDocument } from './organization.generated';
import { ResourceGroupMemberOrderField, OrderDirection } from '../../generated/types';

interface ResourceGroupMembersTableProps {
  organizationId: string;
  resourceGroupId: string;
  resourceGroupName: string;
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

  // Extract available roles from the first page (for filter options)
  const availableRoles = Array.from(
    new Set(members.flatMap((edge) => edge.node.roles))
  ).sort();

  if (error) {
    return <Alert severity="error">Failed to load members: {error.message}</Alert>;
  }

  return (
    <Paper>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Members of {resourceGroupName}
        </Typography>

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
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ py: 4 }}>
                    <CircularProgress size={40} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
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
    </Paper>
  );
};