import { useEffect, useRef, useState } from "react";
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
  style?: StyleProp<ViewStyle>;
  /** Si true, al montar cuenta desde 0 hasta value con ease-out (~800ms). */
  animateOnMount?: boolean;
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
  style,
  animateOnMount = false,
}: Props) {
  const { c } = useTheme();
  const [animating, setAnimating] = useState(animateOnMount);
  const [animValue, setAnimValue] = useState(animateOnMount ? 0 : value);
  const targetRef = useRef(value);
  targetRef.current = value;

  useEffect(() => {
    if (!animateOnMount) return;
    const start = Date.now();
    const from = 0;
    const DURATION = 800;
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimValue(from + (targetRef.current - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setAnimating(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animateOnMount]);

  const displayed = animating ? animValue : value;
  const parts = formatARSParts(displayed);
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
          lineHeight: size * 1.05,
          letterSpacing: -size * 0.04,
          color: txt,
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
