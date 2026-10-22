import type { ColorScheme } from "../useColorScheme";

// Single-series charts use one hue (validated against Telegram's light and dark surfaces).
// SVG presentation attributes can't read CSS variables, so Recharts gets hex values.
export const CHART_COLORS: Record<ColorScheme, { series: string; grid: string; axis: string }> = {
  light: { series: "#2a78d6", grid: "#e1e0d9", axis: "#898781" },
  dark: { series: "#3987e5", grid: "#2c2c2a", axis: "#898781" },
};
