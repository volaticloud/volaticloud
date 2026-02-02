import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  FormHelperText,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useState, useEffect, useMemo } from 'react';
import { useUpdateExchangeMutation } from './exchanges.generated';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDrawer } from '../shared';
import { FreqtradeConfigForm } from '../Freqtrade/FreqtradeConfigForm';
import { EXCHANGE_SECTIONS } from '../Freqtrade/defaultConfig';

interface EditExchangeDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  exchange: {
    id: string;
    name: string;
    config?: any;
  } | null;
}

export const EditExchangeDrawer = ({ open, onClose, onSuccess, exchange }: EditExchangeDrawerProps) => {
  const [name, setName] = useState('');
  const [config, setConfig] = useState<object | null>(null);

  const [updateExchange, { loading, error }] = useUpdateExchangeMutation();

  // Track if form has been modified from original exchange values
  const hasChanges = useMemo(() => {
    if (!exchange) return false;
    if (name !== exchange.name) return true;
    if (JSON.stringify(config) !== JSON.stringify(exchange.config || null)) return true;
    return false;
  }, [name, config, exchange]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  // Reset form when exchange changes
  useEffect(() => {
    if (exchange) {
      setName(exchange.name);
      setConfig(exchange.config || null);
    }
  }, [exchange]);

  const handleSubmit = async () => {
    if (!exchange) return;

    try {
      const input: Record<string, unknown> = {};

      if (name !== exchange.name) {
        input.name = name;
      }

      if (config) {
        input.config = config;
      }

      if (Object.keys(input).length === 0) {
        onClose();
        return;
      }

      const result = await updateExchange({
        variables: {
          id: exchange.id,
          input,
        },
      });

      if (result.data?.updateExchange) {
        setName('');
        setConfig(null);

        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error('Failed to update exchange:', err);
    }
  };

  if (!exchange) return null;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 700 },
            maxWidth: '100%',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" component="h2">
            Edit Exchange
          </Typography>
          <IconButton onClick={handleClose} size="small" aria-label="close">
            <Close />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            px: 3,
            py: 2,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Exchange Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              autoComplete="off"
              placeholder="e.g., Binance Production, Coinbase Testnet"
              helperText="A descriptive name to identify this exchange configuration"
            />

            <FreqtradeConfigForm
              value={config}
              onChange={setConfig}
              defaultSections={EXCHANGE_SECTIONS}
              enabledSections={EXCHANGE_SECTIONS}
              showExtendedToggle={false}
            />

            {error && (
              <FormHelperText error>
                Error updating exchange: {error.message}
              </FormHelperText>
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Divider />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            px: 3,
            py: 2,
          }}
        >
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Updating...' : 'Update Exchange'}
          </Button>
        </Box>
      </Drawer>
      <UnsavedChangesDrawer
        open={confirmDialogOpen}
        onCancel={cancelClose}
        onDiscard={confirmClose}
      />
    </>
  );
};
