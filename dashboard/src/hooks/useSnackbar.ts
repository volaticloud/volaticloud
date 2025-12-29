import { useState, useCallback } from 'react';

export type SnackbarSeverity = 'success' | 'error' | 'warning' | 'info';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: SnackbarSeverity;
}

interface UseSnackbarReturn {
  /** Current snackbar state */
  state: SnackbarState;
  /** Show a success message */
  success: (message: string) => void;
  /** Show an error message */
  error: (message: string) => void;
  /** Show a warning message */
  warning: (message: string) => void;
  /** Show an info message */
  info: (message: string) => void;
  /** Close the snackbar */
  close: () => void;
}

/**
 * Hook to manage snackbar/toast notification state.
 *
 * @example
 * const snackbar = useSnackbar();
 *
 * // Show notifications
 * snackbar.success('Bot created successfully');
 * snackbar.error('Failed to delete bot');
 *
 * // In JSX
 * <Snackbar open={snackbar.state.open} autoHideDuration={6000} onClose={snackbar.close}>
 *   <Alert severity={snackbar.state.severity}>{snackbar.state.message}</Alert>
 * </Snackbar>
 */
export function useSnackbar(): UseSnackbarReturn {
  const [state, setState] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const show = useCallback((message: string, severity: SnackbarSeverity) => {
    setState({ open: true, message, severity });
  }, []);

  const success = useCallback((message: string) => show(message, 'success'), [show]);
  const error = useCallback((message: string) => show(message, 'error'), [show]);
  const warning = useCallback((message: string) => show(message, 'warning'), [show]);
  const info = useCallback((message: string) => show(message, 'info'), [show]);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return { state, success, error, warning, info, close };
}