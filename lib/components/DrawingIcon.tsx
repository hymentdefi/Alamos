import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface TabPath {
  d: string;
  /** Largo total del trazo en unidades del viewBox (24x24). Con un
   *  poco de overshoot para que el trazo llegue completo siempre. */
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

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Icono de tab que SE DIBUJA trazo a trazo (efecto lápiz) cada vez
 * que el tab se activa.
 *
 * Técnica: strokeDasharray = path.len + strokeDashoffset animado
 * desde path.len (trazo invisible, offseteado fuera) hasta 0 (trazo
 * completo). Al animar el offset con Animated.timing en el thread de
 * JS (useNativeDriver:false), el Path de react-native-svg redibuja
 * frame a frame y se ve el trazo "creciendo" siguiendo el contorno.
 *
 * Nota histórica: antes habíamos descartado este approach pensando
 * que react-native-svg no propagaba updates de Animated.Value al
 * Path nativo después del primer render. Ese diagnóstico estaba
 * contaminado por otro bug (MaskedView congelándose en Fabric). Con
 * la arquitectura actual (FloatingTabBar propio fuera del tabBar de
 * react-navigation + Animated API core) este approach funciona en
 * cada tap.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  // Velocidad del lápiz constante: ~10ms por unidad de path. Si no lo
  // hacíamos proporcional, paths largos como news (108) se dibujaban
  // casi 2x más rápido que alamo (56) con el mismo duration fijo — y
  // además los subpaths cortos (las 3 rayitas de news, los 4 palitos
  // de markets) se flasheaban en ~45-100ms cada uno. Ahora todos
  // trazan al mismo ritmo visual.
  duration = Math.max(500, path.len * 10),
}: Props) {
  // dashOffset: path.len = trazo invisible, 0 = trazo completo.
  const dashOffset = useRef(
    new Animated.Value(focused ? path.len : 0),
  ).current;
  const markerActive = useRef(
    new Animated.Value(focused ? 1 : 0),
  ).current;
  const pop = useRef(new Animated.Value(focused ? 1 : 0.92)).current;

  useEffect(() => {
    if (focused) {
      // Reset invisible, después animamos a 0 (trazo revelado).
      dashOffset.setValue(path.len);
      Animated.timing(dashOffset, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // strokeDashoffset no soporta native driver
      }).start();
    } else {
      // Tab inactiva: trazo completo, sin drama.
      dashOffset.setValue(0);
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
  }, [focused, duration, path.len, dashOffset, markerActive, pop]);

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
        <Svg width={size} height={size} viewBox={viewBox}>
          <AnimatedPath
            d={path.d}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={path.len}
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
