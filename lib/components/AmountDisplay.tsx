import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { fontFamily, useTheme, type FontWeight } from "../theme";
import { formatARSParts } from "../data/assets";

interface Props {
  value: number;
  /** Tamaño de la parte entera en px. Los decimales se escalan ~38%. */
  size: number;
  color?: string;
  /** Color de los decimales. Si no se pasa, se usa textMuted. */
  decimalsColor?: string;
  weight?: FontWeight;
  /** Multiplicador vertical del entero — útil para 'estirar' el monto
   * hacia abajo y darle más presencia. Default 1 (sin stretch). */
  stretchY?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Balance con centavos chiquitos arriba a la derecha (estilo Robinhood).
 * Ejemplo: "$ 1.284.620" grande + ",50" chiquito pegado arriba.
 */
export function AmountDisplay({
  value,
  size,
  color,
  decimalsColor,
  weight = 700,
  stretchY = 1,
  style,
}: Props) {
  const { c } = useTheme();
  const parts = formatARSParts(value);
  const txt = color ?? c.text;
  const dec = decimalsColor ?? c.textMuted;
  const decSize = Math.max(12, Math.round(size * 0.38));
  const decMargin = Math.round(size * 0.14);

  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-start" }, style]}>
      <Text
        style={{
          fontFamily: fontFamily[weight],
          fontSize: size,
          lineHeight: size * 1.05 * stretchY,
          letterSpacing: -size * 0.04,
          color: txt,
          // scaleY > 1 estira los dígitos hacia abajo. transformOrigin en
          // RN es 'center' por default, así que el texto se estira en
          // ambas direcciones — el lineHeight extra compensa para que
          // no se solape con elementos de arriba/abajo.
          transform: stretchY === 1 ? undefined : [{ scaleY: stretchY }],
        }}
      >
        {parts.sign} {parts.integer}
      </Text>
      <Text
        style={{
          fontFamily: fontFamily[weight],
          fontSize: decSize,
          lineHeight: decSize * 1.1,
          letterSpacing: -0.3,
          marginTop: decMargin,
          marginLeft: 2,
          color: dec,
        }}
      >
        ,{parts.decimals}
      </Text>
    </View>
  );
}
