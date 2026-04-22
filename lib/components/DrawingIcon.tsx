import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";

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

/** Dash más grande que cualquier path en viewBox 24x24 — lo usamos para simular
 *  el drawing effect sin depender del atributo pathLength (que react-native-svg
 *  no siempre pasa bien al native renderer). */
const DASH_LEN = 200;

/**
 * Ícono de tab que se "dibuja solo" al activarse — estilo Binance.
 * Combina:
 *   - scale bounce en el Animated.View (native driver, garantizado)
 *   - strokeDashoffset via state listener (JS driver, actualiza cada frame)
 *
 * Inactivo: path completo visible en `color`
 * Activo: path se redibuja desde el comienzo + pequeño pop de escala + haptic
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 520,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const drawAnim = useRef(new Animated.Value(0)).current;
  const [dashOffset, setDashOffset] = useState(0);

  useEffect(() => {
    if (!focused) {
      setDashOffset(0);
      return;
    }

    Haptics.selectionAsync().catch(() => {});

    // Scale pop (native driver — siempre funciona)
    scale.setValue(0.55);
    Animated.spring(scale, {
      toValue: 1,
      tension: 150,
      friction: 5,
      useNativeDriver: true,
    }).start();

    // Drawing via listener
    setDashOffset(DASH_LEN);
    drawAnim.setValue(1);
    const listenerId = drawAnim.addListener(({ value }) => {
      setDashOffset(value * DASH_LEN);
    });
    Animated.timing(drawAnim, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start(() => {
      drawAnim.removeListener(listenerId);
      setDashOffset(0);
    });

    return () => {
      drawAnim.removeAllListeners();
    };
  }, [focused, duration, scale, drawAnim]);

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
