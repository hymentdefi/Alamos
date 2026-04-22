import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  /** SVG path d attribute (sobre el viewBox dado). */
  path: string;
  focused: boolean;
  color: string;
  size?: number;
  viewBox?: string;
  /** Duración del drawing en ms. */
  duration?: number;
}

/**
 * Ícono de tab que se "dibuja solo" con animación de stroke cuando se
 * activa — estilo Binance. El path se recorre como si una pluma lo
 * escribiera, en `duration` ms, con haptic al arrancar.
 *
 * - Inactivo: path completo visible en `color` (el tabBarInactiveTintColor)
 * - Activo: el path se redraw animando strokeDashoffset de 1 a 0
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 480,
}: Props) {
  // offset 1 = path invisible, 0 = path visible
  const offset = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (focused) {
      Haptics.selectionAsync().catch(() => {});
      offset.setValue(1);
      Animated.timing(offset, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start();
    } else {
      offset.setValue(0);
    }
  }, [focused, duration, offset]);

  return (
    <View style={s.wrap}>
      <Svg width={size} height={size} viewBox={viewBox}>
        <AnimatedPath
          d={path}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1"
          strokeDashoffset={offset}
          {...({ pathLength: 1 } as object)}
        />
      </Svg>
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

/* ─── Paths SVG para las tabs ───
 * Uso paths estilo Lucide (fork open source de Feather).
 * viewBox estándar 0 0 24 24.
 * Cada path está pensado para dibujarse de forma "natural" (línea
 * continua siempre que es posible).
 */
export const tabPaths = {
  home: "M4 21 V10 L12 3 L20 10 V21 H15 V14 H9 V21 Z",
  markets: "M3 21 V4 M3 21 H21 M7 17 V13 M12 17 V9 M17 17 V11 M21 17 V7",
  news: "M5 4 H18 V20 H5 Z M5 4 V20 A2 2 0 0 1 3 18 V11 H5 M8 8 H15 M8 12 H15 M8 16 H12",
  profile: "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 Z M4 21 V20 A6 6 0 0 1 10 14 H14 A6 6 0 0 1 20 20 V21",
} as const;
