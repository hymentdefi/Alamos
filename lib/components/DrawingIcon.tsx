import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Path } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface TabPath {
  /** SVG `d` del icono. */
  d: string;
  /**
   * Largo total del trazo en unidades del viewBox (24x24). Se mantiene
   * en el tipo por compat con código viejo pero ya no lo usamos para
   * animar — la técnica con strokeDashoffset no sobrevivió.
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

/**
 * Icono de tab con animación de reveal al activarse.
 *
 * Historia (que no vuelva a romperse):
 *
 * Intento 1: overlay 'cortina' con translateX (Animated native driver).
 *            El overlay nunca matcheaba el color del island por el
 *            stacking de alpha — se veía sucio.
 * Intento 2: Animated.createAnimatedComponent(Path) + strokeDashoffset
 *            con useNativeDriver:false. Animaba la primera vez y
 *            después react-native-svg dejaba de propagar updates al
 *            Path nativo — el trazo quedaba congelado.
 * Intento 3: setState + requestAnimationFrame driveando el offset.
 *            setState 60×s dentro del tabBar no re-renderizaba el
 *            Path, React Navigation parece memorizar el output de
 *            tabBarIcon.
 * Intento 4: Reanimated + dos assignments sueltos (value=len;
 *            value=withTiming(0)). Andaba solo en el primer launch
 *            porque useSharedValue ya arrancaba en path.len.
 * Intento 5: Reanimated + withSequence. Mismo síntoma — la animación
 *            corría en el UI thread pero el Path no se actualizaba
 *            visualmente.
 * Intento 6: Reanimated + withSequence + key={name-${focused}} force
 *            remount en el _layout. Misma historia: el Path nativo
 *            simplemente no acepta updates de animatedProps en este
 *            runtime, aunque lo remontes.
 *
 * Intento 7 (este, y funciona): MaskedView. Sacamos toda la animación
 * del SVG — el Path se renderiza completo y STATIC, nada animado ahí
 * adentro. La animación corre sobre un <Animated.View> común que hace
 * de mask: su width crece de 0 a size, y MaskedView muestra el icono
 * progresivamente en los píxeles donde el mask es opaco. Al no tocar
 * props de react-native-svg, esquivamos el bug de propagación. Este
 * mismo patrón (MaskedView + View animada) lo usamos ya en
 * SwipeToSubmit.tsx sin problemas.
 *
 * Nota: el efecto cambia sutilmente — antes era un "dibujo a lápiz"
 * siguiendo el path, ahora es un wipe left-to-right. Priorizamos que
 * animó de verdad en cada tap sobre el efecto pencil.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 520,
}: Props) {
  // revealWidth: de 0 (mask vacío, icono oculto) a size (mask completo,
  // icono visible).
  const revealWidth = useSharedValue(focused ? 0 : size);
  // Pop del icono al entrar.
  const scale = useSharedValue(focused ? 0.8 : 1);
  // Marker verde arriba del icono (la barrita que indica activa).
  const markerOpacity = useSharedValue(0);
  const markerScaleX = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(revealWidth);
    cancelAnimation(scale);
    cancelAnimation(markerOpacity);
    cancelAnimation(markerScaleX);

    if (focused) {
      // withSequence: primero mandamos el valor a 0 (mask vacío) en un
      // tick, después animamos al tamaño completo. Garantiza orden en
      // UI thread aunque el component no haya remontado.
      revealWidth.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(size, { duration, easing: Easing.out(Easing.cubic) }),
      );
      scale.value = withSequence(
        withTiming(0.8, { duration: 0 }),
        withSpring(1, { damping: 12, stiffness: 160 }),
      );
      markerOpacity.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 240 }),
      );
      markerScaleX.value = withSequence(
        withTiming(0, { duration: 0 }),
        withSpring(1, { damping: 10, stiffness: 140 }),
      );
    } else {
      // Tab inactiva: icono completo, marker oculto.
      revealWidth.value = size;
      scale.value = withTiming(1, { duration: 120 });
      markerOpacity.value = withTiming(0, { duration: 160 });
      markerScaleX.value = withTiming(0, { duration: 180 });
    }
  }, [focused, size, duration, revealWidth, scale, markerOpacity, markerScaleX]);

  const maskStyle = useAnimatedStyle(() => ({
    width: revealWidth.value,
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
