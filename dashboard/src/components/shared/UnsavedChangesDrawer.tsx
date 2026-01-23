import {
  Drawer,
  Box,
  Typography,
  Button,
  IconButton,
  Divider,
} from '@mui/material';
import { Warning, Close } from '@mui/icons-material';

/**
 * Pre-built drawer component for unsaved changes confirmation.
 * For complex save logic, use useUnsavedChangesGuard hook directly
 * and render your own drawer.
 */
interface UnsavedChangesDrawerProps {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave?: () => Promise<void> | void;
}

export function UnsavedChangesDrawer({
  open,
  onCancel,
  onDiscard,
  onSave,
}: UnsavedChangesDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onCancel}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          <Typography variant="h6" component="h2">
            Unsaved Changes
          </Typography>
        </Box>
        <IconButton onClick={onCancel} size="small" aria-label="close">
          <Close />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ px: 3, py: 3 }}>
        <Typography variant="body1" gutterBottom>
          You have unsaved changes that will be lost if you leave this page.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Do you want to save your changes before leaving?
        </Typography>
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
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="error" onClick={onDiscard}>
          Discard Changes
        </Button>
        {onSave && (
          <Button variant="contained" onClick={onSave}>
            Save & Leave
          </Button>
        )}
      </Box>
    </Drawer>
  );
}

export default UnsavedChangesDrawer;
