import { SessionsList } from '../../components/Profile/SessionsList';
import { useKeycloakAccount } from '../../hooks/useKeycloakAccount';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const SessionsPage = () => {
  useDocumentTitle('Active Sessions');
  const account = useKeycloakAccount();

  return (
    <SessionsList
      sessions={account.sessions}
      loading={account.loadingSessions}
      error={account.errorSessions}
      onRefresh={account.refreshSessions}
      onDeleteSession={account.deleteSession}
    />
  );
};
