import { memo } from "react";
import Svg, { G, Line, Polygon, Rect } from "react-native-svg";
import { useTheme } from "../../theme";

interface Props {
  /** Ancho del hero. La altura sale de mantener aspect 2:1. */
  width?: number;
}

/**
 * Hero "Skyline" — 6 isotipos Álamos (los dos triángulos del logo) en
 * stroke verde brand, dispuestos como un skyline urbano: distintas
 * escalas y opacidades dan profundidad/perspectiva. Sobre un card
 * rounded con bg cálido (light) o ink (dark) y una línea de horizonte
 * sutil al pie.
 *
 * Geometría 1:1 con el brand pack (assets/icons/hero/{light,dark}/
 * alamos-skyline.svg) — solo cambia el verde a c.brand canónico
 * (#00C805) en lugar del #00C805 del export.
 *
 * Cada isotipo es:
 *   triángulo trasero:  38,26 16,86 60,86
 *   triángulo delantero: 56,12 29,86 83,86
 */

interface Tower {
  /** Translate X / Y previo al scale. */
  tx: number;
  ty: number;
  scale: number;
  /** Opacidad — controla la profundidad: 1 = primer plano, ~0.35 = fondo. */
  opacity: number;
}

const TOWERS_LIGHT: Tower[] = [
  { tx: 30, ty: 109.8, scale: 0.7, opacity: 0.35 },
  { tx: 70, ty: 79.7, scale: 1.05, opacity: 1 },
  { tx: 140, ty: 96.9, scale: 0.85, opacity: 0.7 },
  { tx: 200, ty: 66.8, scale: 1.2, opacity: 1 },
  { tx: 270, ty: 105.5, scale: 0.75, opacity: 0.5 },
  { tx: 320, ty: 84, scale: 1, opacity: 1 },
];

/** Dark mode: opacidades de fondo levemente más altas — el verde brand
 *  necesita un poco más de presencia sobre el ink para no perderse. */
const TOWERS_DARK: Tower[] = [
  { tx: 30, ty: 109.8, scale: 0.7, opacity: 0.4 },
  { tx: 70, ty: 79.7, scale: 1.05, opacity: 1 },
  { tx: 140, ty: 96.9, scale: 0.85, opacity: 0.75 },
  { tx: 200, ty: 66.8, scale: 1.2, opacity: 1 },
  { tx: 270, ty: 105.5, scale: 0.75, opacity: 0.55 },
  { tx: 320, ty: 84, scale: 1, opacity: 1 },
];

export const HeroSkylineIllustration = memo(function HeroSkylineIllustration({
  width = 360,
}: Props) {
  const { c, mode } = useTheme();
  const isDark = mode === "dark";
  const towers = isDark ? TOWERS_DARK : TOWERS_LIGHT;
  // Bg del card: en light el bg cálido del brand-kit, en dark el ink.
  const bg = isDark ? "#0E0F0C" : "#FAFAF7";
  // Horizonte: contraste invertido del bg.
  const horizon = isDark ? "#FAFAF7" : "#0E0F0C";

  return (
    <Svg width={width} height={width / 2} viewBox="0 0 400 200">
      <Rect width={400} height={200} rx={16} fill={bg} />
      <Line
        x1={20}
        y1={170}
        x2={380}
        y2={170}
        stroke={horizon}
        strokeWidth={1.5}
        opacity={0.25}
      />
      {towers.map((t, i) => (
        <G key={i} opacity={t.opacity}>
          <G transform={`translate(${t.tx} ${t.ty}) scale(${t.scale})`}>
            <Polygon
              points="38,26 16,86 60,86"
              stroke={c.brand}
              strokeWidth={6}
              strokeLinejoin="round"
              fill="none"
            />
            <Polygon
              points="56,12 29,86 83,86"
              stroke={c.brand}
              strokeWidth={6}
              strokeLinejoin="round"
              fill="none"
            />
          </G>
        </G>
      ))}
    </Svg>
  );
});
