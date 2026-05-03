import { View, Text, type StyleProp, type ViewStyle } from "react-native";
import { fontFamily, useTheme, type FontWeight } from "../theme";
import { formatMoneyParts, type AssetCurrency } from "../data/assets";
import { usePrivacy } from "../privacy/context";

interface Props {
  value: number;
  /** Tamaño de la parte entera en px. Los decimales se escalan ~38%. */
  size: number;
  color?: string;
  /** Color de los decimales y del ticker suffix. Si no se pasa, se
   *  usa textMuted. */
  decimalsColor?: string;
  weight?: FontWeight;
  /** Multiplicador vertical del entero — útil para 'estirar' el monto
   * hacia abajo y darle más presencia. Default 1 (sin stretch). */
  stretchY?: number;
  /** Moneda a renderear. ARS pinta el "$" antes; USD/USDT pintan el
   *  ticker después de los decimales. Default ARS. */
  currency?: AssetCurrency;
  /** Override custom del prefix (legacy). Si pasás esto, gana sobre
   *  lo que dictaría `currency`. Útil para cosas tipo "+ $", "-$".
   *  Si no pasás ni este ni `currency`, default a "$" (ARS). */
  prefix?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Balance con centavos chiquitos arriba a la derecha (estilo Robinhood).
 *
 * Convención de moneda (toda la app usa esto, ver formatMoneyParts):
 *   - ARS: "$ 1.284.620" grande + ",50" chiquito pegado arriba
 *   - USD: "850" grande + ",00 USD" chiquito al costado
 *   - USDT: "580" grande + ",00 USDT" chiquito al costado
 *
 * El "USD"/"USDT" usa el mismo estilo (size + color) que los decimales,
 * para que se lea como un detalle subordinado al monto principal.
 */
export function AmountDisplay({
  value,
  size,
  color,
  decimalsColor,
  weight = 700,
  stretchY = 1,
  currency = "ARS",
  prefix,
  style,
}: Props) {
  const { c } = useTheme();
  const { hideAmounts } = usePrivacy();
  const parts = formatMoneyParts(value, currency);

  // Override legacy: si llegó `prefix` explícito, lo usamos como
  // sign forzado y no rendereamos suffix (incluso si la currency lo
  // sugería). Esto preserva uses como `<AmountDisplay prefix="+" />`.
  const sign = prefix ?? parts.prefix;
  const suffix = prefix ? undefined : parts.suffix;

  const txt = color ?? c.text;
  const dec = decimalsColor ?? c.textMuted;
  const decSize = Math.max(12, Math.round(size * 0.38));
  const decMargin = Math.round(size * 0.14);

  // Privacy mode: reemplaza dígitos por • preservando separadores.
  const integerDisplay = hideAmounts
    ? parts.integer.replace(/\d/g, "•")
    : parts.integer;
  const decimalsDisplay = hideAmounts
    ? parts.decimals.replace(/\d/g, "•")
    : parts.decimals;

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
        {sign ? `${sign} ` : ""}
        {integerDisplay}
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
        ,{decimalsDisplay}
        {suffix ? ` ${suffix}` : ""}
      </Text>
    </View>
  );
}
