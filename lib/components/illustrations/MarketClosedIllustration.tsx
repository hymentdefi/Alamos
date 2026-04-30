import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Rect,
} from "react-native-svg";
import { useTheme } from "../../theme";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 180. */
  size?: number;
}

/**
 * Ilustración "Mercado cerrado" — estilo brand-kit/14-illustrations:
 * geometría limpia, line-style, monocromática + verde brand de
 * acento. Nada de stock art ni sobrediseño.
 *
 * Composición:
 *   - Los dos triángulos del isotipo Alamos (geometría oficial: back
 *     centrado en x=38 ancho 44 alto 60, front en x=56 ancho 54 alto
 *     74) renderizados en outline gris muted — "logo apagado"
 *     visualmente, comunica "fuera de servicio".
 *   - Un candado pequeño centrado entre los triángulos, en verde
 *     brand. Lock body redondeado + shackle (arco) arriba.
 *   - Línea horizontal sutil debajo, tipo "horizonte cerrado".
 *
 * Sin sombras, sin gradientes, sin texto. La tipografía vive en el
 * sheet padre.
 */
export function MarketClosedIllustration({ size = 180 }: Props) {
  const { c } = useTheme();
  // Outline para los triángulos — gris apagado para "logo cerrado".
  const triStroke = c.borderStrong;
  const lockColor = c.brand;
  const subtle = c.border;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Línea de horizonte sutil — ancla la composición y evoca un
          chart "plano" (sin movimiento, mercado cerrado). */}
      <Line
        x1="14"
        y1="86"
        x2="86"
        y2="86"
        stroke={subtle}
        strokeWidth={1.6}
        strokeLinecap="round"
      />

      {/* Triángulo trasero — outline grueso, gris muted. Geometría
          oficial del isotipo (ver brand-assets/README.md). */}
      <Polygon
        points="38,28 17,82 59,82"
        stroke={triStroke}
        strokeWidth={4.5}
        strokeLinejoin="round"
        fill="none"
        opacity={0.45}
      />
      {/* Triángulo delantero — overlap clásico del logo. */}
      <Polygon
        points="56,16 30,82 82,82"
        stroke={triStroke}
        strokeWidth={4.5}
        strokeLinejoin="round"
        fill="none"
        opacity={0.55}
      />

      {/* Candado centrado entre los triángulos. La altura del candado
          ocupa ~22 unidades del viewBox (del 50 al 72). */}
      <G>
        {/* Shackle (arco superior). Path semicircular tipo candado
            cerrado — los dos extremos bajan al cuerpo. */}
        <Path
          d="M44 54 L44 50 A6 6 0 0 1 56 50 L56 54"
          stroke={lockColor}
          strokeWidth={2.6}
          fill="none"
          strokeLinecap="round"
        />
        {/* Cuerpo — rectángulo redondeado verde brand sólido. */}
        <Rect
          x="40"
          y="54"
          width="20"
          height="16"
          rx="3"
          fill={lockColor}
        />
        {/* Hueco de la cerradura — pequeño círculo blanco al centro
            del cuerpo, indica claramente "candado". */}
        <Circle cx="50" cy="62" r="1.6" fill="#FFFFFF" />
        <Line
          x1="50"
          y1="62"
          x2="50"
          y2="65.5"
          stroke="#FFFFFF"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}
