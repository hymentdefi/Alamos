import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface TabPath {
  d: string;
  /** Legacy, ya no se usa. Queda en el tipo por compat. */
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
 * Icono de tab con reveal left-to-right al activarse.
 *
 * Este componente asume que está renderizado en un árbol de React
 * VANILLA (no dentro del tabBarIcon de @react-navigation/bottom-tabs,
 * que tiene un double-render que congela focused). Ver
 * app/(app)/(tabs)/_layout.tsx — la barra vive como sibling de <Tabs>
 * y consume usePathname() directo.
 *
 * Tres shared values independientes:
 *   - reveal (0→1): ancho de la mask que revela el icono.
 *   - markerActive (0→1): opacity + scaleX del marker verde de arriba.
 *   - pop: scale del icono (spring pop al activarse).
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 520,
}: Props) {
  // reveal: 0 = icono oculto (mask vacío), 1 = icono completo.
  // Al mount inicializamos según focused:
  //   - focused=true  → arrancamos en 0 para que useEffect lo anime a 1.
  //   - focused=false → arrancamos en 1 (icono ya visible, sin anim).
  const reveal = useSharedValue(focused ? 0 : 1);
  const markerActive = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(focused ? 1 : 0.92);

  useEffect(() => {
    if (focused) {
      // withSequence: primero ASEGURA que el valor está en 0 (si
      // venimos de un ciclo previo de reveal quedaba en 1), después
      // anima a 1. Sin withSequence, los dos assignments sueltos
      // pueden carrear con el withTiming leyendo el startValue
      // anterior.
      reveal.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      // Saliendo de focused: el icono queda dibujado, sin animación de
      // wipe-out. El cambio visual del estado inactivo viene por el
      // color prop + markerActive fadeando a 0.
      reveal.value = 1;
    }
    markerActive.value = withTiming(focused ? 1 : 0, {
      duration: focused ? 280 : 180,
      easing: Easing.out(Easing.cubic),
    });
    pop.value = withSpring(focused ? 1 : 0.92, {
      damping: 12,
      stiffness: 180,
    });
  }, [focused, duration, reveal, markerActive, pop]);

  const iconScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  const maskStyle = useAnimatedStyle(() => ({
    width: reveal.value * size,
  }));
  const markerStyle = useAnimatedStyle(() => ({
    opacity: markerActive.value,
    transform: [{ scaleX: markerActive.value }],
  }));

  return (
    <View style={s.wrap}>
      <Animated.View
        style={[s.marker, { backgroundColor: MARKER_COLOR }, markerStyle]}
      />
      <Animated.View style={iconScaleStyle}>
        <MaskedView
          style={{ width: size, height: size }}
          maskElement={
            <View style={{ width: size, height: size, flexDirection: "row" }}>
              <Animated.View
                style={[{ height: size, backgroundColor: "black" }, maskStyle]}
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
