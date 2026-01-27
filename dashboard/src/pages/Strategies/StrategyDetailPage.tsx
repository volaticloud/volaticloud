import StrategyDetail from '../../components/Strategies/StrategyDetail';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const StrategyDetailPage = () => {
  useDocumentTitle('Strategy Details');
  return <StrategyDetail />;
};