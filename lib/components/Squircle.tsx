import { type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SquircleView } from "react-native-figma-squircle";

interface Props {
  /** Radio del squircle. Para esquinas distintas usar `cornerRadii`. */
  radius?: number;
  /** Override por esquina — útil para sheets (top-only) o cards medio-cortadas. */
  cornerRadii?: {
    topLeft?: number;
    topRight?: number;
    bottomLeft?: number;
    bottomRight?: number;
  };
  /** Color de relleno del squircle. Reemplaza `backgroundColor`. */
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  /** 0..1 — qué tan suave la transición. Figma usa 0.6 por default. */
  smoothing?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Wrapper de continuous-corner (squircle) cross-platform basado en
 * `react-native-figma-squircle`. Renderiza el fondo como un path SVG
 * con la curva tipo Figma/iOS — se ve igual en iOS y en Android.
 *
 * Cuándo usar este componente vs `borderCurve: "continuous"`:
 *   - `borderCurve: "continuous"` en un `<View>` normal — para todo lo
 *     "no-hero" (chips, badges, tiles, inputs, listitems). En iOS toma
 *     el squircle nativo gratis; en Android queda como border-radius
 *     común. Cero overhead.
 *   - `<Squircle>` — para hero components (Button principal, Card
 *     destacada) donde queremos consistencia squircle también en
 *     Android. Usa SVG, así que tiene un costo de render.
 *
 * Limitaciones:
 *   - Los bounds del wrapper son rectangulares — la sombra nativa
 *     (`shadowOffset`/`elevation`) y el ripple de Android siguen el
 *     rect, no el squircle.
 *   - Los children NO se clipean al squircle — si un child overflow,
 *     se sale por la esquina. Para clipear, ponerle `overflow: "hidden"`
 *     y un `borderRadius` aproximado al wrapper exterior.
 */
export function Squircle({
  radius = 16,
  cornerRadii,
  backgroundColor = "transparent",
  borderColor,
  borderWidth,
  smoothing = 0.6,
  style,
  children,
}: Props) {
  return (
    <View style={style}>
      <SquircleView
        style={StyleSheet.absoluteFill}
        squircleParams={{
          cornerRadius: cornerRadii ? undefined : radius,
          topLeftCornerRadius: cornerRadii?.topLeft,
          topRightCornerRadius: cornerRadii?.topRight,
          bottomLeftCornerRadius: cornerRadii?.bottomLeft,
          bottomRightCornerRadius: cornerRadii?.bottomRight,
          cornerSmoothing: smoothing,
          fillColor: backgroundColor,
          strokeColor: borderColor,
          strokeWidth: borderWidth,
        }}
      />
      {children}
    </View>
  );
}
