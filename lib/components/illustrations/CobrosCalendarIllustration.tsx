import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 200. */
  size?: number;
  /** Cuando flipa a true, dispara la animación. Reset a 0 cuando
   *  vuelve a false. */
  play?: boolean;
}

const STROKE_INK = "#0E0F0C";
const BRAND_GREEN = "#00C805";

/* Pila de calendar pages — 5 capas con offset diagonal down-right
 * (suggesting depth). El front es blanco puro con stroke BRAND
 * GREEN + todos los detalles (grid + dots + header band). Las
 * capas de atrás son progresivamente grises con stroke alpha
 * menor, sugiriendo que se pierden en el fondo.
 *
 * Inspirado en AlamosBalanceIllustration: layered stack + floor
 * shadow para grounding. La sombra del piso es ellipse fija; la
 * pila apparece con scale + fade (sin "salto"). */
const LAYERS: ReadonlyArray<{
  /** Offset desde la front layer. */
  dx: number;
  dy: number;
  fill: string;
  strokeAlpha: number;
  strokeWidth: number;
}> = [
  // back-most → front-most
  { dx: 6, dy: 6, fill: "#E0E0E0", strokeAlpha: 0.22, strokeWidth: 1.4 },
  { dx: 4.5, dy: 4.5, fill: "#EAEAEA", strokeAlpha: 0.32, strokeWidth: 1.4 },
  { dx: 3, dy: 3, fill: "#F2F2F2", strokeAlpha: 0.5, strokeWidth: 1.5 },
  { dx: 1.5, dy: 1.5, fill: "#FAFAFA", strokeAlpha: 0.7, strokeWidth: 1.6 },
  { dx: 0, dy: 0, fill: "#FFFFFF", strokeAlpha: 1, strokeWidth: 3 }, // top/front
];

const W = 200;
const CARD_X = 28;
const CARD_Y = 30;
const CARD_W = 144;
const CARD_H = 150;
const HEADER_H = 22;
const GRID_Y = CARD_Y + HEADER_H;
const GRID_H = CARD_H - HEADER_H;
const COL_W = CARD_W / 3;
const ROW_H = GRID_H / 4;
const DOT_R = 7.5;

/* Distribución de dots en 4 rows × 3 cols. Pensada para parecer
 * meses con cobros bien repartidos a lo largo del año. */
const DOT_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [2, 0],
  [1, 1],
  [0, 2],
  [2, 2],
  [1, 3],
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* Cada dot vive en su propio componente. Animamos su radio: 0 →
 * DOT_R con spring overshoot, que da un "pop" cuando aparecen. */
