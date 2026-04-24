import { StyleSheet, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface TabPath {
  /** SVG `d` del icono. */
  d: string;
  /**
   * Largo total del trazo (legacy, del approach viejo con
   * strokeDashoffset). Se mantiene en el tipo por compat con el resto
   * del código; ya no lo usamos.
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
 * Icono de tab con reveal left-to-right al activarse.
 *
 * Historia (que no vuelva a romperse):
 *
 * 1-6. Todo intento de animar strokeDashoffset sobre un react-native-
 *      svg Path falló con el mismo síntoma: anima solo en el primer
 *      mount. Probamos Animated, Reanimated, withSequence, setState+
 *      RAF, key-based remount... nada. TL;DR: react-native-svg no
 *      propaga updates de animated props al Path nativo después del
 *      primer render.
 *
 * 7. Pasamos a MaskedView + Animated.View width. El Path se renderiza
 *    estático y la animación va en una View común. Esto DEBÍA andar.
 *    No andaba tampoco.
 *
 * Causa raíz encontrada (deep research): el renderer interno de
 * @react-navigation/bottom-tabs (el nav que envuelve expo-router) NO
 * pasa focused actualizado al componente que devuelve tabBarIcon.
 * Monta DOS instancias simultáneas — una con focused:true y otra con
 * focused:false — y solo hace cross-fade de opacity en el padre. Las
 * dos instancias hijas tienen focused CONSTANTE todo el ciclo de vida.
 * Por eso useEffect([focused]) nunca volvía a correr y ninguna de
 * nuestras animaciones disparaba. Confirmado en el source:
 * github.com/react-navigation/react-navigation/blob/main/packages/
 * bottom-tabs/src/views/TabBarIcon.tsx
 *
 * Fix: sacar el render del pipeline de bottom-tabs pasando tabBar
 * propio al <Tabs>, donde focused sí cambia en cada render. Ver
 * app/(app)/(tabs)/_layout.tsx — FloatingTabBar.
 *
 * Patrón de animación: useDerivedValue con withTiming/withSpring. El
 * worklet re-corre en cada render (nuevo closure con focused nuevo),
 * así Reanimated encadena automáticamente la nueva animación sobre la
 * anterior. No hay useEffect ni withSequence reset — más idiomático
 * en Reanimated 4.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 520,
}: Props) {
  // progress: 0 (inactive) → 1 (active). Drivea reveal, marker opacity
  // y marker scaleX.
  const progress = useDerivedValue(() =>
    withTiming(focused ? 1 : 0, {
      duration: focused ? duration : 200,
      easing: Easing.out(Easing.cubic),
    }),
  );

  // pop: scale del icono al activarse.
  const pop = useDerivedValue(() =>
    withSpring(focused ? 1 : 0.92, { damping: 12, stiffness: 180 }),
  );

  const iconScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  const maskStyle = useAnimatedStyle(() => ({
    width: progress.value * size,
  }));
  const markerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: progress.value }],
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
