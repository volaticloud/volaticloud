import { RunnersList } from '../../components/Runners/RunnersList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const RunnersPage = () => {
  useDocumentTitle('Runners');
  return <RunnersList />;
};