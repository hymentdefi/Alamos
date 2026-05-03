import { useEffect } from "react";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

interface Segment {
  /** SVG `d` de este trazo (arranca con su propio M). */
  d: string;
  /**
   * Largo del trazo en unidades del viewBox. Incluye un pequeño
   * overshoot (~5%) así el dash siempre cubre el path completo.
   */
  len: number;
}

interface TabPath {
  /**
   * Lista de trazos. Paths de un solo trazo (tipo casa, álamo) tienen
   * 1 segmento. Paths multi-subpath (gráfico de barras, hoja) tienen
   * varios, y cada uno se dibuja como un mini-trazo propio con su
   * propia animación.
   */
  segments: readonly Segment[];
}

interface Props {
  path: TabPath;
  focused: boolean;
  color: string;
  size?: number;
  viewBox?: string;
}

// Duración total de la animación — IGUAL para todos los iconos, de
// principio a fin. Así aunque alamo tenga 56 unidades de trazo y
// news 111, los dos tardan lo mismo en terminar de dibujarse.
// Dentro de cada icono, el tiempo se reparte proporcional al largo
// de cada segmento — así la velocidad del lápiz es uniforme dentro
// de cada dibujo, y el "principio a fin" es igual entre dibujos.
// 400ms es el sweet spot ahora que el shift de bottom-tabs no está:
// suficientemente largo para que se vea el lápiz dibujando, lo
// suficientemente corto para que matchee el snap de la pantalla.
const TOTAL_DURATION = 400;
// Gap entre segmentos (simula al lápiz levantándose al próximo
// subpath). Se descuenta del total para que TOTAL_DURATION sea la
// duración real de principio a fin, contando gaps.
const INTER_SEGMENT_DELAY = 20;

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface DrawingSegmentProps {
  d: string;
  len: number;
  duration: number;
  delay: number;
  focused: boolean;
  color: string;
}

/**
 * Un segmento del icono. Vive en su propio sub-componente porque
 * `useSharedValue` y `useAnimatedProps` son hooks — y como distintos
 * iconos tienen distinta cantidad de segmentos (home=1, news=5), no
 * podemos llamarlos en un .map() del padre sin violar las rules of
 * hooks. Cada segmento maneja su propio shared value y su propio
 * trigger.
 */