function AnimatedDot({
  cx,
  cy,
  scaleSV,
}: {
  cx: number;
  cy: number;
  scaleSV: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => ({
    r: DOT_R * scaleSV.value,
  }));
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill={BRAND_GREEN}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Ilustración "Calendario de cobros" — pila 3D de calendar pages con
 * dots brand que aparecen en secuencia sobre la página de arriba.
 *
 * Capas:
 *   1. Floor shadow: ellipse fija que actúa de "piso" — pulsa
 *      suavemente con el scale del wrapper para sentir gravedad.
 *   2. 5 calendar pages stack: blanca al frente con stroke ink
 *      completo, progresivamente grayscale y semi-transparentes
 *      hacia atrás. Offset diagonal down-right para perspective.
 *   3. Detalles sobre el front layer: header band line + grid 3×4
 *      + 6 dots brand que aparecen secuencialmente.
 *
 * Animación:
 *   - Wrapper: scale 0.78 → 1 con spring overshoot + opacity 0 → 1.
 *   - Floor shadow: scaleX inverso al wrapper scale (más chica
 *     cuando la pila "vuela", más grande cuando se asienta).
 *   - Dots: radio 0 → DOT_R con spring stagger 90ms entre cada uno.
 *     Total ~720ms para los 6 dots.
 */
export function CobrosCalendarIllustration({
  size = 200,
  play = false,
}: Props) {
  const wrapScale = useSharedValue(0.78);
  const wrapOpacity = useSharedValue(0);
  const dotScales = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  useEffect(() => {
    cancelAnimation(wrapScale);
    cancelAnimation(wrapOpacity);
    for (const s of dotScales) cancelAnimation(s);

    if (!play) {
      wrapScale.value = 0.78;
      wrapOpacity.value = 0;
      for (const s of dotScales) s.value = 0;
      return;
    }

    wrapScale.value = withSpring(1, {
      damping: 13,
      stiffness: 150,
      mass: 0.7,
    });
    wrapOpacity.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });

    dotScales.forEach((s, i) => {
      s.value = withDelay(
        260 + i * 90,
        withSpring(1, { damping: 10, stiffness: 220, mass: 0.55 }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wrapScale.value }],
    opacity: wrapOpacity.value,
  }));

  /* La sombra escala X inversamente al wrapper scale: cuando el
   * wrapper está chico (recién montó), la sombra es chiquita;
   * cuando se asienta a scale 1, la sombra alcanza su tamaño full.
   * Sugerimos que la pila "cae" sobre el piso. */
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 0.7 + 0.3 * wrapScale.value }],
    opacity: 0.05 + 0.1 * wrapScale.value,
  }));

  return (
    <View style={{ width: size, height: size }}>
      {/* Floor shadow — ellipse anchored al piso. Su scale y opacity
          se animan con wrapper para sentir "settling". */}
      <Animated.View style={[StyleSheet.absoluteFill, shadowStyle]}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${W}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Ellipse
            cx={W / 2 + 3}
            cy={CARD_Y + CARD_H + 14}
            rx={CARD_W * 0.46}
            ry={6}
            fill={STROKE_INK}
          />
        </Svg>
      </Animated.View>

      {/* Calendar stack — 5 layers, top con todos los detalles. */}
      <Animated.View style={[StyleSheet.absoluteFill, wrapStyle]}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${W}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Render layers from back to front. Stroke en BRAND_GREEN
              para que el calendario tenga identidad cromática Álamos
              (lo que pidió el user). Alpha gradient: back layers
              0.22 → front 1.0. */}
          {LAYERS.map((L, i) => (
            <Rect
              key={i}
              x={CARD_X + L.dx}
              y={CARD_Y + L.dy}
              width={CARD_W}
              height={CARD_H}
              rx={13}
              fill={L.fill}
              stroke={BRAND_GREEN}
              strokeOpacity={L.strokeAlpha}
              strokeWidth={L.strokeWidth}
            />
          ))}

          {/* Header band — fill brand sobre la parte de arriba del
              front layer. Path con rounded top corners + flat bottom
              (matchea el rx=13 de la card). Estilo Apple Calendar /
              Robinhood: header colored + body white. */}
          <Path
            d={`M${CARD_X + 13} ${CARD_Y}
               H${CARD_X + CARD_W - 13}
               A 13 13 0 0 1 ${CARD_X + CARD_W} ${CARD_Y + 13}
               V${GRID_Y}
               H${CARD_X}
               V${CARD_Y + 13}
               A 13 13 0 0 1 ${CARD_X + 13} ${CARD_Y} Z`}
            fill={BRAND_GREEN}
          />

          {/* Header punch dots — perforaciones de un calendar de
              pared. En blanco para contrastar contra el band brand. */}
          <Circle cx={CARD_X + 26} cy={CARD_Y + 11} r={2.5} fill="#FFFFFF" />
          <Circle
            cx={CARD_X + CARD_W - 26}
            cy={CARD_Y + 11}
            r={2.5}
            fill="#FFFFFF"
          />

          {/* Grid lines — 3 horizontales + 2 verticales dividiendo
              en 12 cells (3 cols × 4 rows). */}
          {[1, 2, 3].map((i) => (
            <Path
              key={`h${i}`}
              d={`M${CARD_X} ${GRID_Y + i * ROW_H} H${CARD_X + CARD_W}`}
              stroke={STROKE_INK}
              strokeWidth={1.2}
              opacity={0.16}
            />
          ))}
          {[1, 2].map((i) => (
            <Path
              key={`v${i}`}
              d={`M${CARD_X + i * COL_W} ${GRID_Y} V${CARD_Y + CARD_H}`}
              stroke={STROKE_INK}
              strokeWidth={1.2}
              opacity={0.16}
            />
          ))}

          {/* Dots brand — uno por (col, row) en DOT_POSITIONS. */}
          {DOT_POSITIONS.map(([col, row], i) => {
            const cx = CARD_X + col * COL_W + COL_W / 2;
            const cy = GRID_Y + row * ROW_H + ROW_H / 2;
            return (
              <AnimatedDot
                key={i}
                cx={cx}
                cy={cy}
                scaleSV={dotScales[i]}
              />
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}
