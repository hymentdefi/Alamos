import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
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

const MARKER_COLOR = "#5ac43e";

// Duración total de la animación — IGUAL para todos los iconos, de
// principio a fin. Así aunque alamo tenga 56 unidades de trazo y
// news 111, los dos tardan lo mismo en terminar de dibujarse.
// Dentro de cada icono, el tiempo se reparte proporcional al largo
// de cada segmento — así la velocidad del lápiz es uniforme dentro
// de cada dibujo, y el "principio a fin" es igual entre dibujos.
const TOTAL_DURATION = 900;
// Gap entre segmentos (simula al lápiz levantándose al próximo
// subpath). Se descuenta del total para que TOTAL_DURATION sea la
// duración real de principio a fin, contando gaps.
const INTER_SEGMENT_DELAY = 20;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Icono de tab que SE DIBUJA trazo a trazo (efecto lápiz).
 *
 * Duración total IGUAL para todos los iconos: TOTAL_DURATION ms de
 * principio a fin, sin importar cuántos trazos ni qué tan largos.
 *
 * Cada subpath es su propio <Path> con su propia Animated.Value (si
 * lo hacíamos con un solo Path multi-subpath, el strokeDashoffset
 * distribuía el tiempo proporcional al largo total y los subpaths
 * cortos se flasheaban). Dentro de cada icono, el tiempo se reparte
 * PROPORCIONAL al largo de cada segmento — así la velocidad del
 * lápiz es uniforme dentro del dibujo. Entre iconos, como el total
 * es fijo, iconos con más trazo total (news) dibujan más rápido
 * por unidad que iconos con menos (alamo), pero tardan lo mismo en
 * completarse.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
}: Props) {
  // Un Animated.Value por segmento. Inicializamos con el largo del
  // segmento (trazo invisible) si focused al mount, o en 0 (trazo
  // visible completo) si inactivo.
  const segmentOffsets = useRef(
    path.segments.map((seg) => new Animated.Value(focused ? seg.len : 0)),
  ).current;
  const markerActive = useRef(
    new Animated.Value(focused ? 1 : 0),
  ).current;
  const pop = useRef(new Animated.Value(focused ? 1 : 0.92)).current;

  useEffect(() => {
    if (focused) {
      // Reset todos los segmentos a invisible antes de secuenciar.
      path.segments.forEach((seg, i) => {
        segmentOffsets[i].setValue(seg.len);
      });
      // Reparto TOTAL_DURATION entre los segmentos proporcional al
      // largo de cada uno, descontando los gaps. Así el total de
      // principio a fin (incluyendo gaps) es exactamente
      // TOTAL_DURATION para todos los iconos.
      const totalLen = path.segments.reduce((a, s) => a + s.len, 0);
      const totalGap = Math.max(0, path.segments.length - 1) * INTER_SEGMENT_DELAY;
      const drawingTime = Math.max(0, TOTAL_DURATION - totalGap);
      let delay = 0;
      path.segments.forEach((seg, i) => {
        const dur = (seg.len / totalLen) * drawingTime;
        Animated.timing(segmentOffsets[i], {
          toValue: 0,
          duration: dur,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // strokeDashoffset no soporta native driver
        }).start();
        delay += dur + INTER_SEGMENT_DELAY;
      });
    } else {
      // Tab inactiva: todos los trazos completos, sin animación.
      path.segments.forEach((seg, i) => {
        segmentOffsets[i].setValue(0);
      });
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
  }, [focused, path.segments, segmentOffsets, markerActive, pop]);

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
          {path.segments.map((seg, i) => (
            <AnimatedPath
              key={i}
              d={seg.d}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={seg.len}
              strokeDashoffset={segmentOffsets[i]}
            />
          ))}
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
