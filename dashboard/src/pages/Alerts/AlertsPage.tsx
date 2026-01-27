import { AlertsList } from '../../components/Alerts/AlertsList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const AlertsPage = () => {
  useDocumentTitle('Alerts');
  return <AlertsList />;
};