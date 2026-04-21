import { createContext, useContext } from "react";

/* ─── Brand constants (from brand-assets README) ─── */
export const brand = {
  green: "#00E676",
  greenDark: "#00B85C",
  ink: "#0E0F0C",
  bg: "#FAFAF7",
} as const;

/* ─── Color palettes — tokens copiados del landing ─── */
const light = {
  bg: "#FAFAF7",
  bgWarm: "#F2F1EB",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  surfaceHover: "#F2F1EB",
  surfaceSunken: "#EBEBE3",
  border: "#E5E4DC",
  borderStrong: "#B8B8B0",
  text: "#0E0F0C",
  textSecondary: "#2A2B27",
  textMuted: "#6B6C66",
  textFaint: "#B8B8B0",
  green: brand.green,
  greenDark: brand.greenDark,
  greenDim: "rgba(0,230,118,0.14)",
  red: "#C83B3B",
  redDim: "rgba(200,59,59,0.10)",
  ink: brand.ink,
} as const;

/* Dark mode — pensado para Alamos Pro. Mismo lenguaje de tokens. */
const dark = {
  bg: "#0E0F0C",
  bgWarm: "#17181400",
  surface: "#17181400",
  surfaceRaised: "#191A16",
  surfaceHover: "#1F201B",
  surfaceSunken: "#0A0B08",
  border: "rgba(250,250,247,0.08)",
  borderStrong: "rgba(250,250,247,0.20)",
  text: "#FAFAF7",
  textSecondary: "rgba(250,250,247,0.82)",
  textMuted: "rgba(250,250,247,0.56)",
  textFaint: "rgba(250,250,247,0.32)",
  green: brand.green,
  greenDark: brand.greenDark,
  greenDim: "rgba(0,230,118,0.18)",
  red: "#FF7575",
  redDim: "rgba(255,117,117,0.14)",
  ink: brand.ink,
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
interface ThemeContextValue {
  mode: ThemeMode;
  c: ThemeColors;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  c: light,
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);

