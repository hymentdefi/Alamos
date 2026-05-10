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
import {
  type CreateIndicatorAlertInput,
  type IndicatorAlert,
  type IndicatorFrequency,
  type IndicatorType,
  type Timeframe,
} from "../api/alerts";
import { Stepper } from "./Stepper";

/**
 * IndicatorSheet — bottom sheet de creación + edición de alertas
 * técnicas. Dos pasos:
 *   Paso 1: Picker — lista de 5 indicadores (MA / RSI / MACD /
 *           Bandas de Bollinger / Volumen) con icono squircle 40,
 *           label, descripción corta y chevron.
 *   Paso 2: Config — header back/X + scroll con secciones:
 *           Activo · Parámetros · Condición · Temporalidad ·
 *           Frecuencia · Vista previa. CTA sticky abajo.
 *
 * Slide horizontal entre paso 1 y paso 2 (220 ms ease-out).
 *
 * En modo EDIT (editingAlert prop), saltea el paso 1 y abre directo
 * en el paso 2 del tipo correspondiente con los parámetros pre-cargados.
 */

interface Props {
  visible: boolean;
  asset: Asset;
  /** Si está, sheet abre en EDIT mode salteando el paso 1. */
  editingAlert?: IndicatorAlert;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

const TIMEFRAMES: Timeframe[] = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1H",
  "4H",
  "1D",
  "1W",
];

/* Estado interno de configuración — todos los campos posibles, vivos
 * a la vez. El input final lo armamos según selectedType. Defaults
 * por la spec. */
interface ConfigState {
  timeframe: Timeframe;
  frequency: IndicatorFrequency;
  // MA
  maVariant: "sma" | "ema";
  maPeriod: number;
  maCondition: "above" | "below";
  // RSI
  rsiThreshold: number;
  rsiPeriod: number;
  rsiCondition: "above" | "below";
  // MACD
  macdEmaFast: number;
  macdEmaSlow: number;
  macdSignal: number;
  macdCondition:
    | "bullish_signal"
    | "bearish_signal"
    | "zero_up"
    | "zero_down";
  // Bollinger
  bbPeriod: number;
  bbDeviation: number;
  bbCondition: "touch_upper" | "touch_lower" | "squeeze";
  // Volume
  volumeMultiplier: number;
}

const DEFAULT_CONFIG: ConfigState = {
  timeframe: "1D",
  frequency: "once",
  maVariant: "sma",
  maPeriod: 50,
  maCondition: "above",
  rsiThreshold: 70,
  rsiPeriod: 14,
  rsiCondition: "above",
  macdEmaFast: 12,
  macdEmaSlow: 26,
  macdSignal: 9,
  macdCondition: "bullish_signal",
  bbPeriod: 20,
  bbDeviation: 2,
  bbCondition: "touch_upper",
  volumeMultiplier: 2,
};

