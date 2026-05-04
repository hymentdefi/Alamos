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
  /** ViewBox propio del icono. Default "0 0 24 24" si no se especifica.
   *  Los icons del set 'navbar' del brand pack vienen en 28×28. */
  viewBox?: string;
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
      <Svg width={size} height={size} viewBox={path.viewBox ?? viewBox}>
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
// Set 'navbar' del brand pack: viewBox 28×28, todos round-cap/join.
// Los largos (len) son aproximados con ~5% de overshoot — no hay
// Path.getTotalLength() en react-native-svg, así que los calculamos
// a mano. El overshoot garantiza que el dash cubra el trazo completo.
//
// Las variantes 'active' del export usan el mismo path d con un fill
// translúcido extra. La versión activa la maneja el theme-color del
// stroke + la pill verde que vive en el _layout — el path queda igual.
export const tabPaths = {
  home: {
    viewBox: "0 0 28 28",
    segments: [
      // Casita: silueta cerrada (techo + paredes + entrada).
      {
        d: "M5 13 L14 5 L23 13 L23 23 L17 23 L17 17 L11 17 L11 23 L5 23 Z",
        len: 78,
      },
    ],
  },
  markets: {
    viewBox: "0 0 28 28",
    segments: [
      // 4 barras verticales — bar chart minimalista, sin ejes.
      { d: "M6 22 L6 14", len: 8.4 },
      { d: "M11 22 L11 10", len: 12.6 },
      { d: "M16 22 L16 16", len: 6.3 },
      { d: "M21 22 L21 7", len: 15.75 },
    ],
  },
  portfolio: {
    viewBox: "0 0 28 28",
    segments: [
      // Donut completo (2 semicírculos para cerrar el path).
      { d: "M5 14 A9 9 0 1 1 23 14 A9 9 0 1 1 5 14", len: 60 },
      // Slice de 'allocation' — arco de top a ~4 o'clock + 2 radios.
      { d: "M14 5 A9 9 0 0 1 21.4 18.5 L14 14 Z", len: 38 },
    ],
  },
  news: {
    viewBox: "0 0 28 28",
    segments: [
      // Hoja principal.
      { d: "M5 6 L19 6 L19 22 L5 22 Z", len: 63 },
      // Solapa derecha (página doblada).
      { d: "M19 10 L23 10 L23 22 L19 22", len: 21 },
      // 3 rayas de texto.
      { d: "M8 11 L16 11", len: 8.4 },
      { d: "M8 15 L16 15", len: 8.4 },
      { d: "M8 19 L13 19", len: 5.25 },
    ],
  },
  alamo: {
    viewBox: "0 0 28 28",
    segments: [
      // Isotipo Álamos — los 2 triángulos del logo, dibujados en orden
      // (chico delante, grande detrás).
      { d: "M11 8 L5 22 L17 22 Z", len: 45 },
      { d: "M16 4 L9 22 L23 22 Z", len: 55 },
    ],
  },
} as const satisfies Record<string, TabPath>;
