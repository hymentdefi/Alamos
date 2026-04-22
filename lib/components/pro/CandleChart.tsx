import { Fragment, useMemo, useRef, useState } from "react";
import {
  View,
  PanResponder,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme";

export interface Candle {
  /** Cualquier identificador temporal (index, timestamp, etc). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  candles: Candle[];
  height?: number;
  onScrub?: (index: number, candle: Candle) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}

const VB_W = 300;
const VB_H = 140;
const PAD_TOP = 6;
const PAD_BOT = 6;

export function CandleChart({
  candles,
  height = 180,
  onScrub,
  onScrubStart,
  onScrubEnd,
  style,
}: Props) {
  const { c } = useTheme();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const lastIdx = useRef<number | null>(null);

  const { min, max, slotW } = useMemo(() => {
    if (candles.length === 0) return { min: 0, max: 1, slotW: 1 };
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    return {
      min: Math.min(...lows),
      max: Math.max(...highs),
      slotW: VB_W / candles.length,
    };
  }, [candles]);

  const innerH = VB_H - PAD_TOP - PAD_BOT;
  const range = max - min || 1;
  const yScale = (v: number) => PAD_TOP + innerH - ((v - min) / range) * innerH;
  const bodyW = slotW * 0.66;

  const xToIndex = (x: number): number => {
    if (!layoutWidth || candles.length === 0) return 0;
    const r = Math.max(0, Math.min(1, x / layoutWidth));
    return Math.round(r * (candles.length - 1));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const i = xToIndex(e.nativeEvent.locationX);
          setScrubIdx(i);
          lastIdx.current = i;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onScrubStart?.();
          onScrub?.(i, candles[i]);
        },
        onPanResponderMove: (e) => {
          const i = xToIndex(e.nativeEvent.locationX);
          if (i !== lastIdx.current) {
            lastIdx.current = i;
            Haptics.selectionAsync().catch(() => {});
            setScrubIdx(i);
            onScrub?.(i, candles[i]);
          }
        },
        onPanResponderRelease: () => {
          setScrubIdx(null);
          lastIdx.current = null;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onScrubEnd?.();
        },
        onPanResponderTerminate: () => {
          setScrubIdx(null);
          lastIdx.current = null;
          onScrubEnd?.();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candles, layoutWidth],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    setLayoutWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      onLayout={onLayout}
      style={[{ height }, style]}
      {...panResponder.panHandlers}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
      >
        {candles.map((candle, i) => {
          const cx = (i + 0.5) * slotW;
          const bullish = candle.close >= candle.open;
          const color = bullish ? c.green : c.red;
          const bodyTop = yScale(Math.max(candle.open, candle.close));
          const bodyBot = yScale(Math.min(candle.open, candle.close));
          const bodyH = Math.max(0.8, bodyBot - bodyTop);
          const wickTop = yScale(candle.high);
          const wickBot = yScale(candle.low);

          return (
            <Fragment key={i}>
              <Line
                x1={cx}
                x2={cx}
                y1={wickTop}
                y2={wickBot}
                stroke={color}
                strokeWidth={0.8}
              />
              <Rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={color}
              />
            </Fragment>
          );
        })}

        {scrubIdx != null ? (
          <Line
            x1={(scrubIdx + 0.5) * slotW}
            x2={(scrubIdx + 0.5) * slotW}
            y1={0}
            y2={VB_H}
            stroke={c.textMuted}
            strokeWidth={0.6}
            strokeDasharray="3,3"
            strokeOpacity={0.6}
          />
        ) : null}
      </Svg>
    </View>
  );
}

/** Genera una serie de candles determinística. */
export function candlesFromSeed(
  seed: string,
  length: number,
  trend: "up" | "down" | "flat" = "up",
  basePrice = 100,
): Candle[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };

  const drift =
    trend === "up"
      ? basePrice * 0.004
      : trend === "down"
      ? -basePrice * 0.004
      : 0;
  const vol = basePrice * 0.012;

  const out: Candle[] = [];
  let last = basePrice;
  for (let i = 0; i < length; i++) {
    const open = last;
    const close = open + drift + (rand() - 0.5) * vol;
    const wickUp = rand() * vol * 0.7;
    const wickDown = rand() * vol * 0.7;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    out.push({ time: i, open, high, low, close });
    last = close;
  }
  return out;
}
