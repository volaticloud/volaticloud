import BotDetail from '../../components/Bots/BotDetail';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const BotDetailPage = () => {
  useDocumentTitle('Bot Details');
  return <BotDetail />;
};