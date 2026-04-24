import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Path } from "react-native-svg";

interface TabPath {
  d: string;
  /** Legacy, no se usa. Queda por compat. */
  len: number;
}

interface Props {
  path: TabPath;
  focused: boolean;
  color: string;
  size?: number;
  viewBox?: string;
  duration?: number;
}

const MARKER_COLOR = "#5ac43e";

/**
 * Icono de tab con reveal al activarse.
 *
 * Usamos la Animated API CORE de React Native (no Reanimated).
 * Rationale: Reanimated 4 + Expo Go SDK 54 + react-native-svg tiró
 * errores raros de propagación que no pudimos diagnosticar del todo.
 * La Animated core API viene con React Native mismo, sin plugins de
 * babel ni worklets ni new-arch hooks — si React Native corre, esto
 * corre.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 520,
}: Props) {
  // Inicializamos según focused para que el mount inicial arranque en
  // el estado correcto sin flicker.
  const reveal = useRef(new Animated.Value(focused ? 1 : 1)).current;
  const markerActive = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(focused ? 1 : 0.92)).current;

  useEffect(() => {
    if (focused) {
      // Reset invisible, después reveal a 1.
      reveal.setValue(0);
      Animated.timing(reveal, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // width no es nativeDriver-friendly
      }).start();
    } else {
      // Saliendo: el icono queda dibujado, sin wipe-out.
      reveal.setValue(1);
    }
    Animated.timing(markerActive, {
      toValue: focused ? 1 : 0,
      duration: focused ? 280 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.spring(pop, {
      toValue: focused ? 1 : 0.92,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [focused, duration, reveal, markerActive, pop]);

  const revealWidth = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, size],
  });

  return (
    <View style={s.wrap}>
      <Animated.View
        style={[
          s.marker,
          {
            backgroundColor: MARKER_COLOR,
            opacity: markerActive,
            transform: [{ scaleX: markerActive }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <MaskedView
          style={{ width: size, height: size }}
          maskElement={
            <View style={{ width: size, height: size, flexDirection: "row" }}>
              <Animated.View
                style={{
                  height: size,
                  width: revealWidth,
                  backgroundColor: "black",
                }}
              />
            </View>
          }
        >
          <Svg width={size} height={size} viewBox={viewBox}>
            <Path
              d={path.d}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </MaskedView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: 52,
    height: 42,
    alignItems: "center",
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
  home: {
    d: "M4 21 V10 L12 3 L20 10 V21 H15 V14 H9 V21 Z",
    len: 76,
  },
  markets: {
    d: "M3 21 V4 M3 21 H21 M7 17 V13 M12 17 V9 M17 17 V11 M21 17 V7",
    len: 65,
  },
  news: {
    d: "M5 4 H18 V20 H5 Z M5 4 V20 A2 2 0 0 1 3 18 V11 H5 M8 8 H15 M8 12 H15 M8 16 H12",
    len: 108,
  },
  profile: {
    d: "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 Z M4 21 V20 A6 6 0 0 1 10 14 H14 A6 6 0 0 1 20 20 V21",
    len: 52,
  },
  support: {
    d: "M5 4 H19 A2 2 0 0 1 21 6 V15 A2 2 0 0 1 19 17 H12 L7 21 V17 H5 A2 2 0 0 1 3 15 V6 A2 2 0 0 1 5 4 Z M8 10 H9 M12 10 H13 M16 10 H17",
    len: 70,
  },
  alamo: {
    d: "M12 2 L6 20 L11 20 L11 22 L13 22 L13 20 L18 20 Z",
    len: 56,
  },
} as const satisfies Record<string, TabPath>;
