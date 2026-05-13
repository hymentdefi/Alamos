import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  FadeIn,
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
import { MAIndicatorIllustration } from "./illustrations/MAIndicatorIllustration";
import { EMAIndicatorIllustration } from "./illustrations/EMAIndicatorIllustration";
import { RSIIndicatorIllustration } from "./illustrations/RSIIndicatorIllustration";
import { MACDIndicatorIllustration } from "./illustrations/MACDIndicatorIllustration";
import { BollingerIndicatorIllustration } from "./illustrations/BollingerIndicatorIllustration";
import { VolumeIndicatorIllustration } from "./illustrations/VolumeIndicatorIllustration";

/**
 * IndicatorSheet — sheet de creación/edición de alertas técnicas en
 * dos pasos.
 *
 *   Paso 1 — Picker: lista de 6 indicadores con icono, nombre y
 *            descripción corta.
 *
 *   Paso 2 — Config: hero rectangular con ilustración + statement
 *            "Te avisaremos cuando ..." + cards "Señal" y "Ejecución"
 *            con todos los controles siempre visibles (no accordion).
 *
 * Slide horizontal 220ms entre paso 1 y paso 2.
 * En EDIT: arranca directamente en paso 2 del tipo correspondiente
 * con todos los parámetros pre-cargados.
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
  /* Altura compartida con AlertSheet — ambos sheets se sienten
   * VISUALMENTE iguales. Si tocás esta fórmula, ESPEJALA en
   * AlertSheet.tsx. */
  const SHEET_HEIGHT = Math.min(
    windowH * 0.9,
    720 + insets.bottom,
  );
  const { createIndicator, updateIndicator } = useAlerts();
  const { show: showToast } = useToast();
  const isEditing = !!editingAlert;

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<IndicatorType | null>(
    null,
  );
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [submitting, setSubmitting] = useState(false);

  // Hidratación al abrir.
  useEffect(() => {
    if (visible) {
      if (editingAlert) {
        setStep(2);
        setSelectedType(editingAlert.type);
        setConfig(configFromAlert(editingAlert));
      } else {
        setStep(1);
        setSelectedType(null);
        setConfig(DEFAULT_CONFIG);
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

  /* Modo del drag — se commitea al primer movimiento de >10px para
   * que vertical (dismiss) y horizontal (back a paso 1) no peleen. */
  const dragMode = useSharedValue<"idle" | "vertical" | "horizontal">(
    "idle",
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
      "worklet";
      dragMode.value = "idle";
    })
    .onUpdate((e) => {
      "worklet";
      if (dragMode.value === "idle") {
        const absX = Math.abs(e.translationX);
        const absY = Math.abs(e.translationY);
        const canSwipeBack = stepProgress.value === 1 && !isEditing;
        if (canSwipeBack && absX > 10 && absX > absY && e.translationX > 0) {
          dragMode.value = "horizontal";
        } else if (absY > 10 && e.translationY > 0) {
          dragMode.value = "vertical";
        }
      }
      if (dragMode.value === "horizontal") {
        stepProgress.value = Math.max(
          0,
          Math.min(1, 1 - e.translationX / windowW),
        );
      } else if (dragMode.value === "vertical" && e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = Math.max(0, 1 - e.translationY / windowH);
      }
    })
    .onEnd((e) => {
      "worklet";
      if (dragMode.value === "horizontal") {
        const shouldGoBack =
          e.translationX > windowW * 0.3 || e.velocityX > 600;
        if (shouldGoBack) {
          stepProgress.value = withTiming(0, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
          });
          runOnJS(setStep)(1);
        } else {
          stepProgress.value = withTiming(1, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
          });
        }
      } else {
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
      }
      dragMode.value = "idle";
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -stepProgress.value * windowW }],
  }));

  /* ─── Handlers ─── */

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

  const handlePickType = (t: IndicatorType) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedType(t);
    setStep(2);
  };

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
              paddingBottom: insets.bottom + 18,
              height: SHEET_HEIGHT,
            },
            sheetStyle,
          ]}
        >
          <View style={s.grabber}>
            <View
              style={[s.grabberPill, { backgroundColor: c.borderStrong }]}
            />
          </View>

          <View style={{ overflow: "hidden", flex: 1 }}>
            <Animated.View
              style={[
                { flexDirection: "row", width: windowW * 2, flex: 1 },
                sliderStyle,
              ]}
            >
              {/* ──────── Paso 1: Picker ──────── */}
              <View style={{ width: windowW }}>
                <View style={s.pickerHeader}>
                  <Text style={[s.pickerTitle, { color: c.text }]}>
                    Elegir indicador
                  </Text>
                  <Text style={[s.pickerSubtitle, { color: c.textMuted }]}>
                    Seleccioná el indicador técnico sobre el que querés
                    recibir alertas
                  </Text>
                </View>
                <ScrollView
                  contentContainerStyle={{ paddingBottom: 8 }}
                  showsVerticalScrollIndicator={false}
                  bounces
                  alwaysBounceVertical
                  overScrollMode="always"
                >
                  {/* ── Tendencia ── */}
                  <Text style={[s.pickerSection, { color: c.textMuted }]}>
                    TENDENCIA
                  </Text>
                  <PickerRow
                    icon={() => <MAIndicatorIllustration size={56} />}
                    title="Media Móvil Simple"
                    description="Promedio histórico del precio. Cuando lo cruza, puede indicar un cambio de tendencia."
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setConfig({ ...DEFAULT_CONFIG, maVariant: "sma" });
                      setSelectedType("ma");
                      setStep(2);
                    }}
                    c={c}
                  />
                  <PickerRow
                    icon={() => <EMAIndicatorIllustration size={56} />}
                    title="Media Móvil Exponencial"
                    description="Promedio que reacciona más rápido al precio. Suele detectar cambios de tendencia antes."
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setConfig({
                        ...DEFAULT_CONFIG,
                        maVariant: "ema",
                        maPeriod: 20,
                      });
                      setSelectedType("ma");
                      setStep(2);
                    }}
                    c={c}
                  />

                  {/* ── Momentum ── */}
                  <Text
                    style={[
                      s.pickerSection,
                      s.pickerSectionTight,
                      { color: c.textMuted },
                    ]}
                  >
                    MOMENTUM
                  </Text>
                  <PickerRow
                    icon={() => <RSIIndicatorIllustration size={56} />}
                    title="RSI"
                    description="Detecta sobrecompra y sobreventa. Puede anticipar posibles reversiones del precio."
                    onPress={() => handlePickType("rsi")}
                    c={c}
                  />
                  <PickerRow
                    icon={() => <MACDIndicatorIllustration size={56} />}
                    title="MACD"
                    description="Mide la fuerza de la tendencia. Puede señalar cambios de dirección antes de que ocurran."
                    onPress={() => handlePickType("macd")}
                    c={c}
                  />

                  {/* ── Volatilidad y volumen ── */}
                  <Text
                    style={[
                      s.pickerSection,
                      s.pickerSectionTight,
                      { color: c.textMuted },
                    ]}
                  >
                    VOLATILIDAD Y VOLUMEN
                  </Text>
                  <PickerRow
                    icon={() => <BollingerIndicatorIllustration size={56} />}
                    title="Bandas de Bollinger"
                    description="Marca el rango normal del precio. Salirse puede indicar un movimiento fuera de lo común."
                    onPress={() => handlePickType("bollinger")}
                    c={c}
                  />
                  <PickerRow
                    icon={() => <VolumeIndicatorIllustration size={56} />}
                    title="Volumen"
                    description="Cuánto dinero se está operando. Un pico suele anticipar o confirmar un movimiento fuerte."
                    onPress={() => handlePickType("volume")}
                    c={c}
                  />
                </ScrollView>
              </View>

              {/* ──────── Paso 2: Config flat rows ──────── */}
              <View style={{ width: windowW, flex: 1 }}>
                <View style={s.configHeader}>
                  {!isEditing ? (
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setStep(1);
                      }}
                      hitSlop={12}
                      accessibilityLabel="Volver al selector de indicador"
                      accessibilityRole="button"
                    >
                      <Feather
                        name="chevron-left"
                        size={22}
                        color={c.text}
                      />
                    </Pressable>
                  ) : null}
                  <Text
                    style={[s.configTitle, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {selectedType
                      ? indicatorTitle(selectedType, config)
                      : "Configurar"}
                  </Text>
                </View>

                <ScrollView
                  contentContainerStyle={{ paddingBottom: 130 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* HERO — rectángulo full-width con tint brand sutil
                      conteniendo la ilustración 3D del indicador. */}
                  {selectedType ? (
                    <Animated.View
                      key={`hero-${isEditing ? "edit" : "create"}`}
                      entering={
                        isEditing
                          ? FadeIn.duration(180)
                          : FadeIn.duration(220).delay(0)
                      }
                      style={[
                        s.heroRect,
                        { backgroundColor: `${c.brand}10` },
                      ]}
                    >
                      {selectedType === "ma" ? (
                        config.maVariant === "ema" ? (
                          <EMAIndicatorIllustration size={88} />
                        ) : (
                          <MAIndicatorIllustration size={88} />
                        )
                      ) : selectedType === "rsi" ? (
                        <RSIIndicatorIllustration size={88} />
                      ) : selectedType === "macd" ? (
                        <MACDIndicatorIllustration size={88} />
                      ) : selectedType === "bollinger" ? (
                        <BollingerIndicatorIllustration size={88} />
                      ) : (
                        <VolumeIndicatorIllustration size={88} />
                      )}
                    </Animated.View>
                  ) : null}

                  {/* STATEMENT — eyebrow small + sentence con tokens
                      coloreados en c.brand. Reemplaza el anterior centered
                      sin eyebrow. */}
                  {selectedType ? (
                    <Animated.View
                      key={`sentence-${isEditing ? "edit" : "create"}`}
                      entering={
                        isEditing
                          ? FadeIn.duration(180)
                          : FadeIn.duration(220).delay(80)
                      }
                      style={s.statementBlock}
                    >
                      <Text
                        style={[s.statementEyebrow, { color: c.textMuted }]}
                      >
                        Te avisaremos cuando
                      </Text>
                      <PreviewSentence
                        type={selectedType}
                        ticker={asset.ticker}
                        config={config}
                        c={c}
                      />
                    </Animated.View>
                  ) : null}

                  {selectedType ? (
                    <Animated.View
                      entering={
                        isEditing
                          ? FadeIn.duration(180)
                          : FadeIn.duration(220).delay(120)
                      }
                    >
                      <SignalCard
                        type={selectedType}
                        config={config}
                        setConfig={setConfig}
                        c={c}
                      />
                      <ExecutionCard
                        config={config}
                        setConfig={setConfig}
                        c={c}
                      />
                    </Animated.View>
                  ) : null}

                  {/* Warning MACD inline arriba del CTA si emaSlow
                      <= emaFast — pintado fuera del scroll area pero
                      antes del sticky CTA para que sea visible. */}
                </ScrollView>

                {/* Warning + CTA sticky abajo, sin chrome bar (sin
                    borderTop) — sit on c.bg como AlertSheet. */}
                <Animated.View
                  entering={
                    isEditing
                      ? FadeIn.duration(180)
                      : FadeIn.duration(220).delay(160)
                  }
                  style={s.ctaContainer}
                >
                  {macdInvalid ? (
                    <View
                      style={[
                        s.warning,
                        {
                          borderColor: c.red,
                          backgroundColor: c.bg,
                        },
                      ]}
                    >
                      <Feather
                        name="alert-triangle"
                        size={14}
                        color={c.red}
                      />
                      <Text style={[s.warningText, { color: c.red }]}>
                        La EMA lenta tiene que ser mayor a la EMA rápida.
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={handleSubmit}
                    disabled={!ctaEnabled}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      s.cta,
                      {
                        backgroundColor: c.brand,
                        opacity: !ctaEnabled
                          ? 0.5
                          : pressed
                            ? 0.85
                            : submitting
                              ? 0.7
                              : 1,
                        marginTop: 8,
                      },
                    ]}
                  >
                    <Text style={[s.ctaText, { color: c.onColor }]}>
                      {ctaLabel}
                    </Text>
                  </Pressable>
                </Animated.View>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

/* ─── Picker row del paso 1 ───────────────────────────────────── */

type ColorMap = ReturnType<typeof useTheme>["c"];

function PickerRow({
  icon,
  title,
  description,
  onPress,
  c,
}: {
  /** Render function para el icono — permite pasar tanto un Feather
   *  como una illustration custom. Se rendea en un slot 44×44 sin bg
   *  (las illustrations ya tienen su propia composición). */
  icon: () => React.ReactNode;
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
        { backgroundColor: pressed ? c.surfaceHover : "transparent" },
      ]}
    >
      <View style={s.pickerIcon}>{icon()}</View>
      <View style={{ flex: 1 }}>
        <Text style={[s.pickerRowTitle, { color: c.text }]}>{title}</Text>
        <Text
          style={[s.pickerRowDesc, { color: c.textMuted }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={c.textFaint} />
    </Pressable>
  );
}

/* ─── Preview sentence con segmentos + overflow handling ─────── */

/** Renderea la sentence preview con tokens highlightados en
 *  c.brand + fontFamily[800]. Si el texto total supera 80
 *  caracteres baja a 20/26 para que no rompa el layout en 4+
 *  líneas. */
function PreviewSentence({
  type,
  ticker,
  config,
  c,
}: {
  type: IndicatorType;
  ticker: string;
  config: ConfigState;
  c: ColorMap;
}) {
  const segments = previewSegments(type, ticker, config);
  const totalLength = segments.reduce((acc, s) => acc + s.text.length, 0);
  const compact = totalLength > 80;
  return (
    <Text
      style={[
        compact ? s.heroSentenceCompact : s.heroSentence,
        { color: c.text },
      ]}
    >
      {segments.map((seg, i) => (
        <Text
          key={`${i}-${seg.text}`}
          style={
            seg.highlight
              ? { fontFamily: fontFamily[800], color: c.brand }
              : { color: c.text }
          }
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

/* ─── Cards always-visible — SignalCard + ExecutionCard ───────── */

/** Card "Señal" — agrupa los parámetros que definen QUÉ disparará la
 *  alerta (período, condición, umbral, temporalidad). Todos los
 *  controles siempre visibles, no hay accordion. Varía por
 *  indicador. */
function SignalCard({
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
  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <Text style={[s.cardHeader, { color: c.textMuted }]}>Señal</Text>

      {type === "ma" ? (
        <>
          <ParamRow
            label="Período"
            c={c}
            right={
              <Stepper
                value={config.maPeriod}
                onChange={(v) => setConfig({ ...config, maPeriod: v })}
                min={5}
                max={500}
                step={1}
              />
            }
          >
            <ChipsRow
              chips={[9, 20, 50, 100, 200]}
              value={config.maPeriod}
              onChange={(v) => setConfig({ ...config, maPeriod: v })}
              c={c}
            />
          </ParamRow>
          <ParamRow label="Condición" c={c}>
            <Segmented
              options={[
                { value: "above", label: "Por encima" },
                { value: "below", label: "Por debajo" },
              ]}
              active={config.maCondition}
              onChange={(v) =>
                setConfig({
                  ...config,
                  maCondition: v as "above" | "below",
                })
              }
              c={c}
            />
          </ParamRow>
        </>
      ) : null}

      {type === "rsi" ? (
        <>
          <ParamRow
            label="Período"
            c={c}
            right={
              <Stepper
                value={config.rsiPeriod}
                onChange={(v) => setConfig({ ...config, rsiPeriod: v })}
                min={2}
                max={50}
                step={1}
              />
            }
          >
            <ChipsRow
              chips={[7, 9, 14, 21]}
              value={config.rsiPeriod}
              onChange={(v) => setConfig({ ...config, rsiPeriod: v })}
              c={c}
            />
          </ParamRow>
          <ParamRow
            label="Umbral"
            c={c}
            right={
              <Stepper
                value={config.rsiThreshold}
                onChange={(v) =>
                  setConfig({ ...config, rsiThreshold: v })
                }
                min={0}
                max={100}
                step={1}
              />
            }
          >
            <ChipsRow
              chips={[30, 50, 70]}
              value={config.rsiThreshold}
              onChange={(v) =>
                setConfig({ ...config, rsiThreshold: v })
              }
              c={c}
            />
          </ParamRow>
          <ParamRow label="Condición" c={c}>
            <Segmented
              options={[
                { value: "above", label: "Por encima" },
                { value: "below", label: "Por debajo" },
              ]}
              active={config.rsiCondition}
              onChange={(v) =>
                setConfig({
                  ...config,
                  rsiCondition: v as "above" | "below",
                })
              }
              c={c}
            />
          </ParamRow>
        </>
      ) : null}

      {type === "macd" ? (
        <>
          <ParamRow
            label="Rápida"
            c={c}
            right={
              <Stepper
                value={config.macdEmaFast}
                onChange={(v) =>
                  setConfig({ ...config, macdEmaFast: v })
                }
                min={2}
                max={50}
                step={1}
              />
            }
          />
          <ParamRow
            label="Lenta"
            c={c}
            right={
              <Stepper
                value={config.macdEmaSlow}
                onChange={(v) =>
                  setConfig({ ...config, macdEmaSlow: v })
                }
                min={5}
                max={100}
                step={1}
              />
            }
          />
          <ParamRow
            label="Señal"
            c={c}
            right={
              <Stepper
                value={config.macdSignal}
                onChange={(v) => setConfig({ ...config, macdSignal: v })}
                min={2}
                max={50}
                step={1}
              />
            }
          />
          <ParamRow label="Condición" c={c}>
            <OptionList
              options={[
                { value: "bullish_signal", label: "Cruce alcista" },
                { value: "bearish_signal", label: "Cruce bajista" },
                { value: "zero_up", label: "Cruza cero al alza" },
                { value: "zero_down", label: "Cruza cero a la baja" },
              ]}
              active={config.macdCondition}
              onChange={(v) =>
                setConfig({
                  ...config,
                  macdCondition: v as ConfigState["macdCondition"],
                })
              }
              c={c}
            />
          </ParamRow>
        </>
      ) : null}

      {type === "bollinger" ? (
        <>
          <ParamRow
            label="Período"
            c={c}
            right={
              <Stepper
                value={config.bbPeriod}
                onChange={(v) => setConfig({ ...config, bbPeriod: v })}
                min={5}
                max={100}
                step={1}
              />
            }
          />
          <ParamRow
            label="Desviación"
            c={c}
            right={
              <Stepper
                value={config.bbDeviation}
                onChange={(v) =>
                  setConfig({ ...config, bbDeviation: v })
                }
                min={0.5}
                max={5}
                step={0.5}
                decimals={1}
                suffix="σ"
              />
            }
          />
          <ParamRow label="Condición" c={c}>
            <OptionList
              options={[
                { value: "touch_upper", label: "Toca banda superior" },
                { value: "touch_lower", label: "Toca banda inferior" },
                { value: "squeeze", label: "Squeeze (volatilidad baja)" },
              ]}
              active={config.bbCondition}
              onChange={(v) =>
                setConfig({
                  ...config,
                  bbCondition: v as ConfigState["bbCondition"],
                })
              }
              c={c}
            />
          </ParamRow>
        </>
      ) : null}

      {type === "volume" ? (
        <ParamRow
          label="Multiplicador"
          c={c}
          right={
            <Stepper
              value={config.volumeMultiplier}
              onChange={(v) =>
                setConfig({ ...config, volumeMultiplier: v })
              }
              min={1.1}
              max={20}
              step={0.1}
              decimals={1}
              suffix="x"
            />
          }
        >
          <ChipsRow
            chips={[1.5, 2, 3, 5]}
            value={config.volumeMultiplier}
            onChange={(v) =>
              setConfig({ ...config, volumeMultiplier: v })
            }
            labelFn={(v) => `${v}x`}
            c={c}
          />
        </ParamRow>
      ) : null}

      <ParamRow label="Temporalidad" c={c}>
        <ChipsRow
          chips={TIMEFRAMES}
          value={config.timeframe}
          onChange={(v) =>
            setConfig({ ...config, timeframe: v as Timeframe })
          }
          c={c}
        />
      </ParamRow>
    </View>
  );
}

/** Card "Ejecución" — agrupa los parámetros sobre CÓMO se notifica
 *  (frecuencia). Por ahora solo una fila. */
function ExecutionCard({
  config,
  setConfig,
  c,
}: {
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  c: ColorMap;
}) {
  return (
    <View style={[s.card, { backgroundColor: c.surface }]}>
      <Text style={[s.cardHeader, { color: c.textMuted }]}>Ejecución</Text>
      <ParamRow label="Frecuencia" c={c}>
        <Segmented
          options={[
            { value: "once", label: "Solo una vez" },
            { value: "always", label: "Cada vez" },
          ]}
          active={config.frequency}
          onChange={(v) =>
            setConfig({ ...config, frequency: v as IndicatorFrequency })
          }
          c={c}
        />
      </ParamRow>
    </View>
  );
}

/* ─── Helpers internos a las cards ─────────────────────────────── */

/** Una fila dentro de una card. Label arriba (opcionalmente con un
 *  control compacto a la derecha — p.ej. Stepper), y el control
 *  principal (chips / segmented / option list) debajo. */
function ParamRow({
  label,
  c,
  right,
  children,
}: {
  label: string;
  c: ColorMap;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.paramRow}>
      <View style={s.paramRowHeader}>
        <Text style={[s.paramLabel, { color: c.textMuted }]}>{label}</Text>
        {right ? <View>{right}</View> : null}
      </View>
      {children ? <View style={s.paramControl}>{children}</View> : null}
    </View>
  );
}

/** Segmented control de 2 opciones — dos chips outline lado a lado
 *  con flex 1. Active: border c.brand + text c.brand. Inactive:
 *  border c.border + text c.textMuted. Sin container chrome ni tint
 *  fill — mismo lenguaje que los chips. */
function Segmented<T extends string>({
  options,
  active,
  onChange,
  c,
}: {
  options: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
  c: ColorMap;
}) {
  return (
    <View style={s.segmented}>
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(opt.value);
            }}
            style={[
              s.segmentedItem,
              { borderColor: isActive ? c.brand : c.border },
            ]}
          >
            <Text
              style={[
                s.segmentedText,
                {
                  color: isActive ? c.brand : c.textMuted,
                  fontFamily: isActive ? fontFamily[700] : fontFamily[600],
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Fila de chips horizontales — outline-only. Active: border c.brand
 *  1.5px + text c.brand, bg transparent. Inactive: border c.border
 *  1.5px + text c.textMuted, bg transparent. Sin tint fill nunca. */
function ChipsRow<T extends number | string>({
  chips,
  value,
  onChange,
  c,
  labelFn,
}: {
  chips: readonly T[];
  value: T;
  onChange: (v: T) => void;
  c: ColorMap;
  labelFn?: (v: T) => string;
}) {
  return (
    <View style={s.chipsWrap}>
      {chips.map((v) => {
        const active = value === v;
        return (
          <Pressable
            key={String(v)}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(v);
            }}
            style={({ pressed }) => [
              s.chip,
              {
                backgroundColor: "transparent",
                borderColor: active ? c.brand : c.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[
                s.chipText,
                { color: active ? c.brand : c.textMuted },
              ]}
            >
              {labelFn ? labelFn(v) : String(v)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Inline editors ──────────────────────────────────────────── */


function OptionList<T extends string>({
  options,
  active,
  onChange,
  c,
}: {
  options: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
  c: ColorMap;
}) {
  return (
    <View style={s.optionList}>
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(opt.value);
            }}
            style={({ pressed }) => [
              s.optionItem,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text
              style={[
                s.optionLabel,
                {
                  color: isActive ? c.brand : c.textSecondary,
                  fontFamily: isActive ? fontFamily[700] : fontFamily[500],
                },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
            {isActive ? (
              <Feather name="check" size={18} color={c.brand} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Helpers de conversión config ↔ alert + preview NL ───────── */

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
  const common = {
    assetId,
    timeframe: cfg.timeframe,
    frequency: cfg.frequency,
  };
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

function indicatorTitle(t: IndicatorType, cfg?: ConfigState): string {
  if (t === "ma") {
    if (cfg && cfg.maVariant === "ema") return "Media Móvil Exponencial";
    return "Media Móvil Simple";
  }
  if (t === "rsi") return "RSI";
  if (t === "macd") return "MACD";
  if (t === "bollinger") return "Bandas de Bollinger";
  return "Volumen";
}

/** Genera los segmentos del preview — partes en bold/brand vs
 *  partes en texto normal. La structure de cada return define qué
 *  va resaltado: ticker, números, períodos, umbrales, timeframe. */
function previewSegments(
  type: IndicatorType,
  ticker: string,
  cfg: ConfigState,
): { text: string; highlight: boolean }[] {
  const tf = cfg.timeframe;
  const T = (text: string, highlight = false) => ({ text, highlight });
  if (type === "ma") {
    const v = cfg.maVariant.toUpperCase();
    const dir =
      cfg.maCondition === "above"
        ? "cruce por encima"
        : "cruce por debajo";
    return [
      T("El precio de "),
      T(ticker, true),
      T(` ${dir} de la `),
      T(`${v}(${cfg.maPeriod})`, true),
      T(" en "),
      T(tf, true),
      T("."),
    ];
  }
  if (type === "rsi") {
    const dir =
      cfg.rsiCondition === "above"
        ? "suba por encima"
        : "baje por debajo";
    return [
      T("El "),
      T(`RSI(${cfg.rsiPeriod})`, true),
      T(" de "),
      T(ticker, true),
      T(` ${dir} de `),
      T(`${cfg.rsiThreshold}`, true),
      T(" en "),
      T(tf, true),
      T("."),
    ];
  }
  if (type === "macd") {
    let dir: string;
    if (cfg.macdCondition === "bullish_signal")
      dir = "cruce la línea de señal al alza";
    else if (cfg.macdCondition === "bearish_signal")
      dir = "cruce la línea de señal a la baja";
    else if (cfg.macdCondition === "zero_up")
      dir = "cruce la línea cero al alza";
    else dir = "cruce la línea cero a la baja";
    return [
      T("El "),
      T("MACD", true),
      T(` ${dir} para `),
      T(ticker, true),
      T(" en "),
      T(tf, true),
      T("."),
    ];
  }
  if (type === "bollinger") {
    if (cfg.bbCondition === "squeeze") {
      return [
        T("Las "),
        T("Bandas de Bollinger", true),
        T(" de "),
        T(ticker, true),
        T(" se contraigan en "),
        T(tf, true),
        T("."),
      ];
    }
    const upper = cfg.bbCondition === "touch_upper";
    return [
      T("El precio de "),
      T(ticker, true),
      T(` toque la `),
      T(upper ? "banda superior" : "banda inferior", true),
      T(" en "),
      T(tf, true),
      T("."),
    ];
  }
  return [
    T("El volumen de "),
    T(ticker, true),
    T(" supere "),
    T(`${cfg.volumeMultiplier.toFixed(1).replace(".", ",")}×`, true),
    T(" el promedio en "),
    T(tf, true),
    T("."),
  ];
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

  /* ── Paso 1 — picker ──
   * Densidad pensada para matchear la altura natural del AlertSheet
   * (~729 px). Filas con ícono 48, descripción de 1-2 líneas,
   * agrupadas en 3 secciones (TENDENCIA / MOMENTUM / VOLATILIDAD
   * Y VOLUMEN). */
  pickerHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  pickerTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  pickerSubtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    marginTop: 4,
  },
  /* Eyebrow de sección dentro del picker — mismo lenguaje que
   * sectionEyebrow del paso 2, con inset horizontal 20 para
   * alinearse al picker (que usa pH 20, no 24). */
  pickerSection: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  /* Override del paddingTop para las secciones que NO son la primera.
   * La primera (TENDENCIA) viene apenas después del header del picker
   * y necesita aire; MOMENTUM y VOLATILIDAD Y VOLUMEN vienen después
   * de su última row y sienten mejor con menos separación. */
  pickerSectionTight: {
    paddingTop: 4,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderCurve: "continuous",
  },
  pickerIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerRowTitle: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.3,
  },
  pickerRowDesc: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.05,
    marginTop: 2,
  },

  /* ── Paso 2 — header ── */
  configHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  configTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },

  /* ── Cards always-visible (Señal + Ejecución) ── */
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  cardHeader: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  paramRow: {
    paddingVertical: 10,
  },
  paramRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 28,
    marginBottom: 8,
    gap: 12,
  },
  paramLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  paramControl: {
    /* container para chips/segmented/option list. */
  },
  segmented: {
    flexDirection: "row",
    gap: 8,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderCurve: "continuous",
    borderWidth: 1.5,
  },
  segmentedText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* Hero rectangular full-width — bg con tint sutil de c.brand,
   * ilustración 3D centrada adentro. ~130 alto incluyendo padding. */
  heroRect: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 130,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  /* Statement — eyebrow chico arriba + sentence con tokens en c.brand.
   * Left-aligned (no centered) para feel "ficha técnica" no "poster". */
  statementBlock: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 18,
  },
  statementEyebrow: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  /* Sentence default — 20/700 -0.4, lineHeight 26, left-aligned. */
  heroSentence: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  /* Sentence compacta — para casos con texto largo (>80 chars).
   * Baja a 18/24. */
  heroSentenceCompact: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },

  /* CTA container — flota sobre c.bg, sin chrome bar (sin border). */
  ctaContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 0,
    gap: 8,
  },

  /* ── Editores inline ── */
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  /* Chips estilo AlertSheet — sin border, sólido tone activo
   * (c.text bg + c.bg text) vs inactivo (c.surface bg + c.text text).
   * Px ~ 14h / 11v + pill radius. */
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  chipText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  optionList: {
    gap: 2,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    paddingVertical: 14,
    gap: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  /* ── Warning ── */
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

  /* ── CTA — pill style match AlertSheet ── */
  cta: {
    height: 58,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.2,
  },
});
// Suppress unused TextInput import warning — we may use it for keyboard-typed numbers in a future iteration.
void TextInput;
