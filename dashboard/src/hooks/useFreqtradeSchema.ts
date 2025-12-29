import { useState, useEffect, useRef } from 'react';

const SCHEMA_URL = 'https://schema.freqtrade.io/schema.json';

// Cache the schema globally to avoid repeated fetches
let cachedSchema: object | null = null;
let fetchPromise: Promise<object> | null = null;

/**
 * Hook to fetch and cache the Freqtrade JSON schema
 * The schema is fetched once and cached for the entire application
 */
export function useFreqtradeSchema() {
  const [schema, setSchema] = useState<object | null>(cachedSchema);
  const [loading, setLoading] = useState(!cachedSchema);
  const [error, setError] = useState<Error | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // If already cached, use it
    if (cachedSchema) {
      setSchema(cachedSchema);
      setLoading(false);
      return;
    }

    // Helper to safely update state
    const safeSetState = (data: object | null, err: Error | null, isLoading: boolean) => {
      if (isMountedRef.current) {
        if (data !== null) setSchema(data);
        setError(err);
        setLoading(isLoading);
      }
    };

    // If already fetching, wait for it
    if (fetchPromise) {
      fetchPromise
        .then((data) => {
          safeSetState(data, null, false);
        })
        .catch((err) => {
          safeSetState(null, err, false);
        });
      return;
    }

    // Start fetching
    setLoading(true);
    fetchPromise = fetch(SCHEMA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch schema: ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        cachedSchema = data;
        safeSetState(data, null, false);
        return data;
      })
      .catch((err) => {
        safeSetState(null, err, false);
        fetchPromise = null; // Allow retry
        throw err;
      });

    // Cleanup: mark as unmounted to prevent state updates
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { schema, loading, error };
}