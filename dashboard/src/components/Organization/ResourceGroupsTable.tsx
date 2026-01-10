import { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Group as GroupIcon,
  ArrowUpward,
  ArrowDownward,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { ResourceGroupsDocument } from './organization.generated';
import { ResourceGroupOrderField, OrderDirection } from '../../generated/types';

interface ResourceGroupsTableProps {
  organizationId: string;
  onGroupSelect: (groupId: string, groupName: string) => void;
  selectedGroupId: string | null;
  initialGroupId?: string;
}

export const ResourceGroupsTable = ({
  organizationId,
  onGroupSelect,
  selectedGroupId,
  initialGroupId,
}: ResourceGroupsTableProps) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderBy, setOrderBy] = useState<ResourceGroupOrderField>(ResourceGroupOrderField.Title);
  const [orderDirection, setOrderDirection] = useState<OrderDirection>(OrderDirection.Asc);

  // Hierarchical navigation state
  const [currentParentId, setCurrentParentId] = useState<string>(initialGroupId || organizationId);

  // Initialize from URL groupId
  useEffect(() => {
    if (initialGroupId && initialGroupId !== organizationId) {
      setCurrentParentId(initialGroupId);
      // Select it so members load
      onGroupSelect(initialGroupId, 'Resource Group');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset navigation state when organizationId prop changes (e.g., URL change)
  useEffect(() => {
    if (!initialGroupId || initialGroupId === organizationId) {
      setCurrentParentId(organizationId);
      setPage(0);
      setSearchTerm('');
    }
  }, [organizationId, initialGroupId]);

  // Query with pagination and search
  const { data, loading, error } = useQuery(ResourceGroupsDocument, {
    variables: {
      organizationId: currentParentId,
      where: searchTerm ? { titleContainsFold: searchTerm } : undefined,
      orderBy: {
        field: orderBy,
        direction: orderDirection,
      },
      first: rowsPerPage,
      offset: page * rowsPerPage,
    },
    skip: !organizationId,
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

  const handleGroupClick = (group: any) => {
    // Navigate into the group and select it to show members
    // Use group.name (resource UUID) instead of group.id (Keycloak internal ID)
    setCurrentParentId(group.name);
    setPage(0);
    setSearchTerm('');
    onGroupSelect(group.name, group.title);
  };

  const groups = data?.resourceGroups?.edges || [];
  const totalCount = data?.resourceGroups?.totalCount || 0;

  if (error) {
    return <Alert severity="error">Failed to load resource groups: {error.message}</Alert>;
  }

  return (
    <Paper>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Resource Groups
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            placeholder="Search by title..."
            value={searchTerm}
            onChange={handleSearchChange}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as ResourceGroupOrderField)}
              label="Sort by"
            >
              <MenuItem value={ResourceGroupOrderField.Title}>Title</MenuItem>
              <MenuItem value={ResourceGroupOrderField.TotalMembers}>Total Members</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title={`Sort ${orderDirection === OrderDirection.Asc ? 'descending' : 'ascending'}`}>
            <IconButton onClick={toggleSortDirection} size="small">
              {orderDirection === OrderDirection.Asc ? <ArrowUpward /> : <ArrowDownward />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="40px"></TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell align="right">Total Members</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Box sx={{ py: 4 }}>
                    <CircularProgress size={40} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    {searchTerm ? 'No resource groups match your search' : 'No resource groups found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              groups.map((edge) => {
                const group = edge.node;
                // Use group.name (resource UUID) for selection comparison
                const isSelected = selectedGroupId === group.name;

                return (
                  <TableRow
                    key={group.name}
                    hover
                    selected={isSelected}
                    onClick={() => handleGroupClick(group)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      {group.hasChildren ? (
                        <FolderIcon fontSize="small" color="action" />
                      ) : (
                        <GroupIcon fontSize="small" color={isSelected ? 'primary' : 'action'} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                          {group.title}
                        </Typography>
                        {group.hasChildren && (
                          <Chip label="Folder" size="small" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {group.roles.map((role) => (
                          <Chip
                            key={role.name}
                            label={`${role.name} (${role.memberCount})`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={group.totalMembers} size="small" color="primary" />
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
        rowsPerPageOptions={[10, 20, 50, 100]}
      />
    </Paper>
  );
};