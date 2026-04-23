import { useMemo, useRef, useState } from "react";
import {
  View,
  PanResponder,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Stop,
} from "react-native-svg";
import * as Haptics from "expo-haptics";

interface Props {
  /** Serie de valores raw (ej: precios). El componente los normaliza a y. */
  series: number[];
  color: string;
  height?: number;
  withFill?: boolean;
  /** Grosor del trazo. Default 2.4. */
  strokeWidth?: number;
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

export function Sparkline({
  series,
  color,
  height = 140,
  withFill = true,
  strokeWidth = 2.4,
  onScrub,
  onScrubStart,
  onScrubEnd,
  style,
}: Props) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const lastIndexRef = useRef<number | null>(null);

  const { points, d, fillD } = useMemo(() => computePath(series), [series]);

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
            Haptics.selectionAsync().catch(() => {});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, layoutWidth],
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
        <Path
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {activePoint ? (
          <>
            <Line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={0}
              y2={VB_H}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.35}
              strokeDasharray="3,3"
            />
            <Circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={5}
              fill={color}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

function computePath(series: number[]): {
  points: { x: number; y: number }[];
  d: string;
  fillD: string;
} {
  if (series.length === 0) return { points: [], d: "", fillD: "" };

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const innerH = VB_H - TOP_PAD - BOT_PAD;

  const points = series.map((v, i) => {
    const x = (i / Math.max(1, series.length - 1)) * VB_W;
    const y = TOP_PAD + innerH - ((v - min) / range) * innerH;
    return { x, y };
  });

  // Smooth cubic through midpoints for natural curve
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` C${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`;
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