function DrawingSegment({
  d,
  len,
  duration,
  delay,
  focused,
  color,
}: DrawingSegmentProps) {
  // Inicializamos en `len` (invisible) si la tab arranca focused, así
  // el primer frame ya está listo para dibujarse — sin flash de "todo
  // visible" antes de que el useEffect mande el reset a invisible.
  const offset = useSharedValue(focused ? len : 0);

  useEffect(() => {
    cancelAnimation(offset);
    if (focused) {
      // Forzamos arranque en invisible (cubre el caso de venir de
      // unfocused, donde offset ya estaba en 0).
      offset.value = len;
      offset.value = withDelay(
        delay,
        // Linear a propósito: el ease-out cubic que usábamos antes
        // "mentía" la duración percibida — completaba ~87% del trazo
        // en el 50% del tiempo y el último tramo era arrastre
        // imperceptible. Con linear, velocidad constante del lápiz
        // dentro de cada segmento.
        withTiming(0, { duration, easing: Easing.linear }),
      );
    } else {
      // Tab inactiva: trazo completo, sin animación.
      offset.value = 0;
    }
  }, [focused, len, duration, delay, offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={len}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Icono de tab que SE DIBUJA trazo a trazo (efecto lápiz).
 *
 * Migrado a Reanimated 3 con `useAnimatedProps`: el strokeDashoffset
 * corre 100% en UI thread vía worklets. La versión anterior usaba el
 * `Animated` de react-native con `useNativeDriver: false`
 * (strokeDashoffset no soporta native driver), por lo que cada frame
 * de la animación pasaba por el JS thread. Durante un router.navigate
 * el JS thread queda saturado (resolución de ruta + mount de la
 * pantalla nueva + shift de bottom-tabs), entonces la animación se
 * comía 200-400ms de frames y los iconos de un solo segmento (home,
 * alamo) parecían aparecer ya dibujados. Con worklets esto no pasa.
 *
 * Duración total IGUAL para todos los iconos: TOTAL_DURATION ms de
 * principio a fin, sin importar cuántos trazos ni qué tan largos.
 * Dentro de cada icono el tiempo se reparte proporcional al largo de
 * cada segmento — velocidad uniforme del lápiz por dibujo. Entre
 * iconos, como el total es fijo, iconos con más trazo total (news)
 * dibujan más rápido por unidad que iconos con menos (alamo), pero
 * tardan lo mismo en completarse.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
}: Props) {
  // Reparto del tiempo entre segmentos. Calculado en cada render pero
  // estable si path no cambia (no cambia: viene de tabPaths definido
  // con `as const` a nivel módulo).
  const totalLen = path.segments.reduce((a, s) => a + s.len, 0);
  const totalGap = Math.max(0, path.segments.length - 1) * INTER_SEGMENT_DELAY;
  const drawingTime = Math.max(0, TOTAL_DURATION - totalGap);
  let cumulative = 0;
  const timings = path.segments.map((seg) => {
    const dur = (seg.len / totalLen) * drawingTime;
    const delay = cumulative;
    cumulative += dur + INTER_SEGMENT_DELAY;
    return { duration: dur, delay };
  });

  // Pop scale del icono entero al focusear. También en UI thread.
  const popScale = useSharedValue(focused ? 1 : 0.92);
  useEffect(() => {
    popScale.value = withSpring(focused ? 1 : 0.92, {
      damping: 12,
      stiffness: 180,
      mass: 0.6,
    });
  }, [focused, popScale]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: popScale.value }],
  }));

  return (
    <Animated.View style={popStyle}>
      <Svg width={size} height={size} viewBox={viewBox}>
        {path.segments.map((seg, i) => (
          <DrawingSegment
            key={i}
            d={seg.d}
            len={seg.len}
            duration={timings[i].duration}
            delay={timings[i].delay}
            focused={focused}
            color={color}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

/* ─── Paths SVG para las tabs ─── */
// Los largos (len) son aproximados con ~5% de overshoot — no hay
// Path.getTotalLength() en react-native-svg, así que los calculamos
// a mano. El overshoot garantiza que el dash cubra el trazo completo.
export const tabPaths = {
  home: {
    segments: [
      { d: "M4 21 V10 L12 3 L20 10 V21 H15 V14 H9 V21 Z", len: 76 },
    ],
  },
  markets: {
    segments: [
      { d: "M3 21 V4", len: 18 },    // eje Y
      { d: "M3 21 H21", len: 19 },   // eje X
      { d: "M7 17 V13", len: 5 },    // barra 1
      { d: "M12 17 V9", len: 9 },    // barra 2
      { d: "M17 17 V11", len: 7 },   // barra 3
      { d: "M21 17 V7", len: 11 },   // barra 4
    ],
  },
  news: {
    segments: [
      { d: "M5 4 H18 V20 H5 Z", len: 60 },                        // rectángulo
      { d: "M5 4 V20 A2 2 0 0 1 3 18 V11 H5", len: 30 },         // solapa
      { d: "M8 8 H15", len: 8 },                                  // rayita 1
      { d: "M8 12 H15", len: 8 },                                 // rayita 2
      { d: "M8 16 H12", len: 5 },                                 // rayita 3
    ],
  },
  profile: {
    segments: [
      { d: "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 Z", len: 26 },
      { d: "M4 21 V20 A6 6 0 0 1 10 14 H14 A6 6 0 0 1 20 20 V21", len: 28 },
    ],
  },
  support: {
    segments: [
      { d: "M5 4 H19 A2 2 0 0 1 21 6 V15 A2 2 0 0 1 19 17 H12 L7 21 V17 H5 A2 2 0 0 1 3 15 V6 A2 2 0 0 1 5 4 Z", len: 62 },
      { d: "M8 10 H9", len: 2 },
      { d: "M12 10 H13", len: 2 },
      { d: "M16 10 H17", len: 2 },
    ],
  },
  alamo: {
    segments: [
      { d: "M12 2 L6 20 L11 20 L11 22 L13 22 L13 20 L18 20 Z", len: 56 },
    ],
  },
} as const satisfies Record<string, TabPath>;
