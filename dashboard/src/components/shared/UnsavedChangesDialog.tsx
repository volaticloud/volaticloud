import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import { Warning } from '@mui/icons-material';

/**
 * Pre-built dialog component for unsaved changes confirmation.
 * For complex save logic, use useUnsavedChangesGuard hook directly
 * and render your own dialog.
 */
interface UnsavedChangesDialogProps {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave?: () => Promise<void> | void;
}

export function UnsavedChangesDialog({
  open,
  onCancel,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Warning color="warning" />
        Unsaved Changes
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          You have unsaved changes that will be lost if you leave this page.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Do you want to save your changes before leaving?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="error" onClick={onDiscard}>
          Discard Changes
        </Button>
        {onSave && (
          <Button variant="contained" onClick={onSave}>
            Save & Leave
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default UnsavedChangesDialog;
