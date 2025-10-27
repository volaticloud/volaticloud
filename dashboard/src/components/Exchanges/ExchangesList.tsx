import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useGetExchangesQuery } from '../../generated/graphql';
import { CreateExchangeDialog } from './CreateExchangeDialog';
import { EditExchangeDialog } from './EditExchangeDialog';
import { DeleteExchangeDialog } from './DeleteExchangeDialog';

export const ExchangesList = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<{
    id: string;
    name: string;
    config?: any;
  } | null>(null);

  const { data, loading, error, refetch } = useGetExchangesQuery();

  const handleEdit = (exchange: { id: string; name: string; config?: any }) => {
    setSelectedExchange(exchange);
    setEditDialogOpen(true);
  };

  const handleDelete = (exchange: { id: string; name: string }) => {
    setSelectedExchange(exchange);
    setDeleteDialogOpen(true);
  };

  const handleSuccess = () => {
    refetch();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error">
          Error loading exchanges: {error.message}
        </Alert>
      </Box>
    );
  }

  const exchanges = data?.exchanges || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom fontWeight={600}>
            Exchanges
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your exchange connections and API credentials
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Add Exchange
        </Button>
      </Box>

      {exchanges.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              No exchanges configured. Add an exchange to connect to trading platforms.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {exchanges.map((exchange) => (
            <Card key={exchange.id}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6" fontWeight={600}>
                        {exchange.name}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Bots: {exchange.bots.totalCount}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Created: {new Date(exchange.createdAt).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Updated: {new Date(exchange.updatedAt).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(exchange)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(exchange)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <CreateExchangeDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleSuccess}
      />

      <EditExchangeDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedExchange(null);
        }}
        onSuccess={handleSuccess}
        exchange={selectedExchange}
      />

      <DeleteExchangeDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedExchange(null);
        }}
        onSuccess={handleSuccess}
        exchange={selectedExchange}
      />
    </Box>
  );
};