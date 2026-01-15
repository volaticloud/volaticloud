import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

// VolatiCloud Design System Colors
const colors = {
  // Brand colors
  brand: {
    primary: '#079211',
    primaryLight: '#4caf50',
    primaryDark: '#056a0c',
  },
  // Light mode
  light: {
    background: '#f8f9fa',
    paper: '#ffffff',
    textPrimary: '#1a1a2e',
    textSecondary: '#6c757d',
    border: '#e9ecef',
    divider: '#dee2e6',
  },
  // Dark mode
  dark: {
    background: '#121212',
    paper: '#1e1e1e',
    textPrimary: '#e4e6eb',
    textSecondary: '#b0b3b8',
    border: '#3e4042',
    divider: '#3e4042',
  },
  // Semantic colors (shared)
  success: '#079211',
  error: '#dc3545',
  warning: '#ffc107',
  info: '#0dcaf0',
};

// Trading-focused color palette
const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // Light mode
          primary: {
            main: colors.brand.primary,
            light: colors.brand.primaryLight,
            dark: colors.brand.primaryDark,
          },
          secondary: {
            main: '#6c757d',
            light: '#adb5bd',
            dark: '#495057',
          },
          success: {
            main: colors.success,
            light: '#e8f5e9',
            dark: '#056a0c',
          },
          error: {
            main: colors.error,
            light: '#f8d7da',
            dark: '#b02a37',
          },
          warning: {
            main: colors.warning,
            light: '#fff3cd',
            dark: '#cc9a06',
          },
          info: {
            main: colors.info,
            light: '#cff4fc',
            dark: '#0aa2c0',
          },
          background: {
            default: colors.light.background,
            paper: colors.light.paper,
          },
          text: {
            primary: colors.light.textPrimary,
            secondary: colors.light.textSecondary,
          },
          divider: colors.light.divider,
        }
      : {
          // Dark mode
          primary: {
            main: colors.brand.primaryLight,
            light: '#81c784',
            dark: colors.brand.primary,
          },
          secondary: {
            main: '#adb5bd',
            light: '#dee2e6',
            dark: '#6c757d',
          },
          success: {
            main: '#66bb6a',
            light: '#81c784',
            dark: '#388e3c',
          },
          error: {
            main: '#f44336',
            light: '#e57373',
            dark: '#d32f2f',
          },
          warning: {
            main: '#ffa726',
            light: '#ffb74d',
            dark: '#f57c00',
          },
          info: {
            main: '#29b6f6',
            light: '#4fc3f7',
            dark: '#0288d1',
          },
          background: {
            default: colors.dark.background,
            paper: colors.dark.paper,
          },
          text: {
            primary: colors.dark.textPrimary,
            secondary: colors.dark.textSecondary,
          },
          divider: colors.dark.divider,
        }),
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.1rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.875rem',
    },
    body2: {
      fontSize: '0.8125rem',
    },
    subtitle1: {
      fontSize: '0.9375rem',
      fontWeight: 500,
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
    },
    caption: {
      fontSize: '0.75rem',
    },
    overline: {
      fontSize: '0.6875rem',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '8px 16px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          boxShadow: mode === 'dark'
            ? '0 4px 6px rgba(0, 0, 0, 0.3)'
            : '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export const createAppTheme = (mode: 'light' | 'dark') => {
  return createTheme(getDesignTokens(mode));
};

export default createAppTheme('light');
