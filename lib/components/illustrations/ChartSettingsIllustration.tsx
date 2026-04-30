import Svg, {
  Circle,
  Path,
  Polygon,
} from "react-native-svg";
import { useTheme } from "../../theme";

interface Props {
  /** Ancho del SVG. Default 220 (matchea el viewBox del brand-kit
   *  /14-illustrations/finanzas-data). */
  size?: number;
}

/**
 * Ilustración "Ajustes del chart" — copia el lenguaje de
 * brand-kit/14-illustrations sección "Finanzas & data" (línea de
 * chart subiendo + dot al final) y le suma un sello con los dos
 * triángulos del isotipo Álamos en la esquina inferior izquierda.
 *
 * Geometría brand-kit:
 *   - Path d="M20 130 L60 90 L100 110 L140 60 L180 80 L200 30"
 *   - Stroke ink, strokeWidth 3, linecap/linejoin round
 *   - Dot final verde brand
 *   - Triángulos: outline 2.5, mismo overlap del isotipo oficial
 */
export function ChartSettingsIllustration({ size = 220 }: Props) {
  const { c } = useTheme();
  const ink = c.text;
  const brand = c.brand;

  const aspect = 160 / 220;
  return (
    <Svg
      width={size}
      height={size * aspect}
      viewBox="0 0 220 160"
    >
      {/* Línea base sutil — un horizonte. */}
      <Path
        d="M14 144 L206 144"
        stroke={c.border}
        strokeWidth={1}
        strokeLinecap="round"
      />

      {/* Línea de chart subiendo — geometría exacta del brand-kit. */}
      <Path
        d="M20 130 L60 90 L100 110 L140 60 L180 80 L200 30"
        stroke={ink}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dot final verde brand — marca el "ahora" del chart. */}
      <Circle cx="200" cy="30" r="5" fill={brand} />

      {/* Sello del isotipo Álamos abajo-izquierda — dos triángulos
          chiquitos overlapped. Identidad de marca sin dominar. */}
      <Polygon
        points="32,150 22,158 42,158"
        stroke={brand}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      <Polygon
        points="42,146 30,158 54,158"
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
