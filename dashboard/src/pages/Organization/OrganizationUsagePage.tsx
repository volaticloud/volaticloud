import { UsageDashboard } from '../../components/Usage/UsageDashboard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const OrganizationUsagePage = () => {
  useDocumentTitle('Usage');
  return <UsageDashboard />;
};