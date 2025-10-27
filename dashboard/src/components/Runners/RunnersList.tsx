import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetRunnersQuery } from '../../generated/graphql';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';
import { CreateRunnerDialog } from './CreateRunnerDialog';
import { EditRunnerDialog } from './EditRunnerDialog';
import { DeleteRunnerDialog } from './DeleteRunnerDialog';

export const RunnersList = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRunner, setSelectedRunner] = useState<{
    id: string;
    name: string;
    type: 'docker' | 'kubernetes' | 'local';
  } | null>(null);

  const { data, loading, error, refetch } = useGetRunnersQuery({
    variables: { first: 50 }
  });

  if (loading) return <LoadingSpinner message="Loading runners..." />;
  if (error) return <ErrorAlert error={error} />;

  const runners = (data?.botRunners?.edges
    ?.map(edge => edge?.node)
    .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined) || []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            Runners
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data?.botRunners?.totalCount || 0} total runners
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Runner
        </Button>
      </Box>

      {runners.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No runners yet. Create your first runner to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Bots</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runners.map((runner) => (
                <TableRow key={runner.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {runner.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={runner.type}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{runner.bots?.totalCount || 0}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(runner.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit Runner">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedRunner(runner);
                          setEditDialogOpen(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Runner">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedRunner(runner);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateRunnerDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      {selectedRunner && (
        <>
          <EditRunnerDialog
            open={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedRunner(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedRunner(null);
            }}
            runner={selectedRunner}
          />

          <DeleteRunnerDialog
            open={deleteDialogOpen}
            onClose={() => {
              setDeleteDialogOpen(false);
              setSelectedRunner(null);
            }}
            onSuccess={() => {
              refetch();
              setSelectedRunner(null);
            }}
            runner={selectedRunner}
          />
        </>
      )}
    </Box>
  );
};