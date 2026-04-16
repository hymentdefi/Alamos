import { createContext, useContext } from "react";

/* ─── Brand constants ─── */
export const brand = {
  green: "#00E676",
  greenDark: "#00C853",
} as const;

/* ─── Color palettes ─── */
const dark = {
  bg: "#000000",
  surface: "#0A0A0A",
  surfaceRaised: "#111111",
  surfaceHover: "#191919",
  border: "rgba(255,255,255,0.06)",
  text: "#FFFFFF",
  textSecondary: "#9E9E9E",
  textMuted: "#555555",
  green: brand.green,
  red: "#FF4444",
  greenDim: "rgba(0,230,118,0.10)",
  redDim: "rgba(255,68,68,0.10)",
} as const;

const light = {
  bg: "#FFFFFF",
  surface: "#F8F8F8",
  surfaceRaised: "#FFFFFF",
  surfaceHover: "#F0F0F0",
  border: "rgba(0,0,0,0.06)",
  text: "#000000",
  textSecondary: "#666666",
  textMuted: "#999999",
  green: brand.green,
  red: "#EF4444",
  greenDim: "rgba(0,230,118,0.10)",
  redDim: "rgba(239,68,68,0.10)",
} as const;

export type ThemeColors = {
  readonly bg: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfaceHover: string;
  readonly border: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly green: string;
  readonly red: string;
  readonly greenDim: string;
  readonly redDim: string;
};
export type ThemeMode = "dark" | "light";

export const themes = { dark, light } as const;

/* ─── Context ─── */
interface ThemeContextValue {
  mode: ThemeMode;
  c: ThemeColors;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  c: dark,
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/* ─── Legacy compat (for screens not yet migrated) ─── */
export const colors = {
  brand: { 500: brand.green, 700: brand.greenDark },
  surface: { 0: "#0A0A0A", 50: "#121212", 100: "#191919", 200: "#242424" },
  text: { primary: "#FFFFFF", secondary: "#9E9E9E", muted: "#616161" },
  accent: { positive: brand.green, negative: "#EF5350" },
  card: "#111111",
  cardHover: "#181818",
  border: "#222222",
  red: "#FF4444",
  redDim: "rgba(255,68,68,0.12)",
  accentDim: "rgba(0,230,118,0.12)",
} as const;
