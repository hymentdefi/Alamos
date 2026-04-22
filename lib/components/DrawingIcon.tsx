import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";

interface Props {
  path: string;
  focused: boolean;
  color: string;
  size?: number;
  viewBox?: string;
  /** Duración del drawing en ms. */
  duration?: number;
}

/** Dash length fijo — mayor que cualquier path en viewBox 24x24. */
const DASH_LEN = 220;

/**
 * Ícono de tab que se dibuja al activarse — estilo Binance.
 * Bypassea Animated.Value para el SVG (que tiene bugs con strokeDashoffset
 * en algunas versiones de react-native-svg). Usa requestAnimationFrame
 * directo para drivear el draw via setState, y Animated nativo para la
 * escala (transform, siempre funciona).
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 460,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [dashOffset, setDashOffset] = useState(focused ? 0 : 0);

  useEffect(() => {
    if (!focused) {
      setDashOffset(0);
      return;
    }

    Haptics.selectionAsync().catch(() => {});

    // Scale pop (native driver, transform — siempre funciona)
    scale.setValue(0.4);
    Animated.spring(scale, {
      toValue: 1,
      tension: 140,
      friction: 5,
      useNativeDriver: true,
    }).start();

    // Drawing via RAF loop — no depende de Animated/SVG interop
    setDashOffset(DASH_LEN);
    let start: number | null = null;
    let raf: number;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDashOffset((1 - eased) * DASH_LEN);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDashOffset(0);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [focused, duration, scale]);

  return (
    <View style={s.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path
            d={path}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${DASH_LEN} ${DASH_LEN}`}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: 44,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

/* ─── Paths SVG para las tabs ─── */
export const tabPaths = {
  home: "M4 21 V10 L12 3 L20 10 V21 H15 V14 H9 V21 Z",
  markets: "M3 21 V4 M3 21 H21 M7 17 V13 M12 17 V9 M17 17 V11 M21 17 V7",
  news: "M5 4 H18 V20 H5 Z M5 4 V20 A2 2 0 0 1 3 18 V11 H5 M8 8 H15 M8 12 H15 M8 16 H12",
  profile: "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 Z M4 21 V20 A6 6 0 0 1 10 14 H14 A6 6 0 0 1 20 20 V21",
} as const;
