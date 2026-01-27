import { useEffect } from 'react';

const APP_NAME = 'VolatiCloud';

/**
 * Custom hook to set the document title.
 * Automatically restores the previous title on unmount.
 *
 * @param title - The page title (will be suffixed with app name)
 *
 * @example
 * // Static title
 * useDocumentTitle('Bots');
 * // Result: "Bots | VolatiCloud"
 *
 * @example
 * // Dynamic title based on data
 * useDocumentTitle(bot?.name ? `${bot.name} - Bot` : 'Bot Details');
 * // Result: "MyBot - Bot | VolatiCloud" or "Bot Details | VolatiCloud"
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
