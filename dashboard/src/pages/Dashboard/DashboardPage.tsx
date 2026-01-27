import { Dashboard } from '../../components/Dashboard/Dashboard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const DashboardPage = () => {
  useDocumentTitle('Dashboard');
  return <Dashboard />;
};
