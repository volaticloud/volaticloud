import { ReactNode } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Close } from '@mui/icons-material';

interface FormDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Called when drawer should close */
  onClose: () => void;
  /** Drawer title */
  title: string;
  /** Drawer content */
  children: ReactNode;
  /** Submit button text (default: "Submit") */
  submitLabel?: string;
  /** Submit button text while loading (default: "Saving...") */
  submitLoadingLabel?: string;
  /** Cancel button text (default: "Cancel") */
  cancelLabel?: string;
  /** Called when submit button is clicked */
  onSubmit: () => void | Promise<void>;
  /** Whether the form is submitting */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Whether submit button should be disabled */
  submitDisabled?: boolean;
  /** Submit button color (default: "primary") */
  submitColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  /** Drawer width (default: 480) */
  width?: number | string;
  /** Additional actions to render before cancel button */
  additionalActions?: ReactNode;
  /** Anchor position (default: "right") */
  anchor?: 'left' | 'right';
}

/**
 * Reusable form drawer wrapper with consistent structure and error handling.
 *
 * @example
 * const [name, setName] = useState('');
 * const mutation = useMutationHandler(createBot, { ... });
 *
 * <FormDrawer
 *   open={open}
 *   onClose={onClose}
 *   title="Create Bot"
 *   submitLabel="Create"
 *   loading={mutation.state.loading}
 *   error={mutation.state.error}
 *   submitDisabled={!name}
 *   onSubmit={() => mutation.execute({ name })}
 * >
 *   <TextField value={name} onChange={(e) => setName(e.target.value)} />
 * </FormDrawer>
 */
export function FormDrawer({
  open,
  onClose,
  title,
  children,
  submitLabel = 'Submit',
  submitLoadingLabel = 'Saving...',
  cancelLabel = 'Cancel',
  onSubmit,
  loading = false,
  error = null,
  submitDisabled = false,
  submitColor = 'primary',
  width = 480,
  additionalActions,
  anchor = 'right',
}: FormDrawerProps) {
  const handleSubmit = async () => {
    await onSubmit();
  };

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: width },
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
          {title}
        </Typography>
        <IconButton
          onClick={onClose}
          disabled={loading}
          size="small"
          aria-label="close"
        >
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
        {children}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
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
        {additionalActions}
        <Button onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={handleSubmit}
          color={submitColor}
          variant="contained"
          disabled={loading || submitDisabled}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? submitLoadingLabel : submitLabel}
        </Button>
      </Box>
    </Drawer>
  );
}

interface ConfirmDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Called when drawer should close */
  onClose: () => void;
  /** Drawer title */
  title: string;
  /** Confirmation message */
  message: ReactNode;
  /** Confirm button text (default: "Confirm") */
  confirmLabel?: string;
  /** Confirm button text while loading (default: "Processing...") */
  confirmLoadingLabel?: string;
  /** Cancel button text (default: "Cancel") */
  cancelLabel?: string;
  /** Called when confirm button is clicked */
  onConfirm: () => void | Promise<void>;
  /** Whether the operation is in progress */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Confirm button color (default: "error") */
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  /** Drawer width (default: 400) */
  width?: number | string;
}

/**
 * Reusable confirmation drawer for destructive actions.
 *
 * @example
 * const mutation = useMutationHandler(deleteBot, { ... });
 *
 * <ConfirmDrawer
 *   open={open}
 *   onClose={onClose}
 *   title="Delete Bot"
 *   message={<>Are you sure you want to delete <strong>{bot.name}</strong>?</>}
 *   confirmLabel="Delete"
 *   loading={mutation.state.loading}
 *   error={mutation.state.error}
 *   onConfirm={() => mutation.execute({ id: bot.id })}
 * />
 */
export function ConfirmDrawer({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmLoadingLabel = 'Processing...',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
  error = null,
  confirmColor = 'error',
  width = 400,
}: ConfirmDrawerProps) {
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title={title}
      submitLabel={confirmLabel}
      submitLoadingLabel={confirmLoadingLabel}
      cancelLabel={cancelLabel}
      onSubmit={onConfirm}
      loading={loading}
      error={error}
      submitColor={confirmColor}
      width={width}
    >
      <Box sx={{ py: 1 }}>
        {typeof message === 'string' ? <Typography>{message}</Typography> : message}
      </Box>
    </FormDrawer>
  );
}
