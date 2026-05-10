import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { fontFamily, radius, useTheme } from "../theme";
import type { Asset } from "../data/assets";
import { useAlerts } from "../alerts/context";
import { useToast } from "../toast/context";
import type {
  CreateIndicatorAlertInput,
  IndicatorAlert,
  UpdateIndicatorAlertPatch,
} from "../api/alerts";

/**
 * Bottom sheet de creación + edición de alertas técnicas (indicator
 * alerts: RSI / SMA / MACD / Bollinger / Volumen).
 *
 * Layout:
 *   1. Header: "Nueva alerta de indicador" / "Editar alerta" + botón
 *      outline naranja "Eliminar" cuando es edit.
 *   2. ScrollView con 5 cards (una por indicador). Cada card tiene
 *      el nombre + opciones tappables verde/naranja + descripción 12px.
 *      SMA y Volumen tienen selectores extra (períodos / variant /
 *      multiplier).
 *   3. CTA bottom-fixed "Crear alerta" / "Guardar" cuando hay una
 *      opción seleccionada.
 *
 * En modo CREATE, sólo aparece UNA selección activa a la vez. Si el
 * user toca otra card, la anterior se de-selecciona.
 *
 * En modo EDIT (editingAlert prop), arrancamos con la card del tipo
 * correspondiente expandida y pre-selección de la opción/parámetros
 * actuales. El user puede cambiar dentro del mismo tipo (no cambiar
 * de RSI a SMA).
 */

