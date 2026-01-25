import { useTheme, useMediaQuery } from '@mui/material';

/**
 * Hook for responsive layout detection.
 * Returns whether the current viewport is mobile-sized (< 900px).
 */
export function useResponsiveLayout() {
  const theme = useTheme();
  // MUI 'md' breakpoint is 900px
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return {
    /** True when viewport width is below 900px */
    isMobile,
    /** True when viewport width is 900px or above (panels should be shown) */
    showPanels: !isMobile,
  };
}
