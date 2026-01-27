import { Box } from '@mui/material';
import { BacktestsList } from '../components/Backtests/BacktestsList';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const BacktestsPage = () => {
  useDocumentTitle('Backtests');
  return (
    <Box>
      <BacktestsList />
    </Box>
  );
};