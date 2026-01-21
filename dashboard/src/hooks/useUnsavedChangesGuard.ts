import { useState, useEffect, useCallback, useRef } from 'react';

interface UseUnsavedChangesGuardOptions {
  /** Whether there are unsaved changes to guard */
  hasChanges: boolean;
  /** Navigation function (e.g., from useNavigate or useOrganizationNavigate) */
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

interface UseUnsavedChangesGuardResult {
  /** Wrapped navigate function that checks for unsaved changes first */
  safeNavigate: (path: string) => void;
  /** Whether the confirmation dialog should be shown */
  dialogOpen: boolean;
  /** Close the dialog without navigating */
  cancelLeave: () => void;
  /** Confirm leaving and navigate to pending destination */
  confirmLeave: () => void;
  /** The pending navigation path (or 'back' for browser back) */
  pendingNavigation: string | null;
}

/**
 * Hook to guard against accidental navigation when there are unsaved changes.
 *
 * Handles three navigation scenarios:
 * 1. Browser refresh/close - uses beforeunload event
 * 2. Browser back/forward - intercepts popstate with history state
 * 3. In-app navigation - wraps navigate() with safeNavigate()
 *
 * @example
 * ```tsx
 * const { safeNavigate, dialogOpen, cancelLeave, confirmLeave } = useUnsavedChangesGuard({
 *   hasChanges,
 *   navigate,
 * });
 *
 * // Use safeNavigate instead of navigate
 * <Button onClick={() => safeNavigate('/home')}>Go Home</Button>
 *
 * // Render your own dialog or use UnsavedChangesDialog component
 * <Dialog open={dialogOpen} onClose={cancelLeave}>
 *   <DialogActions>
 *     <Button onClick={cancelLeave}>Cancel</Button>
 *     <Button onClick={confirmLeave}>Discard</Button>
 *     <Button onClick={async () => {
 *       if (await handleSave()) confirmLeave();
 *     }}>Save & Leave</Button>
 *   </DialogActions>
 * </Dialog>
 * ```
 */
export function useUnsavedChangesGuard({
  hasChanges,
  navigate,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const hasChangesRef = useRef(hasChanges);

  // Keep ref in sync with state for use in event handlers
  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  // Block browser refresh/close when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  /**
   * Navigation Guard for Browser Back/Forward
   *
   * Uses history.replaceState to mark current entry, then intercepts popstate
   * to show confirmation dialog when there are unsaved changes.
   * Path is calculated fresh in the handler to avoid stale closure issues.
   */
  useEffect(() => {
    // Only add guard state if not already present (prevents pollution on remounts)
    const currentState = window.history.state;
    if (!currentState?.preventBack) {
      const initialPath = window.location.pathname + window.location.search;
      window.history.replaceState(
        { preventBack: true, originalState: currentState },
        '',
        initialPath
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      // Calculate current path fresh to avoid stale closure
      const currentPath = window.location.pathname + window.location.search;

      if (hasChangesRef.current) {
        // Re-push state to prevent navigation (use replaceState to avoid history buildup)
        window.history.replaceState({ preventBack: true }, '', currentPath);
        // Show confirmation dialog
        setDialogOpen(true);
        pendingNavigationRef.current = 'back';
      } else if (event.state?.preventBack) {
        // No unsaved changes but we're on our guard state - allow normal back
        window.history.back();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Wrapped navigate function that checks for unsaved changes
  const safeNavigate = useCallback(
    (path: string) => {
      if (hasChangesRef.current) {
        pendingNavigationRef.current = path;
        setDialogOpen(true);
      } else {
        navigate(path);
      }
    },
    [navigate]
  );

  // Handle confirmed navigation after dialog
  const confirmLeave = useCallback(() => {
    setDialogOpen(false);
    if (pendingNavigationRef.current === 'back') {
      window.history.back();
    } else if (pendingNavigationRef.current) {
      navigate(pendingNavigationRef.current);
    }
    pendingNavigationRef.current = null;
  }, [navigate]);

  const cancelLeave = useCallback(() => {
    setDialogOpen(false);
    pendingNavigationRef.current = null;
  }, []);

  return {
    safeNavigate,
    dialogOpen,
    cancelLeave,
    confirmLeave,
    pendingNavigation: pendingNavigationRef.current,
  };
}

export default useUnsavedChangesGuard;
