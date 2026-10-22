import { useEffect, useState } from "react";
import { webApp } from "./telegram";

export type ColorScheme = "light" | "dark";

const media = window.matchMedia("(prefers-color-scheme: dark)");

const read = (): ColorScheme => webApp?.colorScheme ?? (media.matches ? "dark" : "light");

/** Telegram's theme inside Telegram, the OS theme in a browser. Mirrored to <html data-theme>. */
export const useColorScheme = (): ColorScheme => {
  const [scheme, setScheme] = useState(read);

  useEffect(() => {
    const update = () => setScheme(read());
    webApp?.onEvent("themeChanged", update);
    media.addEventListener("change", update);
    return () => {
      webApp?.offEvent("themeChanged", update);
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
  }, [scheme]);

  return scheme;
};
