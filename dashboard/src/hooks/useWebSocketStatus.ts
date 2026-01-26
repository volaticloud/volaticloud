import { useState, useEffect } from 'react';
import {
  ConnectionStatus,
  addConnectionStatusListener,
} from '../graphql/client';

/**
 * Hook to get current WebSocket connection status.
 * Useful for conditional rendering based on connection state.
 */
export function useWebSocketStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = addConnectionStatusListener((newStatus, err) => {
      setStatus(newStatus);
      setError(err || null);
    });

    return unsubscribe;
  }, []);

  return {
    status,
    error,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected' || status === 'error',
  };
}
