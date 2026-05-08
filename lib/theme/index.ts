import { createContext, useContext } from "react";

/* ─── Brand constants ───────────────────────────────────────
 *
 * SISTEMA DE VERDES (rige toda la app):
 *
 *   green     #00C805 — BRAND. Logo, CTAs, action buttons,
 *                       briefing tone, asset-up en contextos
 *                       NO data (pills, badges, tabs).
 *   greenData #5AC53A — DATA. Charts, sparklines, deltas %,
 *                       "up" en contextos data. Verde más suave
 *                       para no machacar el ojo en lecturas
 *                       continuas. Mismo en light + dark.
 *
 * Los demás tokens del theme (action, positive, greenDark,
 * green) son ALIASES de uno de estos dos según su semántica
 * histórica — ver light/dark en lib/theme/index.ts. */
export const brand = {
  green: "#00C805",
  greenData: "#5AC53A",
  /* @deprecated alias de greenData — usá greenData o c.greenDark */
  greenDark: "#5AC53A",
  ink: "#0E0F0C",
  bg: "#FFFFFF",
} as const;

/* ─── Color palettes — trading-hardcore aesthetic (Binance-style).
 *     Light: blanco puro + grises neutros fríos.
 *     Dark:  negro puro + grises muy oscuros.
 *
 * El verde de marca es UN solo color, definido en `brand.green` arriba:
 * `#00C805` (mismo en light y dark). Es el verde que usa el isotipo
 * del logo, la pantalla de orden ejecutada, y todo lo que represente
 * identidad de marca.
 *
 * Conviven dos tokens auxiliares — `action` y `positive` — que tienen
 * roles funcionales distintos al brand y NO son verdes de marca:
 *   - `action` — verde un poco más tierra, usado en CTAs y la pill
 *     activa del nav bar.
 *   - `positive` — verde más oscuro/técnico para deltas positivos en
 *     charts y % de retorno.
 *
 * Cada uno tiene su `Dim` (rgba al 14%) para badges/pills sin
 * dominar. Los tokens viejos `green/greenDark/greenDim` se mantienen
 * como aliases — `green = action`, `greenDark = positive` — para no
 * romper código que aún no migró. */
const light = {
  bg: "#FFFFFF",
  bgWarm: "#FAFAFA",
  /** Beige cálido oficial del brand-kit — para superficies con
   *  identidad de marca (heroes, banners, success screens). */
  beige: "#F0EEE9",
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

  /* Sistema de verdes — DOS tokens semánticos:
   *
   *   c.brand     #00C805 — identity, CTAs, action buttons,
   *                         briefing tone, asset-up no-data,
   *                         notifications, success, badges.
   *                         IDÉNTICO en light + dark.
   *
   *   c.dataGreen — verde para la LÍNEA del chart de activo
   *                 individual. En light se mantiene igual que
   *                 brand (#00C805 vivid sobre cards blancas se
   *                 lee bien), en dark baja a #5AC53A para no
   *                 machacar el ojo sobre fondo oscuro mientras
   *                 el usuario mira el chart fijo. */
  brand: "#00C805",
  brandDim: "rgba(0,200,5,0.14)",
  dataGreen: "#00C805",
  dataGreenDim: "rgba(0,200,5,0.14)",

  // Token "down" para activos: naranja cálido #EB5D2A en vez de rojo
  // puro. El rojo cargado se leía como error/warning en una pantalla
  // donde el down es un estado normal del activo. El naranja suaviza
  // la sensación cuando el portfolio o el activo están en negativo
  // sin perder contraste con el verde brand. Mantengo el nombre del
  // token (`red`) para no romper consumers — es un alias semántico.
  red: "#EB5D2A",
  redDim: "rgba(235,93,42,0.12)",
  ink: brand.ink,
} as const;

/* Dark mode — negro puro (pure-black OLED). */
const dark = {
  bg: "#000000",
  bgWarm: "#0A0A0A",
  /** En dark, "beige" es un gris tirando a marrón — mismo rol pero
   *  adaptado para que no destruya el contraste del modo OLED. */
  beige: "#1A1815",
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

  /* Mismo sistema que light: brand (#00C805) + dataGreen
   * (#5AC53A), idénticos a los de light mode. */
  brand: "#00C805",
  brandDim: "rgba(0,200,5,0.18)",
  dataGreen: "#5AC53A",
  dataGreenDim: "rgba(90,197,58,0.18)",

  // Naranja "down" en dark — un toque más saturado que en light
  // para mantener legibilidad sobre fondo OLED.
  red: "#F26A3D",
  redDim: "rgba(242,106,61,0.16)",
  ink: "#000000",
} as const;


export interface ThemeColors {
  bg: string;
  bgWarm: string;
  beige: string;
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
  /* Verdes semánticos — sólo dos tokens. brand para identity y
   * CTAs; dataGreen para charts y deltas. */
  brand: string;
  brandDim: string;
  dataGreen: string;
  dataGreenDim: string;
  red: string;
  redDim: string;
  ink: string;
}
export type ThemeMode = "light" | "dark";

export const themes: Record<ThemeMode, ThemeColors> = { light, dark };

/* ─── Tipografía: Plus Jakarta Sans (display/body) + JetBrains Mono
 *     (data/labels técnicas). Los dos vienen del brand-kit oficial. */
export type FontWeight = 400 | 500 | 600 | 700 | 800;

export const fontFamily: Record<FontWeight, string> = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
};

/**
 * JetBrains Mono — la fuente monoespaciada del brand-kit. Pensada
 * para eyebrows técnicos (`DISPONIBLE PARA OPERAR`, `MÉTRICAS`),
 * microcopy data (`T+1`, `0,02%`, `MEP`), IDs/CBUs (`AC-2026-···4421`)
 * y cualquier valor que se beneficie del feel "panel de control" y
 * de la alineación columna en grids.
 *
 * Sólo cargamos los pesos 500 y 700 — el set core lo cubre en mono.
 */
export const fontMono = {
  500: "JetBrainsMono_500Medium",
  700: "JetBrainsMono_700Bold",
} as const;

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

