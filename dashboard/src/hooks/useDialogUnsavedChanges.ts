import { useState, useCallback } from 'react';

interface UseDialogUnsavedChangesOptions {
  /** Whether there are unsaved changes in the dialog */
  hasChanges: boolean;
  /** Original onClose handler from dialog props */
  onClose: () => void;
}

interface UseDialogUnsavedChangesResult {
  /** Wrapped close handler that checks for unsaved changes */
  handleClose: () => void;
  /** Whether the confirmation dialog should be shown */
  confirmDialogOpen: boolean;
  /** Cancel leaving - close confirmation dialog */
  cancelClose: () => void;
  /** Confirm leaving - discard changes and close */
  confirmClose: () => void;
}

/**
 * Hook to guard dialog forms against accidental close when there are unsaved changes.
 *
 * Simpler than useUnsavedChangesGuard - designed specifically for MUI Dialog components.
 * Wraps the onClose handler to show a confirmation dialog when there are unsaved changes.
 *
 * @example
 * ```tsx
 * const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
 *   hasChanges,
 *   onClose,
 * });
 *
 * return (
 *   <>
 *     <Dialog open={open} onClose={handleClose}>
 *       {children}
 *     </Dialog>
 *     <UnsavedChangesDialog
 *       open={confirmDialogOpen}
 *       onCancel={cancelClose}
 *       onDiscard={confirmClose}
 *     />
 *   </>
 * );
 * ```
 */
export function useDialogUnsavedChanges({
  hasChanges,
  onClose,
}: UseDialogUnsavedChangesOptions): UseDialogUnsavedChangesResult {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setConfirmDialogOpen(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const cancelClose = useCallback(() => {
    setConfirmDialogOpen(false);
  }, []);

  const confirmClose = useCallback(() => {
    setConfirmDialogOpen(false);
    onClose();
  }, [onClose]);

  return {
    handleClose,
    confirmDialogOpen,
    cancelClose,
    confirmClose,
  };
}

export default useDialogUnsavedChanges;
