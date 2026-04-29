import { Image, type ImageStyle, type StyleProp } from "react-native";

type Variant = "mark" | "lockup" | "lockupShort";
/**
 * - `light` — outline bold con verde + negro (uso general, fondos claros).
 * - `dark`  — versión para fondos oscuros (mismo outline, ajustado).
 * - `green` — todo verde (triángulos + texto). El logo "principal" de la
 *   identidad: máximo brand recall, ideal para heroes, success states,
 *   greeting overlays y cualquier momento donde queramos plantar marca.
 * - `white` — todo blanco. Para fondos oscuros plenos o fotos.
 * - `black` — todo negro. Para fondos muy claros donde el verde se pierde.
 */
type Tone = "light" | "dark" | "green" | "white" | "black";

interface LogoProps {
  variant?: Variant;
  tone?: Tone;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Mapa de assets por variant + tone. Las versiones mono- (green/white/black)
 * vienen del set `empresa-mono/` del brand-kit; las light/dark vienen de
 * `empresa/`. Sólo cargamos PNGs de 1024 — Image escala bien a downstream.
 */
const sources = {
  mark: {
    light: require("../../assets/brand-assets/empresa/png/brand-isotipo-1024.png"),
    dark: require("../../assets/brand-assets/empresa/png/brand-isotipo-dark-1024.png"),
    green: require("../../assets/brand-assets/empresa-mono/png/brand-mono-green-isotipo-1024.png"),
    white: require("../../assets/brand-assets/empresa-mono/png/brand-mono-white-isotipo-1024.png"),
    black: require("../../assets/brand-assets/empresa-mono/png/brand-mono-black-isotipo-1024.png"),
  },
  lockup: {
    light: require("../../assets/brand-assets/empresa/png/brand-lockup-1024.png"),
    dark: require("../../assets/brand-assets/empresa/png/brand-lockup-dark-1024.png"),
    green: require("../../assets/brand-assets/empresa-mono/png/brand-mono-green-lockup-1024.png"),
    white: require("../../assets/brand-assets/empresa-mono/png/brand-mono-white-lockup-1024.png"),
    black: require("../../assets/brand-assets/empresa-mono/png/brand-mono-black-lockup-1024.png"),
  },
  lockupShort: {
    light: require("../../assets/brand-assets/empresa/png/brand-lockup-short-1024.png"),
    dark: require("../../assets/brand-assets/empresa/png/brand-lockup-short-dark-1024.png"),
    green: require("../../assets/brand-assets/empresa-mono/png/brand-mono-green-lockup-short-1024.png"),
    white: require("../../assets/brand-assets/empresa-mono/png/brand-mono-white-lockup-short-1024.png"),
    black: require("../../assets/brand-assets/empresa-mono/png/brand-mono-black-lockup-short-1024.png"),
  },
} as const;

const aspectRatio: Record<Variant, number> = {
  mark: 1,
  lockup: 4.4,
  lockupShort: 2.6,
};

export function AlamosLogo({
  variant = "mark",
  tone = "light",
  size = 32,
  style,
}: LogoProps) {
  const isMark = variant === "mark";
  const width = isMark ? size : size * aspectRatio[variant];
  const height = isMark ? size : size;

  return (
    <Image
      source={sources[variant][tone]}
      style={[{ width, height }, style]}
      resizeMode="contain"
    />
  );
}
