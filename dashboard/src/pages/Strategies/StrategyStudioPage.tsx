import { Box } from '@mui/material';
import StrategyStudio from '../../components/Strategies/StrategyStudio';

export const StrategyStudioPage = () => {
  return (
    <Box
      sx={{
        // Create a positioned container that fills the available space
        // Use negative margins to extend into the padding area
        position: 'relative',
        height: 'calc(100vh - 64px)', // viewport minus AppBar only
        mx: { xs: -2, sm: -3 }, // Counter horizontal padding (16px xs, 24px sm)
        mt: { xs: -2, sm: -3 }, // Counter top padding
        mb: { xs: -2, sm: -3 }, // Counter bottom padding
      }}
    >
      <StrategyStudio />
    </Box>
  );
};