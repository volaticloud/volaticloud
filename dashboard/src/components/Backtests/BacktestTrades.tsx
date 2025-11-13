import { extractTrades } from '../../types/freqtrade';
import TradesTable from '../shared/TradesTable';

interface BacktestTradesProps {
  result: any;
}

/**
 * Trades display component for strategy page.
 * Uses the shared TradesTable component in collapsible mode.
 */
export const BacktestTrades = ({ result }: BacktestTradesProps) => {
  const trades = extractTrades(result);

  return (
    <TradesTable
      trades={trades}
      collapsible={true}
      title="Trades"
      initialCollapsed={false}
    />
  );
};