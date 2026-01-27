import { useEffect } from 'react';

const APP_NAME = 'VolatiCloud';

/**
 * Custom hook to set the document title.
 *
 * @param title - The page title (will be suffixed with app name)
 * @param deps - Optional dependency array for dynamic titles
 *
 * @example
 * // Static title
 * useDocumentTitle('Bots');
 * // Result: "Bots | VolatiCloud"
 *
 * @example
 * // Dynamic title based on data
 * useDocumentTitle(bot?.name ? `${bot.name} - Bot` : 'Bot Details', [bot?.name]);
 * // Result: "MyBot - Bot | VolatiCloud" or "Bot Details | VolatiCloud"
 */
export function useDocumentTitle(title: string, deps: React.DependencyList = []) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;

    return () => {
      document.title = previousTitle;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, ...deps]);
}

/**
 * Sets document title without the app name suffix.
 * Use sparingly - prefer useDocumentTitle for consistency.
 */
export function useRawDocumentTitle(title: string, deps: React.DependencyList = []) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    return () => {
      document.title = previousTitle;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, ...deps]);
}
