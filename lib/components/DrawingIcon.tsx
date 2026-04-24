import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface TabPath {
  /** SVG `d` del icono. */
  d: string;
  /**
   * Largo total del trazo en unidades del viewBox (24x24). Precomputado
   * acá porque react-native-svg no expone getTotalLength() — y hardcodear
   * es más barato que calcular en cada mount.
   */
  len: number;
}

interface Props {
  path: TabPath;
  focused: boolean;
  color: string;
  size?: number;
  viewBox?: string;
  /** Duración del trazo en ms. */
  duration?: number;
}

const MARKER_COLOR = "#5ac43e";

/**
 * Ícono de tab con dibujado real del SVG: el trazo se traza de punta
 * a punta, como si lo estuviera haciendo una mano.
 *
 * ¿Por qué setState + RAF en vez de Animated.Value + AnimatedPath?
 *
 * Probé el approach 'correcto' con Animated.createAnimatedComponent(Path)
 * + useNativeDriver:false. La animación del trazo funcionaba la PRIMERA
 * vez (al montar la app en Home), pero NO volvía a dispararse al
 * cambiar de tab. Parece un bug conocido de react-native-svg 15: el
 * AnimatedPath no re-bindea el nuevo valor cuando el Animated.Value
 * cambia a base de setValue/timing después del primer ciclo.
 *
 * La solución confiable: manejar el dashOffset como un state de React
 * y actualizarlo desde un requestAnimationFrame loop. Cada frame es un
 * setState → re-render del Path. React Native redibuja el stroke, y
 * el trazo se anima como se debe, SIEMPRE, en cada cambio de tab.
 *
 * Scale del icono y marker verde siguen en Animated con native driver
 * — transforms y opacity sí funcionan con setValue repetidos.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 720,
}: Props) {
  // Offset driven por setState — garantiza que Path re-renderice.
  // Si focused arranca en true, partimos con offset=pathLen (invisible)
  // así el useEffect puede tracear. Si arranca en false, offset=0
  // (visible) para que el icono esté ahí quieto.
  const [offset, setOffset] = useState(focused ? path.len : 0);

  const scale = useRef(new Animated.Value(focused ? 0.8 : 1)).current;
  const markerOpacity = useRef(
    new Animated.Value(focused ? 0 : 0),
  ).current;
  const markerScale = useRef(new Animated.Value(focused ? 0 : 0)).current;

  useEffect(() => {
    if (!focused) {
      setOffset(0);
      scale.stopAnimation(() => scale.setValue(1));
      markerOpacity.stopAnimation(() => markerOpacity.setValue(0));
      markerScale.stopAnimation(() => markerScale.setValue(0));
      return;
    }

    // Arranque limpio.
    setOffset(path.len);
    scale.setValue(0.8);
    markerOpacity.setValue(0);
    markerScale.setValue(0);

    // Loop RAF que va bajando el offset de pathLen a 0 con ease-out
    // cubic — arranca rápido, frena al final, como un trazo humano.
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setOffset(path.len * (1 - eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    // Pop del icono + marker en native driver.
    const pop = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 130,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(markerOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(markerScale, {
        toValue: 1,
        tension: 95,
        friction: 7,
        useNativeDriver: true,
      }),
    ]);
    pop.start();

    return () => {
      cancelAnimationFrame(raf);
      pop.stop();
    };
  }, [focused, path.len, duration, scale, markerOpacity, markerScale]);

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
            d={path.d}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={path.len}
            strokeDashoffset={offset}
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
// Los `len` son la suma de los largos de todos los segmentos del path
// en el viewBox 24x24. Calculados a mano (sum de L/H/V + aprox de arcs).
// Un pelito de overshoot (+2) para que el trazo llegue completo en
// todos los casos sin depender de error numérico.
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
