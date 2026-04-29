import { StyleSheet, View, type ViewStyle, type StyleProp } from "react-native";
import Svg, { Polygon } from "react-native-svg";

interface Props {
  /** Tamaño del watermark — ancho del SVG. Default 240. */
  size?: number;
  /** Color del triángulo verde (atrás). Default brand green. */
  greenColor?: string;
  /** Color del triángulo oscuro (adelante). Default ink. */
  darkColor?: string;
  /** Opacidad del watermark. Default 0.08 (sutil). */
  opacity?: number;
  /** Stroke width — escala con size. Default `size * 0.022`. */
  strokeWidth?: number;
  /** Posicionamiento absoluto sobre el padre. Default true (watermark
   *  detrás del contenido). */
  absolute?: boolean;
  /** Override de estilo para ajustar bottom/right/etc. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Marca de agua de los dos triángulos del isotipo Alamos. Pensado para
 * vestir heroes y cards con identidad de marca sin dominar la
 * jerarquía visual (opacity baja por default).
 *
 * Geometría espejo del isotipo oficial — viewBox 0 0 100 100, mismos
 * `points` que el brand-kit. Si querés dos triángulos llenos en lugar
 * de outline, pasá strokeWidth=0 y un fill via greenColor/darkColor
 * (esto último no está expuesto, requiere editar el componente).
 */
export function TrianglesWatermark({
  size = 240,
  greenColor = "#00E676",
  darkColor = "#0E0F0C",
  opacity = 0.08,
  strokeWidth,
  absolute = true,
  style,
}: Props) {
  const sw = strokeWidth ?? size * 0.022;
  const containerStyle = absolute ? s.absolute : undefined;

  return (
    <View
      pointerEvents="none"
      style={[
        containerStyle,
        { width: size, height: size, opacity },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Triángulo trasero — verde, centrado en x=38, ancho 44, alto 60. */}
        <Polygon
          points="38,26 16,86 60,86"
          stroke={greenColor}
          strokeWidth={sw}
          strokeLinejoin="round"
          fill="none"
        />
        {/* Triángulo delantero — oscuro, centrado en x=56, ancho 54, alto 74. */}
        <Polygon
          points="56,12 29,86 83,86"
          stroke={darkColor}
          strokeWidth={sw}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  absolute: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
});
