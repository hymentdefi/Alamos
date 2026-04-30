import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  View,
  PanResponder,
  StyleSheet,
  Easing,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Line,
  Mask,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import * as Haptics from "expo-haptics";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** Serie de valores raw (ej: precios). El componente los normaliza a y. */
  series: number[];
  color: string;
  height?: number;
  withFill?: boolean;
  /** Grosor del trazo. Default 2.4. */
  strokeWidth?: number;
  /** Suavizado con cubic bezier. Default true. En false usa L — picos
   * filosos estilo Robinhood. */
  smooth?: boolean;
  /** Reflejo animado debajo de la línea — barre horizontalmente.
   * Clippeado al área bajo la curva, sutil. */
  sheen?: boolean;
  /** Indicador "live" — dot del color del chart pulsando con halo
   *  expandiéndose en el último punto de la serie (estilo Robinhood
   *  cuando el rango es Live). */
  live?: boolean;
  /** Línea horizontal punteada en el valor del primer punto del
   *  periodo. Hace fácil leer "subí/bajé desde donde arrancó" sin
   *  hacer scrub. Se muestra debajo del trazo, color textFaint. */
  referenceLine?: boolean;
  /** Callback mientras el usuario arrastra el dedo sobre el chart. */
  onScrub?: (index: number, value: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}

const VB_W = 260;
const VB_H = 90;
const TOP_PAD = 10;
const BOT_PAD = 10;
// Padding derecho dentro del viewBox — reserva espacio para que el
// dot del live (y su halo) quede visible en el end del trazo sin
// salirse del SVG. 8 unidades del VB ≈ 3% del ancho, casi imperceptible
// pero suficiente para alojar el halo de hasta 16px de radio.
const RIGHT_PAD = 8;

/** Ancho del rectángulo de sheen en coords del viewBox. */
const SHEEN_W = 80;
/** Duración del barrido del sheen + pausa entre ciclos. */
const SHEEN_TRAVEL_MS = 5400;
const SHEEN_PAUSE_MS = 2200;

