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

// Velocidad del "lápiz". Con 10ms/unidad un path de 76 unidades dura
// 760ms, que es el baseline que funciona bien en Inicio.
const MS_PER_UNIT = 10;
// Piso por segmento — los trazos cortos (4-7 unidades) a 10ms/unidad
// darían 40-70ms y se flashean antes de que la retina los agarre.
// Con 180ms de piso, cada trazo se ve dibujarse.
const MIN_SEGMENT_MS = 180;
// Pausa entre trazos — simula al lápiz "levantándose y moviéndose"
// al próximo subpath. Si ponemos 0 queda una secuencia muy robótica.
const INTER_SEGMENT_DELAY = 40;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const segmentDuration = (segLen: number) =>
  Math.max(MIN_SEGMENT_MS, segLen * MS_PER_UNIT);

/**
 * Icono de tab que SE DIBUJA trazo a trazo (efecto lápiz).
 *
 * Por qué segmentos en vez de un solo Path con strokeDashoffset: un
 * <Path d="M... M... M..."> tiene múltiples subpaths, y con un solo
 * strokeDasharray el dash se distribuye proporcionalmente a lo largo
 * del total. Resultado: los subpaths cortos reciben una fracción
 * proporcional del tiempo (por ej. las 3 rayitas de noticias a 7+7+4
 * unidades sobre 108 totales = menos del 20% del tiempo, que a 1080ms
 * total da ~200ms repartidos entre 3 rayitas = ~65ms cada una). Por
 * eso no se veían: se flasheaban fuera del umbral de percepción.
 *
 * Fix: splitear cada subpath en su propio <Path> con su propia
 * Animated.Value. Secuenciamos las animaciones con delay proporcional
 * a la duración de cada una. Cada trazo corto ahora tiene MIN_SEGMENT_MS
 * (180ms) mínimo, y los largos escalan por MS_PER_UNIT (10ms/unidad).
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
      // Secuenciamos: cada segmento arranca su animación con un delay
      // igual a la suma de duraciones + gaps de los anteriores.
      let delay = 0;
      path.segments.forEach((seg, i) => {
        const dur = segmentDuration(seg.len);
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
