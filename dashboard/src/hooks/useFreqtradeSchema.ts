import { useState, useEffect } from 'react';

const SCHEMA_URL = 'https://schema.freqtrade.io/schema.json';

// Cache the schema globally to avoid repeated fetches
let cachedSchema: any = null;
let fetchPromise: Promise<any> | null = null;

/**
 * Hook to fetch and cache the Freqtrade JSON schema
 * The schema is fetched once and cached for the entire application
 */
export function useFreqtradeSchema() {
  const [schema, setSchema] = useState<any>(cachedSchema);
  const [loading, setLoading] = useState(!cachedSchema);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If already cached, use it
    if (cachedSchema) {
      setSchema(cachedSchema);
      setLoading(false);
      return;
    }

    // If already fetching, wait for it
    if (fetchPromise) {
      fetchPromise
        .then((data) => {
          setSchema(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err);
          setLoading(false);
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
        setSchema(data);
        setLoading(false);
        return data;
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
        fetchPromise = null; // Allow retry
        throw err;
      });
  }, []);

  return { schema, loading, error };
}