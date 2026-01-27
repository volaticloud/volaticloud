import { BotsList } from '../../components/Bots/BotsList';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const BotsPage = () => {
  useDocumentTitle('Bots');
  return <BotsList />;
};
