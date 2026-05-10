import { useState } from "react";
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
 * Numeric stepper — botones - / + en los costados con un campo de
 * texto editable en el medio. Tap en el número → keyboard numérico
 * para tipear un valor custom. Validado a [min, max] al blur.
 *
 * Visual: pill horizontal estilo Robinhood: track de fondo neutro
 * + dos botones + valor centrado.
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

  const inc = () => {
    if (disabled) return;
    const next = clamp(value + step);
    if (next !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(roundToStep(next, step, decimals));
    }
  };
  const dec = () => {
    if (disabled) return;
    const next = clamp(value - step);
    if (next !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(roundToStep(next, step, decimals));
    }
  };

  return (
    <View
      style={[
        s.wrap,
        { backgroundColor: c.surfaceHover, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Pressable
        onPress={dec}
        hitSlop={6}
        disabled={disabled || value <= min}
        style={({ pressed }) => [
          s.btn,
          { opacity: value <= min || disabled ? 0.35 : pressed ? 0.6 : 1 },
        ]}
        accessibilityLabel="Disminuir"
      >
        <Feather name="minus" size={16} color={c.text} />
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
        onPress={inc}
        hitSlop={6}
        disabled={disabled || value >= max}
        style={({ pressed }) => [
          s.btn,
          { opacity: value >= max || disabled ? 0.35 : pressed ? 0.6 : 1 },
        ]}
        accessibilityLabel="Aumentar"
      >
        <Feather name="plus" size={16} color={c.text} />
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
    justifyContent: "space-between",
    borderCurve: "continuous",
    borderRadius: radius.pill,
    padding: 3,
    height: 36,
    minWidth: 130,
  },
  btn: {
    width: 30,
    height: 30,
    borderCurve: "continuous",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  middle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  value: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
  },
  suffix: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  input: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
    minWidth: 60,
    textAlign: "center",
    padding: 0,
  },
});
