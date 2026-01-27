import { StrategiesList } from '../../components/Strategies/StrategiesList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const StrategiesPage = () => {
  useDocumentTitle('Strategies');
  return <StrategiesList />;
};