import { Box } from '@mui/material';
import StrategyStudio from '../../components/Strategies/StrategyStudio';

/**
 * StrategyStudioPage - Full-bleed layout wrapper for Strategy Studio.
 *
 * This page uses negative margins to create a full-bleed layout that extends
 * beyond the default page container padding. This approach was chosen because:
 *
 * 1. The Strategy Studio needs to maximize screen real estate for the code editor
 * 2. Modifying the global page container would affect all other pages
 * 3. This pattern is isolated to this specific page without side effects
 *
 * The negative margins correspond to the MainContent padding in MainLayout:
 * - xs: theme.spacing(2) = 16px
 * - sm+: theme.spacing(3) = 24px
 *
 * If MainLayout padding changes, these values must be updated accordingly.
 */
export const StrategyStudioPage = () => {
  return (
    <Box
      sx={{
        // Full-bleed layout: extend into parent's padding area
        // See component JSDoc for rationale
        position: 'relative',
        height: 'calc(100vh - 64px)', // viewport minus AppBar height
        mx: { xs: -2, sm: -3 }, // Counter MainLayout horizontal padding
        mt: { xs: -2, sm: -3 }, // Counter MainLayout top padding
        mb: { xs: -2, sm: -3 }, // Counter MainLayout bottom padding
      }}
    >
      <StrategyStudio />
    </Box>
  );
};