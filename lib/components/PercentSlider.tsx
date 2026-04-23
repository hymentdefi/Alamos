import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../theme";

interface Props {
  /** Valor actual 0-100. */
  value: number;
  /** Se dispara en cada cambio (drag o tap). */
  onChange: (v: number) => void;
  /** Se dispara cuando el usuario suelta el dedo. */
  onRelease?: (v: number) => void;
  /** Desactiva la interacción. */
  disabled?: boolean;
  /** Color del fill y el borde del thumb. Default: c.ink */
  accent?: string;
}

const SNAPS = [25, 50, 75, 100];
/** Distancia en % dentro de la cual el thumb "pega" al snap. */
const SNAP_TOLERANCE = 2.5;
const THUMB_SIZE = 18;
const TICK_SIZE = 8;
const TRACK_H = 2;
const HIT_HEIGHT = 40;

export function PercentSlider({
  value,
  onChange,
  onRelease,
  disabled,
  accent,
}: Props) {
  const { c } = useTheme();
  const [trackW, setTrackW] = useState(0);
  const [dragging, setDragging] = useState(false);
  const lastSnap = useRef<number | null>(null);
  const accentColor = accent ?? c.ink;

  const pctFromX = useCallback(
    (x: number) => {
      if (trackW <= 0) return value;
      const clamped = Math.max(0, Math.min(trackW, x));
      let pct = (clamped / trackW) * 100;
      for (const s of [0, ...SNAPS]) {
        if (Math.abs(pct - s) < SNAP_TOLERANCE) {
          pct = s;
          break;
        }
      }
      return pct;
    },
    [trackW, value],
  );

  const maybeHaptic = (pct: number) => {
    const snap = [0, ...SNAPS].find((s) => Math.abs(s - pct) < 0.5) ?? null;
    if (snap !== lastSnap.current) {
      if (snap !== null) Haptics.selectionAsync().catch(() => {});
      lastSnap.current = snap;
    }
  };

  const onGrant = (e: GestureResponderEvent) => {
    if (disabled) return;
    setDragging(true);
    const pct = pctFromX(e.nativeEvent.locationX);
    maybeHaptic(pct);
    onChange(pct);
  };

  const onMove = (e: GestureResponderEvent) => {
    if (disabled) return;
    const pct = pctFromX(e.nativeEvent.locationX);
    maybeHaptic(pct);
    onChange(pct);
  };

  const onEnd = (e: GestureResponderEvent) => {
    if (disabled) return;
    setDragging(false);
    const pct = pctFromX(e.nativeEvent.locationX);
    lastSnap.current = null;
    onRelease?.(pct);
  };

  const onLabelTap = (v: number) => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(v);
    onRelease?.(v);
  };

  const thumbLeft = (value / 100) * trackW;
  const pctRounded = Math.round(value);

  return (
    <View style={s.wrap}>
      <View style={s.touchPad}>
        <View
          style={s.trackArea}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled}
          onResponderGrant={onGrant}
          onResponderMove={onMove}
          onResponderRelease={onEnd}
          onResponderTerminate={onEnd}
        >
          {/* Línea fina de fondo */}
          <View
            pointerEvents="none"
            style={[s.trackLine, { backgroundColor: c.surfaceSunken }]}
          />
          {/* Fill desde 0 hasta el thumb */}
          <View
            pointerEvents="none"
            style={[
              s.fillLine,
              { width: thumbLeft, backgroundColor: accentColor },
            ]}
          />
          {/* Ticks circulares en 25/50/75/100 */}
          {SNAPS.map((t) => {
            const x = (t / 100) * trackW;
            const passed = value >= t - 0.5;
            return (
              <View
                key={t}
                pointerEvents="none"
                style={[
                  s.tick,
                  {
                    left: x,
                    backgroundColor: passed ? accentColor : c.surface,
                    borderColor: passed ? accentColor : c.borderStrong,
                  },
                ]}
              />
            );
          })}
          {/* Thumb circular */}
          <View
            pointerEvents="none"
            style={[
              s.thumb,
              {
                left: thumbLeft,
                backgroundColor: c.surface,
                borderColor: accentColor,
              },
            ]}
          />
          {/* Tooltip con % mientras se arrastra */}
          {dragging && trackW > 0 ? (
            <View
              pointerEvents="none"
              style={[s.tooltip, { left: thumbLeft }]}
            >
              <View style={[s.tooltipPill, { backgroundColor: c.ink }]}>
                <Text style={[s.tooltipText, { color: c.bg }]}>
                  {pctRounded}%
                </Text>
              </View>
              <View style={[s.tooltipArrow, { borderTopColor: c.ink }]} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={s.labelsRow}>
        {SNAPS.map((v) => {
          const active = Math.abs(value - v) < 0.5;
          return (
            <Pressable
              key={v}
              onPress={() => onLabelTap(v)}
              hitSlop={8}
              style={s.labelHit}
            >
              <Text
                style={[
                  s.label,
                  {
                    color: active ? c.text : c.textMuted,
                    fontFamily: active ? fontFamily[700] : fontFamily[600],
                  },
                ]}
              >
                {v}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  touchPad: {
    height: HIT_HEIGHT,
    justifyContent: "center",
  },
  trackArea: {
    height: THUMB_SIZE,
    // Margen horizontal = radio del thumb para que los extremos 0/100
    // caigan alineados con los bordes del layout.
    marginHorizontal: THUMB_SIZE / 2,
  },
  trackLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (THUMB_SIZE - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: TRACK_H,
  },
  fillLine: {
    position: "absolute",
    left: 0,
    top: (THUMB_SIZE - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: TRACK_H,
  },
  tick: {
    position: "absolute",
    top: (THUMB_SIZE - TICK_SIZE) / 2,
    width: TICK_SIZE,
    height: TICK_SIZE,
    borderRadius: TICK_SIZE / 2,
    borderWidth: 1.5,
    marginLeft: -TICK_SIZE / 2,
  },
  thumb: {
    position: "absolute",
    top: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    marginLeft: -THUMB_SIZE / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  tooltip: {
    position: "absolute",
    top: -34,
    alignItems: "center",
    // Centrar sobre el thumb
    marginLeft: -22,
    width: 44,
  },
  tooltipPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  tooltipText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.05,
    textAlign: "center",
  },
  tooltipArrow: {
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 2,
  },
  labelHit: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
});
