import React from 'react';
import BacktestDetail from '../../components/Backtests/BacktestDetail';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const BacktestDetailPage: React.FC = () => {
  useDocumentTitle('Backtest Results');
  return <BacktestDetail />;
};