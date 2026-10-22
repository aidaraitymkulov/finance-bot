// Minimal typing of https://telegram.org/js/telegram-web-app.js (loaded in index.html).
interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  onEvent(event: "themeChanged", handler: () => void): void;
  offEvent(event: "themeChanged", handler: () => void): void;
  HapticFeedback?: { selectionChanged(): void };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Present only when opened inside Telegram (outside it `initData` is empty). */
export const webApp: TelegramWebApp | undefined = window.Telegram?.WebApp?.initData
  ? window.Telegram.WebApp
  : undefined;

let devInitData: Promise<string> | undefined;

/**
 * Signed launch data for the backend. Outside Telegram in local dev it comes from the Vite
 * dev server (`/__dev-init-data`, localhost only); the production build has no fallback.
 */
export const getInitData = (): Promise<string> => {
  if (webApp?.initData) {
    return Promise.resolve(webApp.initData);
  }
  if (!import.meta.env.DEV) {
    return Promise.resolve("");
  }
  devInitData ??= fetch("/__dev-init-data").then((response) =>
    response.ok ? response.text() : "",
  );
  return devInitData;
};

export const hapticSelection = () => webApp?.HapticFeedback?.selectionChanged();
