import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const AnimatedPath = Animated.createAnimatedComponent(Path);

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
 * Ícono de tab con animación combinada al activarse:
 *   · marker pill verde crece y aparece arriba
 *   · el ícono cae desde arriba (translateY) y escala desde chico con
 *     overshoot (spring bouncy)
 *   · paralelo al movimiento, el stroke se 'dibuja' via dashoffset
 *     animado
 *
 * Tres animaciones superpuestas aseguran que AL MENOS una se note
 * bien, sin depender sólo del stroke draw que en algunas versiones
 * de react-native-svg no rerenderiza suave.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 720,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const markerScale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const markerOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const dashOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!focused) {
      scale.stopAnimation(() => scale.setValue(1));
      translateY.stopAnimation(() => translateY.setValue(0));
      dashOffset.setValue(0);
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

    // Focus animation combo.
    scale.setValue(0.25);
    translateY.setValue(-8);
    const transformAnim = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 110,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 90,
        friction: 6,
        useNativeDriver: true,
      }),
    ]);

    markerOpacity.setValue(0);
    markerScale.setValue(0);
    const markerAnim = Animated.parallel([
      Animated.timing(markerOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(markerScale, {
        toValue: 1,
        tension: 90,
        friction: 7,
        useNativeDriver: true,
      }),
    ]);

    dashOffset.setValue(DASH_LEN);
    const drawAnim = Animated.timing(dashOffset, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    transformAnim.start();
    markerAnim.start();
    drawAnim.start();

    return () => {
      transformAnim.stop();
      markerAnim.stop();
      drawAnim.stop();
    };
  }, [
    focused,
    duration,
    scale,
    translateY,
    markerScale,
    markerOpacity,
    dashOffset,
  ]);

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
      <Animated.View
        style={{
          transform: [{ translateY }, { scale }],
        }}
      >
        <Svg width={size} height={size} viewBox={viewBox}>
          <AnimatedPath
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
  profile:
    "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 Z M4 21 V20 A6 6 0 0 1 10 14 H14 A6 6 0 0 1 20 20 V21",
  /** Chat bubble with a tail pointing to bottom-left + three dots inside */
  support:
    "M5 4 H19 A2 2 0 0 1 21 6 V15 A2 2 0 0 1 19 17 H12 L7 21 V17 H5 A2 2 0 0 1 3 15 V6 A2 2 0 0 1 5 4 Z M8 10 H9 M12 10 H13 M16 10 H17",
  /** Álamo stylized: tall triangular canopy + small trunk at bottom. */
  alamo: "M12 2 L6 20 L11 20 L11 22 L13 22 L13 20 L18 20 Z",
} as const;
