import Svg, { Path, Polygon, Rect } from "react-native-svg";
import { useTheme } from "../../theme";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 200. */
  size?: number;
}

/**
 * Ilustración "Mercado cerrado" — copia textual de la card "Privacidad"
 * del brand-kit/14-illustrations: candado outline con los dos
 * triángulos del isotipo Alamos adentro (uno verde, uno negro).
 *
 * Geometría exacta del brand-kit:
 *   - viewBox 200×160
 *   - candado: rect 60,68 80×72 r=6 + shackle path
 *   - tri verde:  92,98 80,124 108,124 (stroke 2.5, verde brand)
 *   - tri negro:  108,90 96,124 124,124 (stroke 2.5, ink)
 *   - todo outline, sin fills (excepto overlap natural).
 */
export function MarketClosedIllustration({ size = 200 }: Props) {
  const { c } = useTheme();
  const ink = c.text;
  const brand = c.brand;

  return (
    <Svg width={size} height={(size * 160) / 200} viewBox="0 0 200 160">
      {/* Cuerpo del candado */}
      <Rect
        x="60"
        y="68"
        width="80"
        height="72"
        rx="6"
        fill="none"
        stroke={ink}
        strokeWidth={3}
      />
      {/* Shackle (arco superior) */}
      <Path
        d="M76 68V52a24 24 0 0 1 48 0v16"
        stroke={ink}
        strokeWidth={3}
        fill="none"
      />
      {/* Triángulo trasero — verde brand. */}
      <Polygon
        points="92,98 80,124 108,124"
        stroke={brand}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill="none"
      />
      {/* Triángulo delantero — ink, overlap clásico del isotipo. */}
      <Polygon
        points="108,90 96,124 124,124"
        stroke={ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
