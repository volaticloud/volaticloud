/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface RuntimeConfig {
  ANYTRADE__GRAPHQL_URL: string;
  [key: string]: string;
}

interface ConfigContextType {
  config: RuntimeConfig;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

export const useConfigValue = (key: string): string => {
  const { config } = useConfig();
  return config[key];
};

export const getConfig = (key: string): string => {
  // This is a helper function that can be used outside of React components
  // Note: This should only be called after config is loaded
  const configElement = document.getElementById('runtime-config');
  if (configElement) {
    const config = JSON.parse(configElement.textContent || '{}');
    return config[key];
  }
  throw new Error('Config not loaded yet');
};

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/config.json');

        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.statusText}`);
        }

        const data = await response.json();
        setConfig(data);
      } catch (err) {
        console.error('Error loading runtime configuration:', err);
        setError(err as Error);
      }
    };

    fetchConfig();
  }, []);

  if (!config) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2
        }}
      >
        {error ? (
          <>
            <Typography variant="h6" color="error">
              Failed to load configuration
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {error.message}
            </Typography>
          </>
        ) : (
          <>
            <CircularProgress size={60} />
            <Typography variant="h6" color="textSecondary">
              Loading configuration...
            </Typography>
          </>
        )}
      </Box>
    );
  }

  return (
    <ConfigContext.Provider value={{ config }}>
      {children}
    </ConfigContext.Provider>
  );
};