interface Props {
  visible: boolean;
  asset: Asset;
  /** Si está, sheet abre en EDIT mode con la alerta pre-cargada. */
  editingAlert?: IndicatorAlert;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

type SmaPeriod = 9 | 20 | 50 | 100 | 200;
type VolumeMultiplier = 1.5 | 2 | 3;

/* Estado interno de selección — discriminated por type. Un solo
 * objeto representa la elección actual del user. */
type Selection =
  | null
  | { type: "rsi"; condition: "overbought" | "oversold" }
  | {
      type: "sma";
      condition: "above" | "below";
      period: SmaPeriod;
      variant: "sma" | "ema";
    }
  | { type: "macd"; condition: "bullish" | "bearish" }
  | { type: "bollinger"; band: "upper" | "lower" }
  | { type: "volume"; multiplier: VolumeMultiplier };

/** Convierte una IndicatorAlert existente al estado de Selection
 *  inicial para el modo EDIT. */
function selectionFromAlert(a: IndicatorAlert): Selection {
  if (a.type === "rsi") return { type: "rsi", condition: a.condition };
  if (a.type === "sma")
    return {
      type: "sma",
      condition: a.condition,
      period: a.period,
      variant: a.variant,
    };
  if (a.type === "macd") return { type: "macd", condition: a.condition };
  if (a.type === "bollinger") return { type: "bollinger", band: a.band };
  return { type: "volume", multiplier: a.multiplier };
}

export function IndicatorSheet({
  visible,
  asset,
  editingAlert,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { createIndicator, updateIndicator, removeIndicator } = useAlerts();
  const { show: showToast } = useToast();
  const isEditing = !!editingAlert;

  /* SMA defaults — período 200, variant SMA. Cuando el user toca
   * una opción de la card SMA, el período/variant se inicializan a
   * estos defaults a menos que estuvieran configurados. */
  const [smaPeriod, setSmaPeriod] = useState<SmaPeriod>(200);
  const [smaVariant, setSmaVariant] = useState<"sma" | "ema">("sma");
  /* Volumen default — 2x. */
  const [volumeMultiplier, setVolumeMultiplier] =
    useState<VolumeMultiplier>(2);
  const [selection, setSelection] = useState<Selection>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset / hidratación al abrir.
  useEffect(() => {
    if (visible) {
      if (editingAlert) {
        const s = selectionFromAlert(editingAlert);
        setSelection(s);
        if (editingAlert.type === "sma") {
          setSmaPeriod(editingAlert.period);
          setSmaVariant(editingAlert.variant);
        } else {
          setSmaPeriod(200);
          setSmaVariant("sma");
        }
        if (editingAlert.type === "volume") {
          setVolumeMultiplier(editingAlert.multiplier);
        } else {
          setVolumeMultiplier(2);
        }
      } else {
        setSelection(null);
        setSmaPeriod(200);
        setSmaVariant("sma");
        setVolumeMultiplier(2);
      }
    }
  }, [visible, editingAlert]);

  /* ─── Animación bottom sheet ─── */
  const translateY = useSharedValue(windowH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    translateY.value = withTiming(
      windowH,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) runOnJS(onClose)();
      },
    );
    backdropOpacity.value = withTiming(0, { duration: 240 });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = Math.max(0, 1 - e.translationY / windowH);
      }
    })
    .onEnd((e) => {
      "worklet";
      const shouldDismiss =
        e.translationY > DISMISS_TRANSLATE ||
        e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(
          windowH,
          { duration: 240, easing: Easing.in(Easing.cubic) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(onClose)();
          },
        );
        backdropOpacity.value = withTiming(0, { duration: 240 });
      } else {
        translateY.value = withTiming(0, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
        backdropOpacity.value = withTiming(1, { duration: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  /* ─── Handlers ─── */

  const handleSubmit = async () => {
    if (!selection) return;
    setSubmitting(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      if (isEditing && editingAlert) {
        // Update — sólo dentro del mismo tipo.
        if (editingAlert.type !== selection.type) {
          throw new Error("type mismatch");
        }
        let patch: UpdateIndicatorAlertPatch;
        if (selection.type === "rsi") {
          patch = { type: "rsi", condition: selection.condition };
        } else if (selection.type === "sma") {
          patch = {
            type: "sma",
            condition: selection.condition,
            period: selection.period,
            variant: selection.variant,
          };
        } else if (selection.type === "macd") {
          patch = { type: "macd", condition: selection.condition };
        } else if (selection.type === "bollinger") {
          patch = { type: "bollinger", band: selection.band };
        } else {
          patch = { type: "volume", multiplier: selection.multiplier };
        }
        await updateIndicator(editingAlert.id, patch);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } else {
        let input: CreateIndicatorAlertInput;
        if (selection.type === "rsi") {
          input = {
            type: "rsi",
            assetId: asset.ticker,
            condition: selection.condition,
          };
        } else if (selection.type === "sma") {
          input = {
            type: "sma",
            assetId: asset.ticker,
            condition: selection.condition,
            period: selection.period,
            variant: selection.variant,
          };
        } else if (selection.type === "macd") {
          input = {
            type: "macd",
            assetId: asset.ticker,
            condition: selection.condition,
          };
        } else if (selection.type === "bollinger") {
          input = {
            type: "bollinger",
            assetId: asset.ticker,
            band: selection.band,
          };
        } else {
          input = {
            type: "volume",
            assetId: asset.ticker,
            multiplier: selection.multiplier,
          };
        }
        await createIndicator(input);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      dismiss();
    } catch {
      showToast("No pudimos guardar la alerta", { variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAlert) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await removeIndicator(editingAlert.id);
      dismiss();
    } catch {
      showToast("No pudimos eliminar la alerta", { variant: "error" });
    }
  };

  /* En edit mode, sólo se muestra la card del tipo correspondiente.
   * En create mode, se muestran todas las 5. Esto evita que el user
   * confunda "estoy editando una RSI" con "estoy creando una nueva". */
  const visibleTypes = useMemo<
    ("rsi" | "sma" | "macd" | "bollinger" | "volume")[]
  >(() => {
    if (isEditing && editingAlert) return [editingAlert.type];
    return ["rsi", "sma", "macd", "bollinger", "volume"];
  }, [isEditing, editingAlert]);

  const ctaEnabled = selection !== null && !submitting;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: c.bg,
              borderColor: c.border,
              paddingBottom: insets.bottom + 16,
              maxHeight: windowH * 0.92,
            },
            sheetStyle,
          ]}
        >
          <View style={s.grabber}>
            <View
              style={[s.grabberPill, { backgroundColor: c.borderStrong }]}
            />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={[s.title, { color: c.text }]}>
              {isEditing ? "Editar alerta" : "Nueva alerta de indicador"}
            </Text>
            {isEditing ? (
              <Pressable
                onPress={handleDelete}
                hitSlop={6}
                accessibilityLabel="Eliminar alerta"
                style={({ pressed }) => [
                  s.deleteBtn,
                  { borderColor: c.red, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[s.deleteBtnText, { color: c.red }]}>
                  Eliminar
                </Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingBottom: 96,
              paddingHorizontal: 0,
            }}
            showsVerticalScrollIndicator={false}
          >
            {visibleTypes.includes("rsi") ? (
              <RSICard
                selection={selection}
                onSelect={(sel) => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelection(sel);
                }}
                c={c}
              />
            ) : null}

            {visibleTypes.includes("sma") ? (
              <SMACard
                selection={selection}
                period={smaPeriod}
                variant={smaVariant}
                onSelect={(condition) => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelection({
                    type: "sma",
                    condition,
                    period: smaPeriod,
                    variant: smaVariant,
                  });
                }}
                onPeriod={(p) => {
                  Haptics.selectionAsync().catch(() => {});
                  setSmaPeriod(p);
                  if (selection && selection.type === "sma") {
                    setSelection({ ...selection, period: p });
                  }
                }}
                onVariant={(v) => {
                  Haptics.selectionAsync().catch(() => {});
                  setSmaVariant(v);
                  if (selection && selection.type === "sma") {
                    setSelection({ ...selection, variant: v });
                  }
                }}
                c={c}
              />
            ) : null}

            {visibleTypes.includes("macd") ? (
              <MACDCard
                selection={selection}
                onSelect={(sel) => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelection(sel);
                }}
                c={c}
              />
            ) : null}

            {visibleTypes.includes("bollinger") ? (
              <BollingerCard
                selection={selection}
                onSelect={(sel) => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelection(sel);
                }}
                c={c}
              />
            ) : null}

            {visibleTypes.includes("volume") ? (
              <VolumeCard
                selection={selection}
                multiplier={volumeMultiplier}
                onSelect={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelection({
                    type: "volume",
                    multiplier: volumeMultiplier,
                  });
                }}
                onMultiplier={(m) => {
                  Haptics.selectionAsync().catch(() => {});
                  setVolumeMultiplier(m);
                  if (selection && selection.type === "volume") {
                    setSelection({ ...selection, multiplier: m });
                  }
                }}
                c={c}
              />
            ) : null}
          </ScrollView>

          {/* CTA bottom — aparece sólo si hay selección */}
          {selection !== null ? (
            <View
              style={[
                s.ctaWrap,
                { backgroundColor: c.bg, borderTopColor: c.border },
              ]}
            >
              <Pressable
                onPress={handleSubmit}
                disabled={!ctaEnabled}
                style={({ pressed }) => [
                  s.cta,
                  {
                    backgroundColor: c.text,
                    opacity: !ctaEnabled ? 0.55 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[s.ctaText, { color: c.bg }]}>
                  {isEditing ? "Guardar" : "Crear alerta"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

/* ─── Cards por indicador ──────────────────────────────────────── */

type ColorMap = ReturnType<typeof useTheme>["c"];

function CardShell({
  title,
  description,
  children,
  c,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  c: ColorMap;
}) {
  return (
    <View
      style={[
        s.card,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <Text style={[s.cardTitle, { color: c.text }]}>{title}</Text>
      <View style={s.cardOptions}>{children}</View>
      <Text style={[s.cardDesc, { color: c.textMuted }]}>{description}</Text>
    </View>
  );
}

function OptionRow({
  label,
  active,
  tone,
  onPress,
  c,
}: {
  label: string;
  active: boolean;
  /** Color del label/border cuando está active. */
  tone: string;
  onPress: () => void;
  c: ColorMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.option,
        {
          borderColor: active ? tone : c.border,
          backgroundColor: active ? `${tone}1A` : "transparent",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          s.optionText,
          {
            color: tone,
            fontFamily: active ? fontFamily[700] : fontFamily[600],
          },
        ]}
      >
        {label}
      </Text>
      {active ? (
        <View style={[s.checkDot, { backgroundColor: tone }]}>
          <Feather name="check" size={11} color={c.bg} />
        </View>
      ) : null}
    </Pressable>
  );
}

function RSICard({
  selection,
  onSelect,
  c,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
  c: ColorMap;
}) {
  const sel = selection?.type === "rsi" ? selection : null;
  return (
    <CardShell
      title="RSI (Relative Strength Index)"
      description="Mide la velocidad y magnitud de los movimientos de precio."
      c={c}
    >
      <OptionRow
        label="Sobrecompra: RSI sube por encima de 70"
        active={sel?.condition === "overbought"}
        tone={c.red}
        onPress={() =>
          onSelect({ type: "rsi", condition: "overbought" })
        }
        c={c}
      />
      <OptionRow
        label="Sobreventa: RSI baja por debajo de 30"
        active={sel?.condition === "oversold"}
        tone={c.brand}
        onPress={() =>
          onSelect({ type: "rsi", condition: "oversold" })
        }
        c={c}
      />
    </CardShell>
  );
}

function SMACard({
  selection,
  period,
  variant,
  onSelect,
  onPeriod,
  onVariant,
  c,
}: {
  selection: Selection;
  period: SmaPeriod;
  variant: "sma" | "ema";
  onSelect: (condition: "above" | "below") => void;
  onPeriod: (p: SmaPeriod) => void;
  onVariant: (v: "sma" | "ema") => void;
  c: ColorMap;
}) {
  const sel = selection?.type === "sma" ? selection : null;
  const periods: SmaPeriod[] = [9, 20, 50, 100, 200];
  return (
    <CardShell
      title="Media Móvil"
      description="Promedio del precio en un período determinado."
      c={c}
    >
      <OptionRow
        label="Precio cruza por encima de la SMA"
        active={sel?.condition === "above"}
        tone={c.brand}
        onPress={() => onSelect("above")}
        c={c}
      />
      <OptionRow
        label="Precio cruza por debajo de la SMA"
        active={sel?.condition === "below"}
        tone={c.red}
        onPress={() => onSelect("below")}
        c={c}
      />

      {/* Chips de período */}
      <View style={s.chipsLabelRow}>
        <Text style={[s.chipsLabel, { color: c.textMuted }]}>
          Período
        </Text>
      </View>
      <View style={s.chipsRow}>
        {periods.map((p) => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              onPress={() => onPeriod(p)}
              style={({ pressed }) => [
                s.chip,
                {
                  borderColor: active ? c.text : c.border,
                  backgroundColor: active ? c.text : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  { color: active ? c.bg : c.text },
                ]}
              >
                {p}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Segmented SMA / EMA */}
      <View style={s.chipsLabelRow}>
        <Text style={[s.chipsLabel, { color: c.textMuted }]}>Tipo</Text>
      </View>
      <View
        style={[
          s.segmented,
          { backgroundColor: c.surfaceHover },
        ]}
      >
        {(["sma", "ema"] as const).map((v) => {
          const active = variant === v;
          return (
            <Pressable
              key={v}
              onPress={() => onVariant(v)}
              style={[
                s.segmentedItem,
                active && { backgroundColor: c.bg },
              ]}
            >
              <Text
                style={[
                  s.segmentedText,
                  {
                    color: active ? c.text : c.textMuted,
                    fontFamily: active ? fontFamily[700] : fontFamily[600],
                  },
                ]}
              >
                {v.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </CardShell>
  );
}

function MACDCard({
  selection,
  onSelect,
  c,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
  c: ColorMap;
}) {
  const sel = selection?.type === "macd" ? selection : null;
  return (
    <CardShell
      title="MACD"
      description="Detecta cambios en la fuerza y dirección de la tendencia."
      c={c}
    >
      <OptionRow
        label="Cruce alcista: MACD cruza por encima de la señal"
        active={sel?.condition === "bullish"}
        tone={c.brand}
        onPress={() =>
          onSelect({ type: "macd", condition: "bullish" })
        }
        c={c}
      />
      <OptionRow
        label="Cruce bajista: MACD cruza por debajo de la señal"
        active={sel?.condition === "bearish"}
        tone={c.red}
        onPress={() =>
          onSelect({ type: "macd", condition: "bearish" })
        }
        c={c}
      />
    </CardShell>
  );
}

function BollingerCard({
  selection,
  onSelect,
  c,
}: {
  selection: Selection;
  onSelect: (s: Selection) => void;
  c: ColorMap;
}) {
  const sel = selection?.type === "bollinger" ? selection : null;
  return (
    <CardShell
      title="Bandas de Bollinger"
      description="Mide volatilidad relativa al precio promedio."
      c={c}
    >
      <OptionRow
        label="Precio toca banda superior"
        active={sel?.band === "upper"}
        tone={c.red}
        onPress={() =>
          onSelect({ type: "bollinger", band: "upper" })
        }
        c={c}
      />
      <OptionRow
        label="Precio toca banda inferior"
        active={sel?.band === "lower"}
        tone={c.brand}
        onPress={() =>
          onSelect({ type: "bollinger", band: "lower" })
        }
        c={c}
      />
    </CardShell>
  );
}

function VolumeCard({
  selection,
  multiplier,
  onSelect,
  onMultiplier,
  c,
}: {
  selection: Selection;
  multiplier: VolumeMultiplier;
  onSelect: () => void;
  onMultiplier: (m: VolumeMultiplier) => void;
  c: ColorMap;
}) {
  const sel = selection?.type === "volume" ? selection : null;
  const isActive = !!sel;
  const multipliers: VolumeMultiplier[] = [1.5, 2, 3];
  return (
    <CardShell
      title="Volumen"
      description="Detecta actividad inusual en el volumen de operaciones."
      c={c}
    >
      <OptionRow
        label={`Volumen supera ${multiplier}x el promedio`}
        active={isActive}
        tone={c.text}
        onPress={onSelect}
        c={c}
      />

      {/* Chips de multiplier */}
      <View style={s.chipsLabelRow}>
        <Text style={[s.chipsLabel, { color: c.textMuted }]}>
          Multiplicador
        </Text>
      </View>
      <View style={s.chipsRow}>
        {multipliers.map((m) => {
          const active = multiplier === m;
          return (
            <Pressable
              key={m}
              onPress={() => onMultiplier(m)}
              style={({ pressed }) => [
                s.chip,
                {
                  borderColor: active ? c.text : c.border,
                  backgroundColor: active ? c.text : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  { color: active ? c.bg : c.text },
                ]}
              >
                {m}x
              </Text>
            </Pressable>
          );
        })}
      </View>
    </CardShell>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    alignItems: "center",
    paddingVertical: 8,
  },
  grabberPill: {
    width: 40,
    height: 4,
    borderCurve: "continuous",
    borderRadius: 2,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 6,
    paddingBottom: 16,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.6,
    flexShrink: 1,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1.4,
    backgroundColor: "transparent",
  },
  deleteBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.2,
  },

  /* Cards */
  card: {
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  cardOptions: {
    gap: 8,
  },
  cardDesc: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.05,
    marginTop: 12,
  },

  /* Option row */
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1.2,
  },
  optionText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
    flexShrink: 1,
  },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Chips */
  chipsLabelRow: {
    marginTop: 14,
    marginBottom: 6,
  },
  chipsLabel: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* Segmented control SMA/EMA */
  segmented: {
    flexDirection: "row",
    padding: 3,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  segmentedItem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  segmentedText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
  },

  /* CTA */
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    paddingVertical: 16,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    alignItems: "center",
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
