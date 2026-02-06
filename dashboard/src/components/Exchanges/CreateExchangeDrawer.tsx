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
import { useState, useMemo } from 'react';
import { useCreateExchangeMutation } from './exchanges.generated';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDrawer } from '../shared';
import { FreqtradeConfigForm } from '../Freqtrade/FreqtradeConfigForm';
import { createDefaultExchangeConfig, EXCHANGE_SECTIONS } from '../Freqtrade/defaultConfig';

interface CreateExchangeDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_CONFIG = createDefaultExchangeConfig();

export const CreateExchangeDrawer = ({ open, onClose, onSuccess }: CreateExchangeDrawerProps) => {
  const { activeOrganizationId } = useActiveOrganization();
  const [name, setName] = useState('');
  const [config, setConfig] = useState<object>(DEFAULT_CONFIG);

  const [createExchange, { loading, error }] = useCreateExchangeMutation();

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    if (name !== '') return true;
    if (JSON.stringify(config) !== JSON.stringify(DEFAULT_CONFIG)) return true;
    return false;
  }, [name, config]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  const handleSubmit = async () => {
    if (!name || !config || !activeOrganizationId) {
      return;
    }

    try {
      const result = await createExchange({
        variables: {
          input: {
            name,
            config,
            ownerID: activeOrganizationId,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createExchange) {
        // Reset form
        setName('');
        setConfig(DEFAULT_CONFIG);

        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error('Failed to create exchange:', err);
    }
  };

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
            Add Exchange
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
              required
              fullWidth
              autoComplete="off"
              placeholder="e.g., Binance Production, Coinbase Testnet"
              helperText="A descriptive name to identify this exchange configuration"
              inputProps={{ 'data-testid': 'exchange-name-input' }}
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
                Error creating exchange: {error.message}
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
            disabled={loading || !name || !config}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            data-testid="submit-add-exchange"
          >
            {loading ? 'Adding...' : 'Add Exchange'}
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
