import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface TabPath {
  /** SVG `d` del icono. */
  d: string;
  /**
   * Largo total del trazo en unidades del viewBox (24x24). Precomputado
   * porque react-native-svg no expone getTotalLength(). Con un poquito
   * de overshoot para que el trazo llegue completo siempre.
   */
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
 * Icono de tab con dibujado real del SVG — el trazo se traza de punta
 * a punta como si lo hiciera una mano.
 *
 * Historia de este componente (para que no vuelva a romperse):
 *
 * Intento 1: overlay 'cortina' con translateX (Animated native driver).
 *            Funcionaba al montar pero el overlay nunca matcheaba el
 *            color del island, se veía sucio.
 * Intento 2: Animated.createAnimatedComponent(Path) + strokeDashoffset
 *            con useNativeDriver:false. Funcionaba la primera vez pero
 *            react-native-svg no propaga los updates del Animated.Value
 *            al Path nativo después del primer ciclo, el trazo quedaba
 *            congelado.
 * Intento 3: setState + requestAnimationFrame driveando el offset. En
 *            teoría bulletproof pero en la práctica setState 60×s sobre
 *            un componente dentro del tabBar no re-renderizaba el Path,
 *            aparentemente React Navigation memoriza el output de
 *            tabBarIcon y los updates no llegaban.
 *
 * Intento 4 (este, y funciona): Reanimated. useSharedValue + worklets
 * corren en el UI thread, no dependen de React reconciliation ni de
 * que el tab bar re-renderice. Cambiamos el value → Reanimated propaga
 * directamente al native Path a través de useAnimatedProps. Anima
 * siempre, en cada cambio de tab, sin depender de keys ni remounts.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 720,
}: Props) {
  // dashOffset: de path.len (invisible) a 0 (trazo completo).
  const dashOffset = useSharedValue(focused ? path.len : 0);
  // Pop del icono al entrar.
  const scale = useSharedValue(focused ? 0.8 : 1);
  // Marker verde arriba del icono (el dotito/barrita que indica activa).
  const markerOpacity = useSharedValue(focused ? 0 : 0);
  const markerScaleX = useSharedValue(focused ? 0 : 0);

  useEffect(() => {
    if (focused) {
      // Reseteamos el dashOffset al largo completo (trazo invisible)
      // y después animamos a 0 (trazo revelado). Reanimated nota el
      // cambio inmediato y lo aplica antes de la animación, así que el
      // trazo arranca realmente invisible aunque vengamos de un estado
      // previo en que era visible.
      dashOffset.value = path.len;
      dashOffset.value = withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      scale.value = 0.8;
      scale.value = withSpring(1, { damping: 12, stiffness: 160 });
      markerOpacity.value = 0;
      markerOpacity.value = withTiming(1, { duration: 260 });
      markerScaleX.value = 0;
      markerScaleX.value = withSpring(1, { damping: 10, stiffness: 140 });
    } else {
      // Tab inactiva: icono completo, marker oculto, sin drama.
      dashOffset.value = 0;
      scale.value = withTiming(1, { duration: 120 });
      markerOpacity.value = withTiming(0, { duration: 160 });
      markerScaleX.value = withTiming(0, { duration: 180 });
    }
  }, [focused, path.len, duration, dashOffset, scale, markerOpacity, markerScaleX]);

  const pathAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const markerStyle = useAnimatedStyle(() => ({
    opacity: markerOpacity.value,
    transform: [{ scaleX: markerScaleX.value }],
  }));

  return (
    <View style={s.wrap}>
      <Animated.View
        style={[s.marker, { backgroundColor: MARKER_COLOR }, markerStyle]}
      />
      <Animated.View style={iconStyle}>
        <Svg width={size} height={size} viewBox={viewBox}>
          <AnimatedPath
            d={path.d}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={path.len}
            animatedProps={pathAnimatedProps}
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
