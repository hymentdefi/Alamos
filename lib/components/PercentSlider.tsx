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

const SNAPS = [0, 25, 50, 75, 100];
/** Distancia en % dentro de la cual el thumb "pega" al snap. */
const SNAP_TOLERANCE = 2.5;
const THUMB_SIZE = 24;
const TRACK_H = 6;

export function PercentSlider({
  value,
  onChange,
  onRelease,
  disabled,
  accent,
}: Props) {
  const { c } = useTheme();
  const [trackW, setTrackW] = useState(0);
  const lastSnap = useRef<number | null>(null);
  const accentColor = accent ?? c.ink;

  const pctFromX = useCallback(
    (x: number) => {
      if (trackW <= 0) return value;
      const clamped = Math.max(0, Math.min(trackW, x));
      let pct = (clamped / trackW) * 100;
      for (const s of SNAPS) {
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
    const snap = SNAPS.find((s) => Math.abs(s - pct) < 0.5) ?? null;
    if (snap !== lastSnap.current) {
      if (snap !== null) Haptics.selectionAsync().catch(() => {});
      lastSnap.current = snap;
    }
  };

  const onMove = (e: GestureResponderEvent) => {
    if (disabled) return;
    const pct = pctFromX(e.nativeEvent.locationX);
    maybeHaptic(pct);
    onChange(pct);
  };

  const onEnd = (e: GestureResponderEvent) => {
    if (disabled) return;
    const pct = pctFromX(e.nativeEvent.locationX);
    lastSnap.current = null;
    onRelease?.(pct);
  };

  const onTickTap = (v: number) => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(v);
    onRelease?.(v);
  };

  const thumbLeft = (value / 100) * trackW;

  return (
    <View style={s.wrap}>
      <View style={s.touchPad}>
        <View
          style={s.trackArea}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => !disabled}
          onMoveShouldSetResponder={() => !disabled}
          onResponderGrant={onMove}
          onResponderMove={onMove}
          onResponderRelease={onEnd}
          onResponderTerminate={onEnd}
        >
          <View
            pointerEvents="none"
            style={[s.trackLine, { backgroundColor: c.surfaceSunken }]}
          />
          <View
            pointerEvents="none"
            style={[
              s.fillLine,
              { width: thumbLeft, backgroundColor: accentColor },
            ]}
          />
          {[25, 50, 75].map((t) => {
            const x = (t / 100) * trackW;
            const passed = value >= t;
            return (
              <View
                key={t}
                pointerEvents="none"
                style={[
                  s.tick,
                  {
                    left: x,
                    backgroundColor: passed ? c.bg : c.borderStrong,
                  },
                ]}
              />
            );
          })}
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
        </View>
      </View>

      <View style={s.labelsRow}>
        {SNAPS.slice(1).map((v) => {
          const active = Math.abs(value - v) < 0.5;
          return (
            <Pressable
              key={v}
              onPress={() => onTickTap(v)}
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
  /** Extensión vertical para que sea fácil de agarrar. */
  touchPad: {
    height: THUMB_SIZE + 18,
    justifyContent: "center",
  },
  trackArea: {
    height: THUMB_SIZE,
    // Margen horizontal equivalente al radio del thumb para que el centro
    // del thumb llegue exactamente a 0% y 100% sin salirse del layout.
    marginHorizontal: THUMB_SIZE / 2,
  },
  trackLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (THUMB_SIZE - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: radius.pill,
  },
  fillLine: {
    position: "absolute",
    left: 0,
    top: (THUMB_SIZE - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: radius.pill,
  },
  tick: {
    position: "absolute",
    width: 2,
    top: (THUMB_SIZE - TRACK_H) / 2,
    height: TRACK_H,
    borderRadius: 1,
    marginLeft: -1,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
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