export function IndicatorSheet({
  visible,
  asset,
  editingAlert,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const { createIndicator, updateIndicator, removeIndicator } = useAlerts();
  const { show: showToast } = useToast();
  const isEditing = !!editingAlert;

  /* Step 1 = picker, Step 2 = config form. En edit saltea a step 2. */
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<IndicatorType | null>(
    null,
  );
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Hidratación al abrir.
  useEffect(() => {
    if (visible) {
      if (editingAlert) {
        setStep(2);
        setSelectedType(editingAlert.type);
        setConfig(configFromAlert(editingAlert));
        setAdvancedOpen(
          editingAlert.type === "macd" || editingAlert.type === "bollinger",
        );
      } else {
        setStep(1);
        setSelectedType(null);
        setConfig(DEFAULT_CONFIG);
        setAdvancedOpen(false);
      }
    }
  }, [visible, editingAlert]);

  /* ─── Animación bottom sheet ─── */
  const translateY = useSharedValue(windowH);
  const backdropOpacity = useSharedValue(0);
  const stepProgress = useSharedValue(isEditing ? 1 : 0);

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

  // Animar el slide horizontal cuando cambia el step.
  useEffect(() => {
    stepProgress.value = withTiming(step === 1 ? 0 : 1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [step, stepProgress]);

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
  // Track de los 2 panels horizontalmente.
  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -stepProgress.value * windowW }],
  }));

  /* ─── Handler de creación / update ─── */
  const handleSubmit = async () => {
    if (!selectedType) return;
    setSubmitting(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const input = buildInputFromConfig(selectedType, asset.ticker, config);
      if (isEditing && editingAlert) {
        await updateIndicator(editingAlert.id, input);
      } else {
        await createIndicator(input);
      }
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      showToast(isEditing ? "Alerta actualizada" : "Alerta creada", {
        variant: "success",
      });
      dismiss();
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "No pudimos guardar la alerta";
      showToast(msg, { variant: "error" });
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

  const handlePickType = (t: IndicatorType) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedType(t);
    setAdvancedOpen(t === "macd" || t === "bollinger" ? false : false);
    setStep(2);
  };

  const previewSentence = useMemo(() => {
    if (!selectedType) return "";
    return describePreview(selectedType, asset.ticker, config);
  }, [selectedType, asset.ticker, config]);

  /* MACD EMA validation — para mostrar warning inline. */
  const macdInvalid =
    selectedType === "macd" && config.macdEmaSlow <= config.macdEmaFast;

  const ctaEnabled = !!selectedType && !macdInvalid && !submitting;
  const ctaLabel = isEditing ? "Guardar cambios" : "Crear alerta";

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
              paddingBottom: insets.bottom + 8,
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

          {/* Slider horizontal entre paso 1 y paso 2. */}
          <View style={{ overflow: "hidden", flex: 1 }}>
            <Animated.View
              style={[{ flexDirection: "row", width: windowW * 2 }, sliderStyle]}
            >
              {/* Paso 1 — Picker */}
              <View style={{ width: windowW, paddingHorizontal: 20 }}>
                <View style={s.headerPicker}>
                  <Text style={[s.title, { color: c.text }]}>
                    Elegir indicador
                  </Text>
                  <Text style={[s.subtitle, { color: c.textMuted }]}>
                    Seleccioná el indicador que querés monitorear
                  </Text>
                </View>
                <ScrollView
                  contentContainerStyle={{ paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  <PickerRow
                    icon="trending-up"
                    title="Media Móvil (MA)"
                    description="Cuando el precio cruza el promedio"
                    onPress={() => handlePickType("ma")}
                    c={c}
                  />
                  <PickerRow
                    icon="activity"
                    title="RSI"
                    description="Sobrecompra / sobreventa"
                    onPress={() => handlePickType("rsi")}
                    c={c}
                  />
                  <PickerRow
                    icon="git-merge"
                    title="MACD"
                    description="Cruces de línea y señal"
                    onPress={() => handlePickType("macd")}
                    c={c}
                  />
                  <PickerRow
                    icon="bar-chart-2"
                    title="Bandas de Bollinger"
                    description="Volatilidad y rangos"
                    onPress={() => handlePickType("bollinger")}
                    c={c}
                  />
                  <PickerRow
                    icon="bar-chart"
                    title="Volumen"
                    description="Picos vs promedio"
                    onPress={() => handlePickType("volume")}
                    c={c}
                  />
                </ScrollView>
              </View>

              {/* Paso 2 — Config */}
              <View style={{ width: windowW, paddingHorizontal: 20 }}>
                <View style={s.headerConfig}>
                  <Pressable
                    onPress={() => {
                      if (isEditing) {
                        // En edit, "atrás" cierra el sheet (no hay paso 1).
                        dismiss();
                      } else {
                        Haptics.selectionAsync().catch(() => {});
                        setStep(1);
                      }
                    }}
                    hitSlop={10}
                    style={s.headerSideBtn}
                    accessibilityLabel="Atrás"
                  >
                    <Feather
                      name={isEditing ? "x" : "arrow-left"}
                      size={20}
                      color={c.text}
                    />
                  </Pressable>
                  <Text
                    style={[s.headerTitle, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {selectedType
                      ? indicatorTitle(selectedType)
                      : "Configurar"}
                  </Text>
                  {isEditing ? (
                    <Pressable
                      onPress={handleDelete}
                      hitSlop={6}
                      style={({ pressed }) => [
                        s.deleteBtn,
                        {
                          borderColor: c.red,
                          opacity: pressed ? 0.6 : 1,
                        },
                      ]}
                      accessibilityLabel="Eliminar alerta"
                    >
                      <Text style={[s.deleteBtnText, { color: c.red }]}>
                        Eliminar
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={dismiss}
                      hitSlop={10}
                      style={s.headerSideBtn}
                      accessibilityLabel="Cerrar"
                    >
                      <Feather name="x" size={20} color={c.text} />
                    </Pressable>
                  )}
                </View>

                <ScrollView
                  contentContainerStyle={{ paddingBottom: 120 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Sección: Activo */}
                  <SectionLabel label="Activo" c={c} />
                  <View
                    style={[
                      s.assetRow,
                      { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                  >
                    <View>
                      <Text style={[s.assetTicker, { color: c.text }]}>
                        {asset.ticker}
                      </Text>
                      <Text
                        style={[s.assetName, { color: c.textMuted }]}
                        numberOfLines={1}
                      >
                        {asset.name}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={c.textFaint}
                    />
                  </View>

                  {/* Parámetros específicos por tipo */}
                  {selectedType === "ma" ? (
                    <MAParams config={config} setConfig={setConfig} c={c} />
                  ) : null}
                  {selectedType === "rsi" ? (
                    <RSIParams config={config} setConfig={setConfig} c={c} />
                  ) : null}
                  {selectedType === "macd" ? (
                    <MACDParams
                      config={config}
                      setConfig={setConfig}
                      open={advancedOpen}
                      setOpen={setAdvancedOpen}
                      invalid={macdInvalid}
                      c={c}
                    />
                  ) : null}
                  {selectedType === "bollinger" ? (
                    <BBParams
                      config={config}
                      setConfig={setConfig}
                      open={advancedOpen}
                      setOpen={setAdvancedOpen}
                      c={c}
                    />
                  ) : null}
                  {selectedType === "volume" ? (
                    <VolumeParams config={config} setConfig={setConfig} c={c} />
                  ) : null}

                  {/* Sección: Condición */}
                  {selectedType ? (
                    <ConditionSection
                      type={selectedType}
                      config={config}
                      setConfig={setConfig}
                      c={c}
                    />
                  ) : null}

                  {/* Sección: Temporalidad */}
                  <SectionLabel label="Temporalidad" c={c} />
                  <View style={s.chipsRow}>
                    {TIMEFRAMES.map((tf) => {
                      const active = config.timeframe === tf;
                      return (
                        <Pressable
                          key={tf}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setConfig({ ...config, timeframe: tf });
                          }}
                          style={({ pressed }) => [
                            s.chip,
                            {
                              borderColor: active ? c.text : c.border,
                              backgroundColor: active
                                ? c.text
                                : "transparent",
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
                            {tf}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Sección: Frecuencia */}
                  <SectionLabel label="Frecuencia" c={c} />
                  <RadioRow
                    label="Solo una vez"
                    active={config.frequency === "once"}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setConfig({ ...config, frequency: "once" });
                    }}
                    c={c}
                  />
                  <RadioRow
                    label="Cada vez que ocurra"
                    active={config.frequency === "always"}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setConfig({ ...config, frequency: "always" });
                    }}
                    c={c}
                  />

                  {/* Sección: Vista previa */}
                  <SectionLabel label="Vista previa" c={c} />
                  <View
                    style={[
                      s.preview,
                      {
                        backgroundColor: c.surface,
                        borderLeftColor: c.brand,
                      },
                    ]}
                  >
                    <Text
                      style={[s.previewText, { color: c.text }]}
                    >
                      {previewSentence}
                    </Text>
                  </View>

                  {/* Warning MACD inline */}
                  {macdInvalid ? (
                    <View style={[s.warning, { borderColor: c.red }]}>
                      <Feather
                        name="alert-triangle"
                        size={14}
                        color={c.red}
                      />
                      <Text
                        style={[s.warningText, { color: c.red }]}
                      >
                        La EMA lenta tiene que ser mayor a la EMA rápida.
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>

                {/* CTA sticky abajo */}
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
                        opacity: !ctaEnabled ? 0.5 : pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[s.ctaText, { color: c.bg }]}>
                      {ctaLabel}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────── */

type ColorMap = ReturnType<typeof useTheme>["c"];

function PickerRow({
  icon,
  title,
  description,
  onPress,
  c,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  c: ColorMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.pickerRow,
        {
          backgroundColor: pressed ? c.surfaceHover : "transparent",
        },
      ]}
    >
      <View
        style={[s.pickerIcon, { backgroundColor: c.surface }]}
      >
        <Feather name={icon} size={18} color={c.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.pickerTitle, { color: c.text }]}>{title}</Text>
        <Text
          style={[s.pickerDesc, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {description}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={c.textFaint} />
    </Pressable>
  );
}

function SectionLabel({ label, c }: { label: string; c: ColorMap }) {
  return (
    <Text style={[s.sectionLabel, { color: c.textMuted }]}>
      {label.toUpperCase()}
    </Text>
  );
}

function RadioRow({
  label,
  active,
  onPress,
  c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  c: ColorMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.radioRow,
        {
          backgroundColor: pressed ? c.surfaceHover : "transparent",
          borderColor: c.border,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <View
        style={[
          s.radioDot,
          { borderColor: active ? c.brand : c.borderStrong },
        ]}
      >
        {active ? (
          <View style={[s.radioDotInner, { backgroundColor: c.brand }]} />
        ) : null}
      </View>
      <Text style={[s.radioLabel, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChipsRow({
  values,
  active,
  onPress,
  c,
  format,
}: {
  values: number[];
  active: number;
  onPress: (v: number) => void;
  c: ColorMap;
  format?: (v: number) => string;
}) {
  return (
    <View style={s.chipsRow}>
      {values.map((v) => {
        const isActive = active === v;
        return (
          <Pressable
            key={v}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPress(v);
            }}
            style={({ pressed }) => [
              s.chip,
              {
                borderColor: isActive ? c.text : c.border,
                backgroundColor: isActive ? c.text : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[
                s.chipText,
                { color: isActive ? c.bg : c.text },
              ]}
            >
              {format ? format(v) : v.toString()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ParamRow({
  label,
  children,
  c,
}: {
  label: string;
  children: React.ReactNode;
  c: ColorMap;
}) {
  return (
    <View style={s.paramRow}>
      <Text style={[s.paramLabel, { color: c.text }]}>{label}</Text>
      {children}
    </View>
  );
}

/* ─── MA params ─── */
function MAParams({
  config,
  setConfig,
  c,
}: {
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  c: ColorMap;
}) {
  return (
    <View>
      <SectionLabel label="Tipo" c={c} />
      <View
        style={[s.segmented, { backgroundColor: c.surfaceHover }]}
      >
        {(["sma", "ema"] as const).map((v) => {
          const active = config.maVariant === v;
          return (
            <Pressable
              key={v}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setConfig({ ...config, maVariant: v });
              }}
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
                    fontFamily: active
                      ? fontFamily[700]
                      : fontFamily[600],
                  },
                ]}
              >
                {v.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionLabel label="Período" c={c} />
      <ChipsRow
        values={[9, 20, 50, 100, 200]}
        active={config.maPeriod}
        onPress={(v) => setConfig({ ...config, maPeriod: v })}
        c={c}
      />
      <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
        <Stepper
          value={config.maPeriod}
          onChange={(v) => setConfig({ ...config, maPeriod: v })}
          min={5}
          max={500}
          step={1}
        />
      </View>
    </View>
  );
}

/* ─── RSI params ─── */
function RSIParams({
  config,
  setConfig,
  c,
}: {
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  c: ColorMap;
}) {
  return (
    <View>
      <SectionLabel label="Umbral" c={c} />
      <View style={s.chipsRow}>
        {[
          { v: 30, label: "30 Sobreventa" },
          { v: 50, label: "50 Neutro" },
          { v: 70, label: "70 Sobrecompra" },
        ].map((opt) => {
          const active = config.rsiThreshold === opt.v;
          return (
            <Pressable
              key={opt.v}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setConfig({ ...config, rsiThreshold: opt.v });
              }}
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
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
        <Stepper
          value={config.rsiThreshold}
          onChange={(v) => setConfig({ ...config, rsiThreshold: v })}
          min={0}
          max={100}
          step={1}
        />
      </View>

      <SectionLabel label="Período" c={c} />
      <ChipsRow
        values={[7, 9, 14, 21]}
        active={config.rsiPeriod}
        onPress={(v) => setConfig({ ...config, rsiPeriod: v })}
        c={c}
      />
      <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
        <Stepper
          value={config.rsiPeriod}
          onChange={(v) => setConfig({ ...config, rsiPeriod: v })}
          min={2}
          max={50}
          step={1}
        />
      </View>
    </View>
  );
}

/* ─── MACD params (avanzado collapsable) ─── */
function MACDParams({
  config,
  setConfig,
  open,
  setOpen,
  invalid,
  c,
}: {
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  open: boolean;
  setOpen: (next: boolean) => void;
  invalid: boolean;
  c: ColorMap;
}) {
  return (
    <View>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setOpen(!open);
        }}
        style={s.advancedToggle}
      >
        <Text style={[s.advancedToggleText, { color: c.brand }]}>
          {open ? "Ocultar avanzado" : "Avanzado"}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          color={c.brand}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            s.advancedBox,
            {
              backgroundColor: c.surface,
              borderColor: invalid ? c.red : c.border,
            },
          ]}
        >
          <ParamRow label="EMA rápida" c={c}>
            <Stepper
              value={config.macdEmaFast}
              onChange={(v) => setConfig({ ...config, macdEmaFast: v })}
              min={2}
              max={50}
              step={1}
            />
          </ParamRow>
          <ParamRow label="EMA lenta" c={c}>
            <Stepper
              value={config.macdEmaSlow}
              onChange={(v) => setConfig({ ...config, macdEmaSlow: v })}
              min={5}
              max={100}
              step={1}
            />
          </ParamRow>
          <ParamRow label="Señal" c={c}>
            <Stepper
              value={config.macdSignal}
              onChange={(v) => setConfig({ ...config, macdSignal: v })}
              min={2}
              max={50}
              step={1}
            />
          </ParamRow>
        </View>
      ) : null}
    </View>
  );
}

/* ─── Bollinger params (avanzado collapsable) ─── */
function BBParams({
  config,
  setConfig,
  open,
  setOpen,
  c,
}: {
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  open: boolean;
  setOpen: (next: boolean) => void;
  c: ColorMap;
}) {
  return (
    <View>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setOpen(!open);
        }}
        style={s.advancedToggle}
      >
        <Text style={[s.advancedToggleText, { color: c.brand }]}>
          {open ? "Ocultar avanzado" : "Avanzado"}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          color={c.brand}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            s.advancedBox,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <ParamRow label="Período" c={c}>
            <Stepper
              value={config.bbPeriod}
              onChange={(v) => setConfig({ ...config, bbPeriod: v })}
              min={5}
              max={100}
              step={1}
            />
          </ParamRow>
          <ParamRow label="Desviación σ" c={c}>
            <Stepper
              value={config.bbDeviation}
              onChange={(v) => setConfig({ ...config, bbDeviation: v })}
              min={0.5}
              max={5}
              step={0.5}
              decimals={1}
            />
          </ParamRow>
        </View>
      ) : null}
    </View>
  );
}

/* ─── Volume params ─── */
function VolumeParams({
  config,
  setConfig,
  c,
}: {
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  c: ColorMap;
}) {
  return (
    <View>
      <SectionLabel label="Multiplicador" c={c} />
      <ChipsRow
        values={[1.5, 2, 3, 5]}
        active={config.volumeMultiplier}
        onPress={(v) => setConfig({ ...config, volumeMultiplier: v })}
        c={c}
        format={(v) => `${v}x`}
      />
      <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
        <Stepper
          value={config.volumeMultiplier}
          onChange={(v) => setConfig({ ...config, volumeMultiplier: v })}
          min={1.1}
          max={20}
          step={0.1}
          decimals={1}
          suffix="x"
        />
      </View>
    </View>
  );
}

/* ─── Sección condición — varía por tipo ─── */
function ConditionSection({
  type,
  config,
  setConfig,
  c,
}: {
  type: IndicatorType;
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  c: ColorMap;
}) {
  if (type === "ma") {
    return (
      <View>
        <SectionLabel label="Condición" c={c} />
        <RadioRow
          label="Precio cruza por encima"
          active={config.maCondition === "above"}
          onPress={() => setConfig({ ...config, maCondition: "above" })}
          c={c}
        />
        <RadioRow
          label="Precio cruza por debajo"
          active={config.maCondition === "below"}
          onPress={() => setConfig({ ...config, maCondition: "below" })}
          c={c}
        />
      </View>
    );
  }
  if (type === "rsi") {
    return (
      <View>
        <SectionLabel label="Condición" c={c} />
        <RadioRow
          label="Cruza por encima del umbral"
          active={config.rsiCondition === "above"}
          onPress={() => setConfig({ ...config, rsiCondition: "above" })}
          c={c}
        />
        <RadioRow
          label="Cruza por debajo del umbral"
          active={config.rsiCondition === "below"}
          onPress={() => setConfig({ ...config, rsiCondition: "below" })}
          c={c}
        />
      </View>
    );
  }
  if (type === "macd") {
    return (
      <View>
        <SectionLabel label="Condición" c={c} />
        <RadioRow
          label="Cruce alcista (MACD cruza señal al alza)"
          active={config.macdCondition === "bullish_signal"}
          onPress={() =>
            setConfig({ ...config, macdCondition: "bullish_signal" })
          }
          c={c}
        />
        <RadioRow
          label="Cruce bajista (MACD cruza señal a la baja)"
          active={config.macdCondition === "bearish_signal"}
          onPress={() =>
            setConfig({ ...config, macdCondition: "bearish_signal" })
          }
          c={c}
        />
        <RadioRow
          label="MACD cruza línea cero al alza"
          active={config.macdCondition === "zero_up"}
          onPress={() =>
            setConfig({ ...config, macdCondition: "zero_up" })
          }
          c={c}
        />
        <RadioRow
          label="MACD cruza línea cero a la baja"
          active={config.macdCondition === "zero_down"}
          onPress={() =>
            setConfig({ ...config, macdCondition: "zero_down" })
          }
          c={c}
        />
      </View>
    );
  }
  if (type === "bollinger") {
    return (
      <View>
        <SectionLabel label="Condición" c={c} />
        <RadioRow
          label="Precio toca banda superior"
          active={config.bbCondition === "touch_upper"}
          onPress={() =>
            setConfig({ ...config, bbCondition: "touch_upper" })
          }
          c={c}
        />
        <RadioRow
          label="Precio toca banda inferior"
          active={config.bbCondition === "touch_lower"}
          onPress={() =>
            setConfig({ ...config, bbCondition: "touch_lower" })
          }
          c={c}
        />
        <RadioRow
          label="Bandas se contraen (squeeze)"
          active={config.bbCondition === "squeeze"}
          onPress={() =>
            setConfig({ ...config, bbCondition: "squeeze" })
          }
          c={c}
        />
      </View>
    );
  }
  if (type === "volume") {
    return (
      <View>
        <SectionLabel label="Condición" c={c} />
        <RadioRow
          label="Volumen supera múltiplo del promedio"
          active={true}
          onPress={() => {}}
          c={c}
        />
      </View>
    );
  }
  return null;
}

/* ─── Helpers de conversión config ↔ alert ─── */

function configFromAlert(a: IndicatorAlert): ConfigState {
  const base = { ...DEFAULT_CONFIG, timeframe: a.timeframe, frequency: a.frequency };
  if (a.type === "ma") {
    return {
      ...base,
      maVariant: a.variant,
      maPeriod: a.period,
      maCondition: a.condition,
    };
  }
  if (a.type === "rsi") {
    return {
      ...base,
      rsiThreshold: a.threshold,
      rsiPeriod: a.period,
      rsiCondition: a.condition,
    };
  }
  if (a.type === "macd") {
    return {
      ...base,
      macdEmaFast: a.emaFast,
      macdEmaSlow: a.emaSlow,
      macdSignal: a.signal,
      macdCondition: a.condition,
    };
  }
  if (a.type === "bollinger") {
    return {
      ...base,
      bbPeriod: a.period,
      bbDeviation: a.deviation,
      bbCondition: a.condition,
    };
  }
  // volume
  return {
    ...base,
    volumeMultiplier: a.multiplier,
  };
}

function buildInputFromConfig(
  type: IndicatorType,
  assetId: string,
  cfg: ConfigState,
): CreateIndicatorAlertInput {
  const common = { assetId, timeframe: cfg.timeframe, frequency: cfg.frequency };
  if (type === "ma") {
    return {
      type: "ma",
      ...common,
      variant: cfg.maVariant,
      period: cfg.maPeriod,
      condition: cfg.maCondition,
    };
  }
  if (type === "rsi") {
    return {
      type: "rsi",
      ...common,
      threshold: cfg.rsiThreshold,
      period: cfg.rsiPeriod,
      condition: cfg.rsiCondition,
    };
  }
  if (type === "macd") {
    return {
      type: "macd",
      ...common,
      emaFast: cfg.macdEmaFast,
      emaSlow: cfg.macdEmaSlow,
      signal: cfg.macdSignal,
      condition: cfg.macdCondition,
    };
  }
  if (type === "bollinger") {
    return {
      type: "bollinger",
      ...common,
      period: cfg.bbPeriod,
      deviation: cfg.bbDeviation,
      condition: cfg.bbCondition,
    };
  }
  return {
    type: "volume",
    ...common,
    multiplier: cfg.volumeMultiplier,
  };
}

function indicatorTitle(t: IndicatorType): string {
  if (t === "ma") return "Media Móvil";
  if (t === "rsi") return "RSI";
  if (t === "macd") return "MACD";
  if (t === "bollinger") return "Bandas de Bollinger";
  return "Volumen";
}

/* ─── Natural language preview ──────────────────────────────────── */

function describePreview(
  type: IndicatorType,
  ticker: string,
  cfg: ConfigState,
): string {
  const tf = cfg.timeframe;
  if (type === "ma") {
    const variantLabel = cfg.maVariant.toUpperCase();
    const dir =
      cfg.maCondition === "above"
        ? "cruce por encima"
        : "cruce por debajo";
    return `Te avisaremos cuando el precio de ${ticker} ${dir} de la ${variantLabel}(${cfg.maPeriod}) en ${tf}.`;
  }
  if (type === "rsi") {
    const dir =
      cfg.rsiCondition === "above" ? "suba por encima" : "baje por debajo";
    return `Te avisaremos cuando el RSI(${cfg.rsiPeriod}) de ${ticker} ${dir} de ${cfg.rsiThreshold} en ${tf}.`;
  }
  if (type === "macd") {
    if (cfg.macdCondition === "bullish_signal")
      return `Te avisaremos cuando el MACD cruce la línea de señal al alza para ${ticker} en ${tf}.`;
    if (cfg.macdCondition === "bearish_signal")
      return `Te avisaremos cuando el MACD cruce la línea de señal a la baja para ${ticker} en ${tf}.`;
    if (cfg.macdCondition === "zero_up")
      return `Te avisaremos cuando el MACD cruce la línea cero al alza para ${ticker} en ${tf}.`;
    return `Te avisaremos cuando el MACD cruce la línea cero a la baja para ${ticker} en ${tf}.`;
  }
  if (type === "bollinger") {
    if (cfg.bbCondition === "touch_upper")
      return `Te avisaremos cuando el precio de ${ticker} toque la banda superior en ${tf}.`;
    if (cfg.bbCondition === "touch_lower")
      return `Te avisaremos cuando el precio de ${ticker} toque la banda inferior en ${tf}.`;
    return `Te avisaremos cuando las bandas de Bollinger de ${ticker} se contraigan (volatilidad baja) en ${tf}.`;
  }
  return `Te avisaremos cuando el volumen de ${ticker} supere ${cfg.volumeMultiplier}x el promedio en ${tf}.`;
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

  /* Header — paso 1 */
  headerPicker: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 4,
  },

  /* Header — paso 2 */
  headerConfig: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
    paddingBottom: 14,
    gap: 8,
  },
  headerSideBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1.4,
  },
  deleteBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.2,
  },

  /* Picker rows */
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderCurve: "continuous",
    borderRadius: radius.md,
  },
  pickerIcon: {
    width: 40,
    height: 40,
    borderCurve: "continuous",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  pickerDesc: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 2,
  },

  /* Sections */
  sectionLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
  },

  /* Asset row */
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
  },
  assetTicker: {
    fontFamily: fontFamily[800],
    fontSize: 15,
    letterSpacing: -0.3,
  },
  assetName: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 2,
  },

  /* Radio */
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },

  /* Chips + segmented */
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
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

  /* Param rows in advanced box */
  paramRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  paramLabel: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  advancedToggleText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  advancedBox: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 4,
  },

  /* Preview card */
  preview: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderLeftWidth: 3,
  },
  previewText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },

  /* Inline warning */
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
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
