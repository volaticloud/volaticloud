import { ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  DialogProps,
} from '@mui/material';

interface FormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when dialog should close */
  onClose: () => void;
  /** Dialog title */
  title: string;
  /** Dialog content */
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
  /** Maximum width of dialog */
  maxWidth?: DialogProps['maxWidth'];
  /** Whether dialog takes full width */
  fullWidth?: boolean;
  /** Use dividers in DialogContent */
  dividers?: boolean;
  /** Additional actions to render before cancel button */
  additionalActions?: ReactNode;
}

/**
 * Reusable form dialog wrapper with consistent structure and error handling.
 *
 * @example
 * const [name, setName] = useState('');
 * const mutation = useMutationHandler(createBot, { ... });
 *
 * <FormDialog
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
 * </FormDialog>
 */
export function FormDialog({
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
  maxWidth = 'sm',
  fullWidth = true,
  dividers = false,
  additionalActions,
}: FormDialogProps) {
  const handleSubmit = async () => {
    await onSubmit();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth={fullWidth}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers={dividers}>
        {children}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
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
      </DialogActions>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when dialog should close */
  onClose: () => void;
  /** Dialog title */
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
}

/**
 * Reusable confirmation dialog for destructive actions.
 *
 * @example
 * const mutation = useMutationHandler(deleteBot, { ... });
 *
 * <ConfirmDialog
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
export function ConfirmDialog({
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
}: ConfirmDialogProps) {
  return (
    <FormDialog
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
    >
      {typeof message === 'string' ? <span>{message}</span> : message}
    </FormDialog>
  );
}