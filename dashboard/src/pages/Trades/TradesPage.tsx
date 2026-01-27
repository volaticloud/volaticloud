import { TradesList } from '../../components/Trades/TradesList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const TradesPage = () => {
  useDocumentTitle('Trades');
  return <TradesList />;
};