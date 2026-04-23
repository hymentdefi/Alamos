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
/** Color del marcador arriba del icono cuando está activa la tab. */
const MARKER_COLOR = "#5ac43e";

/**
 * Ícono de tab que se dibuja al activarse + un pill verde arriba
 * que marca la tab activa. Haptic + scale-pop en cada cambio.
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
  const markerScale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const markerOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const [dashOffset, setDashOffset] = useState(0);
  const prevFocused = useRef(focused);

  useEffect(() => {
    const wasFocused = prevFocused.current;
    prevFocused.current = focused;

    // Sin foco: reset firme + marker out.
    if (!focused) {
      scale.stopAnimation(() => scale.setValue(1));
      setDashOffset(0);
      Animated.parallel([
        Animated.timing(markerOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(markerScale, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    // Ya estaba enfocado (re-render, vuelta de subpantalla): asegurar
    // estado dibujado + marker visible sin re-animar.
    if (wasFocused) {
      scale.stopAnimation(() => scale.setValue(1));
      setDashOffset(0);
      markerOpacity.setValue(1);
      markerScale.setValue(1);
      return;
    }

    Haptics.selectionAsync().catch(() => {});

    // Scale pop del ícono (spring).
    scale.setValue(0.4);
    const iconSpring = Animated.spring(scale, {
      toValue: 1,
      tension: 140,
      friction: 5,
      useNativeDriver: true,
    });
    iconSpring.start();

    // Marker fade + grow desde el centro.
    markerOpacity.setValue(0);
    markerScale.setValue(0.2);
    const markerAnim = Animated.parallel([
      Animated.timing(markerOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(markerScale, {
        toValue: 1,
        tension: 160,
        friction: 8,
        useNativeDriver: true,
      }),
    ]);
    markerAnim.start();

    // Drawing via RAF loop — no depende de Animated/SVG interop.
    setDashOffset(DASH_LEN);
    let start: number | null = null;
    let raf: number;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start;
      const progress = Math.min(1, elapsed / duration);
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
      iconSpring.stop();
      markerAnim.stop();
      scale.setValue(1);
    };
  }, [focused, duration, scale, markerScale, markerOpacity]);

  return (
    <View style={s.wrap}>
      <Animated.View
        style={[
          s.marker,
          {
            backgroundColor: MARKER_COLOR,
            opacity: markerOpacity,
            transform: [{ scaleX: markerScale }],
          },
        ]}
      />
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
    width: 52,
    height: 42,
    alignItems: "center",
    // Sin padding top: el marker toca el borde del island.
    paddingTop: 0,
    gap: 7,
  },
  marker: {
    width: 26,
    height: 3.5,
    borderRadius: 2,
  },
});

/* ─── Paths SVG para las tabs ─── */
export const tabPaths = {
  home: "M4 21 V10 L12 3 L20 10 V21 H15 V14 H9 V21 Z",
  markets: "M3 21 V4 M3 21 H21 M7 17 V13 M12 17 V9 M17 17 V11 M21 17 V7",
  news: "M5 4 H18 V20 H5 Z M5 4 V20 A2 2 0 0 1 3 18 V11 H5 M8 8 H15 M8 12 H15 M8 16 H12",
  profile: "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 Z M4 21 V20 A6 6 0 0 1 10 14 H14 A6 6 0 0 1 20 20 V21",
  /** Chat bubble with a tail pointing to bottom-left + three dots inside */
  support:
    "M5 4 H19 A2 2 0 0 1 21 6 V15 A2 2 0 0 1 19 17 H12 L7 21 V17 H5 A2 2 0 0 1 3 15 V6 A2 2 0 0 1 5 4 Z M8 10 H9 M12 10 H13 M16 10 H17",
} as const;