function SparklineImpl({
  series,
  color,
  height = 140,
  withFill = true,
  strokeWidth = 2.4,
  smooth = true,
  sheen = false,
  live = false,
  referenceLine = false,
  onScrub,
  onScrubStart,
  onScrubEnd,
  style,
}: Props) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [sheenX, setSheenX] = useState(-SHEEN_W);
  const lastIndexRef = useRef<number | null>(null);
  // Throttle del haptic durante el scrub — disparar selectionAsync en
  // cada cambio de idx satura el motor de haptics y siente lag al
  // arrastrar el dedo. ~55ms entre haptics es ~18Hz, suficientemente
  // denso para que se sienta táctil pero sin sobrecargar.
  const lastHapticAtRef = useRef(0);

  const { points, d, fillD } = useMemo(
    () => computePath(series, smooth),
    [series, smooth],
  );

  /* ─── Live dot pulse — halo crece y desvanece en loop. ───
   *
   * Animated.loop NECESITA resetBeforeIteration:true cuando la
   * animación interna va de A→B con A≠B; sin eso el primer ciclo
   * funciona pero los siguientes intentan ir de B→B (sin cambio
   * visible) y el dot se ve "estático". También usamos sequence con
   * un hold breve al final para que el ojo registre el silencio
   * entre pulsos.
   */
  const livePulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live) {
      livePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // animamos `r` y `opacity` de SVG
        }),
        Animated.delay(180),
      ]),
      { resetBeforeIteration: true },
    );
    loop.start();
    return () => loop.stop();
  }, [live, livePulse]);

  // Halo: r de 5 a 20 px, opacity de 0.55 a 0 — más amplio y opaco
  // que la versión inicial para que el pulso sea claramente visible.
  const haloR = livePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [5, 20],
  });
  const haloOpacity = livePulse.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.55, 0.12, 0],
  });

  // Loop del sheen vía RAF (no podemos usar Animated nativo en props
  // SVG). Easing in-out para que se sienta orgánico, con pausa entre
  // pasajes para que no sea agobiante.
  useEffect(() => {
    if (!sheen) return;
    let start: number | null = null;
    let raf: number;
    const TRAVEL = VB_W + SHEEN_W;
    const TOTAL = SHEEN_TRAVEL_MS + SHEEN_PAUSE_MS;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsedCycle = (t - start) % TOTAL;
      let x;
      if (elapsedCycle < SHEEN_TRAVEL_MS) {
        const p = elapsedCycle / SHEEN_TRAVEL_MS;
        const eased =
          p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        x = -SHEEN_W + TRAVEL * eased;
      } else {
        x = -SHEEN_W;
      }
      setSheenX(x);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sheen]);

  const xToIndex = (x: number): number => {
    if (!layoutWidth || series.length === 0) return 0;
    const ratio = Math.max(0, Math.min(1, x / layoutWidth));
    return Math.round(ratio * (series.length - 1));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const idx = xToIndex(e.nativeEvent.locationX);
          setScrubIndex(idx);
          lastIndexRef.current = idx;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onScrubStart?.();
          onScrub?.(idx, series[idx]);
        },
        onPanResponderMove: (e) => {
          const idx = xToIndex(e.nativeEvent.locationX);
          if (idx !== lastIndexRef.current) {
            lastIndexRef.current = idx;
            const now = Date.now();
            if (now - lastHapticAtRef.current >= 55) {
              lastHapticAtRef.current = now;
              Haptics.selectionAsync().catch(() => {});
            }
            setScrubIndex(idx);
            onScrub?.(idx, series[idx]);
          }
        },
        onPanResponderRelease: () => {
          setScrubIndex(null);
          lastIndexRef.current = null;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onScrubEnd?.();
        },
        onPanResponderTerminate: () => {
          setScrubIndex(null);
          lastIndexRef.current = null;
          onScrubEnd?.();
        },
      }),
    // Incluimos los callbacks porque ahora vienen estables (useCallback
    // del padre) — sin esto el panResponder usaba la versión vieja
    // de los callbacks de un render anterior, bug latente.
    [series, layoutWidth, onScrub, onScrubStart, onScrubEnd],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    setLayoutWidth(e.nativeEvent.layout.width);
  };

  const gradId = `spark-${color.replace("#", "")}`;
  const activePoint =
    scrubIndex != null && points[scrubIndex] ? points[scrubIndex] : null;

  return (
    <View
      onLayout={onLayout}
      style={[{ height, marginHorizontal: -4 }, style]}
      {...panResponder.panHandlers}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
      >
        {withFill ? (
          <>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.24} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={fillD} fill={`url(#${gradId})`} />
          </>
        ) : null}
        {sheen ? (
          <>
            <Defs>
              {/* Gradient horizontal: el reflejo verde que se barre. */}
              <LinearGradient
                id={`sheen-${gradId}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <Stop offset="0" stopColor={color} stopOpacity={0} />
                <Stop offset="0.5" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
              {/* Gradient vertical para la mask: blanco arriba, fade
                  a transparente en el último ~30%. Esto suaviza el
                  borde inferior del sheen para que no se corte feo
                  cuando se topa con el timeline. */}
              <LinearGradient
                id={`sheenFade-${gradId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop offset="0" stopColor="#ffffff" stopOpacity={1} />
                <Stop offset="0.55" stopColor="#ffffff" stopOpacity={1} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </LinearGradient>
              <Mask id={`sheenMask-${gradId}`}>
                <Rect
                  x={0}
                  y={0}
                  width={VB_W}
                  height={VB_H}
                  fill={`url(#sheenFade-${gradId})`}
                />
              </Mask>
              <ClipPath id={`sheenClip-${gradId}`}>
                <Path d={fillD} />
              </ClipPath>
            </Defs>
            <G
              clipPath={`url(#sheenClip-${gradId})`}
              mask={`url(#sheenMask-${gradId})`}
            >
              <Rect
                x={sheenX}
                y={0}
                width={SHEEN_W}
                height={VB_H}
                fill={`url(#sheen-${gradId})`}
              />
            </G>
          </>
        ) : null}
        {/* Reference line — horizontal punteada al valor del primer
            punto de la serie. Da un visual ancla de "desde dónde
            arrancó". Renderizada antes del path principal para
            quedar atrás del trazo. */}
        {referenceLine && points.length > 0 ? (
          <Line
            x1={0}
            x2={VB_W}
            y1={points[0].y}
            y2={points[0].y}
            stroke="#A3A3A3"
            strokeWidth={0.6}
            strokeDasharray="2,3"
            strokeOpacity={0.7}
          />
        ) : null}
        <Path
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      {/* Live dot — sobre el último punto del chart, en su coord
          exacta. computePath ya reserva RIGHT_PAD para que el último
          punto no quede en el borde absoluto y el halo (hasta 16px
          de r) tenga espacio para verse entero. Se oculta durante
          el scrub para no competir con el cursor. */}
      {live && points.length > 0 && layoutWidth > 0 && !activePoint ? (
        <Svg
          width={layoutWidth}
          height={height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <AnimatedCircle
            cx={(points[points.length - 1].x / VB_W) * layoutWidth}
            cy={(points[points.length - 1].y / VB_H) * height}
            r={haloR}
            fill={color}
            opacity={haloOpacity}
          />
          <Circle
            cx={(points[points.length - 1].x / VB_W) * layoutWidth}
            cy={(points[points.length - 1].y / VB_H) * height}
            r={3.5}
            fill={color}
          />
        </Svg>
      ) : null}

      {/* Scrub overlay — SVG separado con viewBox 1:1 en píxeles, para
          que la Circle y la línea vertical no se distorsionen con el
          preserveAspectRatio='none' del chart principal. */}
      {activePoint && layoutWidth > 0 ? (
        <Svg
          width={layoutWidth}
          height={height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Line
            x1={(activePoint.x / VB_W) * layoutWidth}
            x2={(activePoint.x / VB_W) * layoutWidth}
            y1={0}
            y2={height}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.35}
            strokeDasharray="3,3"
          />
          <Circle
            cx={(activePoint.x / VB_W) * layoutWidth}
            cy={(activePoint.y / VB_H) * height}
            r={5}
            fill={color}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/** Sparkline memoizado — evita re-renders cuando el padre cambia
 *  state ajeno al chart (lo que se notaba como lag durante el scrub).
 *  Las props son shallow-compared; con `series` estable (useMemo en el
 *  padre) y los callbacks estables (useCallback) el chart sólo se
 *  vuelve a montar cuando realmente cambia algo del trazo. */
export const Sparkline = memo(SparklineImpl);

function computePath(
  series: number[],
  smooth = true,
): {
  points: { x: number; y: number }[];
  d: string;
  fillD: string;
} {
  if (series.length === 0) return { points: [], d: "", fillD: "" };

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const innerH = VB_H - TOP_PAD - BOT_PAD;
  const innerW = VB_W - RIGHT_PAD;

  const points = series.map((v, i) => {
    const x = (i / Math.max(1, series.length - 1)) * innerW;
    const y = TOP_PAD + innerH - ((v - min) / range) * innerH;
    return { x, y };
  });

  let d = `M${points[0].x},${points[0].y}`;
  if (smooth) {
    // Smooth cubic through midpoints for natural curve.
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      d += ` C${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`;
    }
  } else {
    // Step function estilo Robinhood: horizontal hasta el siguiente
    // tick, después vertical. Sin diagonales — cada precio se mantiene
    // hasta el próximo dato.
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      d += ` L${curr.x},${prev.y} L${curr.x},${curr.y}`;
    }
  }

  const fillD = `${d} L${points[points.length - 1].x},${VB_H} L${points[0].x},${VB_H} Z`;
  return { points, d, fillD };
}

interface MiniProps {
  series: number[];
  color: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}

/**
 * Sparkline chica y pasiva para mostrar al costado de un precio en una lista.
 * Sin pan responder, sin fill, sin ejes — sólo el trazo.
 */
export function MiniSparkline({
  series,
  color,
  width = 56,
  height = 24,
  strokeWidth = 1.6,
}: MiniProps) {
  const d = useMemo(() => computePath(series).d, [series]);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Path
        d={d}
        stroke={color}
        strokeWidth={(strokeWidth * VB_W) / width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Genera una serie determinística a partir de un seed y tendencia. */
export function seriesFromSeed(
  seed: string,
  length: number,
  trend: "up" | "down" | "flat" = "up",
): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };

  const drift = trend === "up" ? 0.9 : trend === "down" ? -0.9 : 0;
  const out: number[] = [];
  let value = 100;
  for (let i = 0; i < length; i++) {
    const noise = (rand() - 0.5) * 6;
    value = value + drift + noise;
    out.push(value);
  }
  return out;
}
