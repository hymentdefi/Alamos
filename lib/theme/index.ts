import { createContext, useContext } from "react";

/* ─── Brand constants (from brand-assets README) ─── */
export const brand = {
  green: "#00C805",
  greenDark: "#00A304",
  ink: "#0E0F0C",
  bg: "#FFFFFF",
} as const;

/* ─── Color palettes — trading-hardcore aesthetic (Binance-style).
 *     Light: blanco puro + grises neutros fríos.
 *     Dark:  negro puro + grises muy oscuros. */
const light = {
  bg: "#FFFFFF",
  bgWarm: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceHover: "#F5F5F5",
  surfaceSunken: "#EEEEEE",
  border: "#E5E5E5",
  borderStrong: "#BDBDBD",
  text: "#0E0F0C",
  textSecondary: "#2A2A2A",
  textMuted: "#737373",
  textFaint: "#A3A3A3",
  green: brand.green,
  greenDark: brand.greenDark,
  greenDim: "rgba(0,200,5,0.14)",
  red: "#C83B3B",
  redDim: "rgba(200,59,59,0.10)",
  ink: brand.ink,
} as const;

/* Dark mode — negro puro (pure-black OLED). */
const dark = {
  bg: "#000000",
  bgWarm: "#0A0A0A",
  surface: "#0D0D0D",
  surfaceRaised: "#141414",
  surfaceHover: "#1A1A1A",
  surfaceSunken: "#050505",
  border: "#1F1F1F",
  borderStrong: "#333333",
  text: "#EAECEF",
  textSecondary: "#B7BDC6",
  textMuted: "#848E9C",
  textFaint: "#5E6673",
  green: "#0ECB81",
  greenDark: "#02A05C",
  greenDim: "rgba(14,203,129,0.16)",
  red: "#F6465D",
  redDim: "rgba(246,70,93,0.14)",
  ink: "#000000",
} as const;


export interface ThemeColors {
  bg: string;
  bgWarm: string;
  surface: string;
  surfaceRaised: string;
  surfaceHover: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  green: string;
  greenDark: string;
  greenDim: string;
  red: string;
  redDim: string;
  ink: string;
}
export type ThemeMode = "light" | "dark";

export const themes: Record<ThemeMode, ThemeColors> = { light, dark };

/* ─── Tipografía: Plus Jakarta Sans ─── */
export type FontWeight = 400 | 500 | 600 | 700 | 800;

export const fontFamily: Record<FontWeight, string> = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
};

/** Tamaños tipográficos alineados con el landing. */
export const type = {
  display: { fontFamily: fontFamily[700], fontSize: 44, lineHeight: 46, letterSpacing: -1.8 },
  h1: { fontFamily: fontFamily[700], fontSize: 32, lineHeight: 36, letterSpacing: -1.1 },
  h2: { fontFamily: fontFamily[700], fontSize: 24, lineHeight: 28, letterSpacing: -0.7 },
  h3: { fontFamily: fontFamily[700], fontSize: 19, lineHeight: 24, letterSpacing: -0.4 },
  bodyLg: { fontFamily: fontFamily[500], fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily[500], fontSize: 15, lineHeight: 22, letterSpacing: -0.15 },
  bodyStrong: { fontFamily: fontFamily[600], fontSize: 15, lineHeight: 22, letterSpacing: -0.15 },
  small: { fontFamily: fontFamily[500], fontSize: 13, lineHeight: 18, letterSpacing: -0.1 },
  smallStrong: { fontFamily: fontFamily[600], fontSize: 13, lineHeight: 18, letterSpacing: -0.1 },
  micro: { fontFamily: fontFamily[500], fontSize: 11, lineHeight: 14, letterSpacing: 0 },
  microStrong: { fontFamily: fontFamily[700], fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  /** Radio para botones CTA grandes (height 48+). Menos redondeado que pill. */
  btn: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/* ─── Context ─── */
/** Preferencia del usuario. 'system' sigue la config del celular. */
export type ThemeModePref = "light" | "dark" | "system";

interface ThemeContextValue {
  /** Tema efectivo que está renderizándose (nunca 'system'). */
  mode: ThemeMode;
  /** Preferencia elegida por el usuario (puede ser 'system'). */
  pref: ThemeModePref;
  c: ThemeColors;
  /** Toggle light/dark rápido. */
  toggle: () => void;
  /** Setear la preferencia explícitamente. */
  setPref: (p: ThemeModePref) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  pref: "light",
  c: light,
  toggle: () => {},
  setPref: () => {},
});

export const useTheme = () => useContext(ThemeContext);

