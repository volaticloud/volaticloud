import { ExchangesList } from '../../components/Exchanges/ExchangesList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const ExchangesPage = () => {
  useDocumentTitle('Exchanges');
  return <ExchangesList />;
};
