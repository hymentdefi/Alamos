import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { fontFamily, radius, useTheme } from "../theme";

interface Props {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Sufijo después del número, ej. "x" o "%" o "σ". */
  suffix?: string;
  /** Cantidad de decimales a mostrar. Default 0. */
  decimals?: number;
  disabled?: boolean;
}

/**
 * Numeric stepper compact — botones circulares 28px con valor central.
 * Long-press en +/- → autorepeat (cada 100ms después de 500ms de hold).
 * Tap en el número → keyboard numérico para tipear un valor custom,
 * validado a [min, max] al blur.
 *
 * Visual: tres elementos lado a lado sin chrome de track, los botones
 * son circles solid sobre `c.surfaceHover` para dar affordance sin
 * pesar visualmente cuando viven al lado de chips outline brand.
 */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  decimals = 0,
  disabled,
}: Props) {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const formatted = value.toFixed(decimals).replace(".", ",");

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  /* Long-press autorepeat. La idea: 500ms de hold antes del primer
   * repeat, después cada 100ms. Esto deja el tap simple igual de
   * inmediato y solo activa autorepeat cuando el user mantiene. */
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const stopHold = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  /* Cleanup en unmount — clear timers explícitamente para no
   * referenciar stopHold (que cambia entre renders y dispararía
   * exhaustive-deps). */
  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  const applyDelta = (sign: 1 | -1) => {
    const current = valueRef.current;
    const next = clamp(current + sign * step);
    if (next !== current) {
      Haptics.selectionAsync().catch(() => {});
      onChange(roundToStep(next, step, decimals));
    }
  };

  const startHold = (sign: 1 | -1) => {
    if (disabled) return;
    applyDelta(sign);
    stopHold();
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => applyDelta(sign), 100);
    }, 500);
  };

  return (
    <View style={s.wrap}>
      <Pressable
        onPressIn={() => startHold(-1)}
        onPressOut={stopHold}
        hitSlop={6}
        disabled={disabled || value <= min}
        style={({ pressed }) => [
          s.btn,
          {
            backgroundColor: c.surfaceHover,
            opacity: value <= min || disabled ? 0.35 : pressed ? 0.6 : 1,
          },
        ]}
        accessibilityLabel="Disminuir"
      >
        <Feather name="minus" size={14} color={c.textSecondary} />
      </Pressable>

      <View style={s.middle}>
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={() => {
              setEditing(false);
              const parsed = parseFloat(draft.replace(",", "."));
              if (isFinite(parsed)) {
                onChange(clamp(roundToStep(parsed, step, decimals)));
              }
            }}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            style={[s.input, { color: c.text }]}
          />
        ) : (
          <Pressable
            onPress={() => {
              if (disabled) return;
              setDraft(formatted);
              setEditing(true);
            }}
            hitSlop={4}
          >
            <Text style={[s.value, { color: c.text }]}>
              {formatted}
              {suffix ? (
                <Text style={[s.suffix, { color: c.textMuted }]}>
                  {suffix}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable
        onPressIn={() => startHold(1)}
        onPressOut={stopHold}
        hitSlop={6}
        disabled={disabled || value >= max}
        style={({ pressed }) => [
          s.btn,
          {
            backgroundColor: c.surfaceHover,
            opacity: value >= max || disabled ? 0.35 : pressed ? 0.6 : 1,
          },
        ]}
        accessibilityLabel="Aumentar"
      >
        <Feather name="plus" size={14} color={c.textSecondary} />
      </Pressable>
    </View>
  );
}

function roundToStep(n: number, step: number, decimals: number): number {
  const rounded = Math.round(n / step) * step;
  const p = Math.pow(10, decimals);
  return Math.round(rounded * p) / p;
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  btn: {
    width: 28,
    height: 28,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  middle: {
    minWidth: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  value: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  suffix: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  input: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.2,
    minWidth: 44,
    textAlign: "center",
    padding: 0,
  },
});
