import { useEffect, useRef, useState } from "react";
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
  withSequence,
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
 *   Paso 2 — Config (rediseño): hero rect con bg oscuro + ilustración,
 *            statement centrado dinámico, dos secciones (Señal /
 *            Ejecución) sin card containers, chips y segmented
 *            outline-only (outline gray inactive / outline brand
 *            active, match design system), CTA con ícono de campana.
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

/** Bg constante del hero rect — charcoal verde-tintado.
 *  Hardcoded porque el hero es un container de ilustración
 *  (display, no interactivo) que necesita verse igual en light/dark
 *  mode para que el palette de la ilustración (5FE850 verde
 *  brillante + FFB300 oro) lea consistente. Excepción explícita
 *  documentada en alamos-design SKILL.md: "hero illustration
 *  containers" pueden tener bg hardcodeado. */
const HERO_DARK = "#0F1411";

/** Temporalidades expuestas en el nuevo UI. La spec del rediseño
 *  reduce de 8 (1m/5m/15m/30m/1H/4H/1D/1W) a 4 más usadas para
 *  que la fila entre sin scroll. El type Timeframe en la API sigue
 *  soportando todas — alertas legacy con 5m/15m/etc se abren en
 *  edit con ningún chip seleccionado y el user pasa a uno de los 4
 *  nuevos. */
const TIMEFRAMES: Timeframe[] = ["1H", "4H", "1D", "1W"];

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

              {/* ──────── Paso 2: Config (rediseño) ──────── */}
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
                      style={s.configBack}
                    >
                      <Feather
                        name="chevron-left"
                        size={22}
                        color={c.text}
                      />
                    </Pressable>
                  ) : (
                    <View style={s.configBack} />
                  )}
                  <Text
                    style={[s.configTitle, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {selectedType
                      ? indicatorTitle(selectedType, config)
                      : "Configurar"}
                  </Text>
                  {/* Spacer simétrico al chevron para que el título
                   * quede centrado visualmente. */}
                  <View style={s.configBack} />
                </View>

                <ScrollView
                  contentContainerStyle={{ paddingBottom: 130 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* HERO — rectángulo full-width con bg oscuro
                      constante (no theme-aware) conteniendo la
                      ilustración del indicador centrada. */}
                  {selectedType ? (
                    <Animated.View
                      key={`hero-${isEditing ? "edit" : "create"}`}
                      entering={
                        isEditing
                          ? FadeIn.duration(180)
                          : FadeIn.duration(220).delay(0)
                      }
                      style={[s.heroRect, { backgroundColor: HERO_DARK }]}
                    >
                      {selectedType === "ma" ? (
                        config.maVariant === "ema" ? (
                          <EMAIndicatorIllustration size={104} />
                        ) : (
                          <MAIndicatorIllustration size={104} />
                        )
                      ) : selectedType === "rsi" ? (
                        <RSIIndicatorIllustration size={104} />
                      ) : selectedType === "macd" ? (
                        <MACDIndicatorIllustration size={104} />
                      ) : selectedType === "bollinger" ? (
                        <BollingerIndicatorIllustration size={104} />
                      ) : (
                        <VolumeIndicatorIllustration size={104} />
                      )}
                    </Animated.View>
                  ) : null}

                  {/* STATEMENT — centrado, eyebrow + sentence con
                      tokens dinámicos en c.brand. Cada token highlight
                      flashea con opacity al cambiar. */}
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
                        style={[
                          s.statementEyebrow,
                          { color: c.textSecondary },
                        ]}
                      >
                        Te avisaremos cuando:
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
                      <SignalSection
                        type={selectedType}
                        config={config}
                        setConfig={setConfig}
                        c={c}
                      />
                      <ExecutionSection
                        config={config}
                        setConfig={setConfig}
                        c={c}
                      />
                    </Animated.View>
                  ) : null}
                </ScrollView>

                {/* CTA sticky abajo — verde brand sólido, radius 14,
                    bell icon + texto. Sin chrome bar. */}
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
                      },
                    ]}
                  >
                    <Feather name="bell" size={18} color={c.onColor} />
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
   *  como una illustration custom. Se rendea en un slot 56×56 sin bg
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

/* ─── Statement — preview sentence con flash en tokens ──────── */

/** Renderea la sentence con tokens highlightados en c.brand. Cada
 *  segmento es un FlashSegment que detecta cambios en su texto y
 *  hace flash sutil (opacity 1 > 0.5 > 1 en 200ms) para dar feedback
 *  cuando el user toca un control y el statement se actualiza.
 *
 *  El centered alignment del nuevo diseño viene del statementBlock,
 *  no del Text inner — keep Text como inline para que segments
 *  fluyan en una sola "frase" rendereable. */
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
  return (
    <Text style={[s.statementSentence, { color: c.textSecondary }]}>
      {segments.map((seg, i) => (
        <FlashSegment
          key={`${type}-${i}`}
          text={seg.text}
          highlight={seg.highlight}
          c={c}
        />
      ))}
    </Text>
  );
}

/** Segmento individual de la sentence. Si su texto cambia respecto
 *  al render anterior, dispara un flash de opacity 1 → 0.5 → 1
 *  (200ms total). Usado solo en segmentos highlight para no
 *  parpadear el texto neutral. */
function FlashSegment({
  text,
  highlight,
  c,
}: {
  text: string;
  highlight: boolean;
  c: ColorMap;
}) {
  const opacity = useSharedValue(1);
  const prevText = useRef<string>(text);

  useEffect(() => {
    if (prevText.current !== text) {
      if (highlight) {
        opacity.value = withSequence(
          withTiming(0.5, { duration: 100, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 100, easing: Easing.in(Easing.cubic) }),
        );
      }
      prevText.current = text;
    }
  }, [text, highlight, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!highlight) {
    return <Text style={{ color: c.textSecondary }}>{text}</Text>;
  }
  return (
    <Animated.Text
      style={[
        { color: c.brand, fontFamily: fontFamily[500] },
        animatedStyle,
      ]}
    >
      {text}
    </Animated.Text>
  );
}

/* ─── Sections — Señal + Ejecución ──────────────────────────── */

/** Section "Señal" — agrupa los parámetros que definen QUÉ disparará
 *  la alerta (período, condición, umbral, temporalidad). Sin card
 *  container — los controles viven sobre c.bg con separadores
 *  sutiles entre ellos. Estructura varía por indicador. */
function SignalSection({
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
    <View style={s.section}>
      <Text style={[s.sectionHeader, { color: c.textSecondary }]}>
        Señal
      </Text>

      {type === "ma" ? (
        <>
          <ParamRow
            label="Período"
            c={c}
            chips={[9, 20, 50, 100, 200]}
            chipValue={config.maPeriod}
            onChipChange={(v) =>
              setConfig({ ...config, maPeriod: Number(v) })
            }
            stepper={
              <Stepper
                value={config.maPeriod}
                onChange={(v) => setConfig({ ...config, maPeriod: v })}
                min={5}
                max={500}
                step={1}
              />
            }
          />
          <Separator c={c} />
          <ParamRow label="Condición" c={c}>
            <Segmented
              options={[
                {
                  value: "above",
                  label: "Por encima",
                  icon: "trending-up",
                },
                {
                  value: "below",
                  label: "Por debajo",
                  icon: "trending-down",
                },
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
            chips={[7, 9, 14, 21]}
            chipValue={config.rsiPeriod}
            onChipChange={(v) =>
              setConfig({ ...config, rsiPeriod: Number(v) })
            }
            stepper={
              <Stepper
                value={config.rsiPeriod}
                onChange={(v) => setConfig({ ...config, rsiPeriod: v })}
                min={2}
                max={50}
                step={1}
              />
            }
          />
          <Separator c={c} />
          <ParamRow
            label="Umbral"
            c={c}
            chips={[30, 50, 70]}
            chipValue={config.rsiThreshold}
            onChipChange={(v) =>
              setConfig({ ...config, rsiThreshold: Number(v) })
            }
            stepper={
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
          />
          <Separator c={c} />
          <ParamRow label="Condición" c={c}>
            <Segmented
              options={[
                {
                  value: "above",
                  label: "Sobrecompra",
                  icon: "trending-up",
                },
                {
                  value: "below",
                  label: "Sobreventa",
                  icon: "trending-down",
                },
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
            label="EMA rápida"
            c={c}
            chips={[8, 12, 26]}
            chipValue={config.macdEmaFast}
            onChipChange={(v) =>
              setConfig({ ...config, macdEmaFast: Number(v) })
            }
            stepper={
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
          <Separator c={c} />
          <ParamRow
            label="EMA lenta"
            c={c}
            chips={[21, 26, 50]}
            chipValue={config.macdEmaSlow}
            onChipChange={(v) =>
              setConfig({ ...config, macdEmaSlow: Number(v) })
            }
            stepper={
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
          <Separator c={c} />
          <ParamRow
            label="Señal"
            c={c}
            chips={[5, 9, 14]}
            chipValue={config.macdSignal}
            onChipChange={(v) =>
              setConfig({ ...config, macdSignal: Number(v) })
            }
            stepper={
              <Stepper
                value={config.macdSignal}
                onChange={(v) => setConfig({ ...config, macdSignal: v })}
                min={2}
                max={50}
                step={1}
              />
            }
          />
          <Separator c={c} />
          <ParamRow label="Condición" c={c}>
            <Segmented
              options={[
                {
                  value: "bullish_signal",
                  label: "Cruce alcista",
                  icon: "trending-up",
                },
                {
                  value: "bearish_signal",
                  label: "Cruce bajista",
                  icon: "trending-down",
                },
              ]}
              active={
                config.macdCondition === "bullish_signal" ||
                config.macdCondition === "bearish_signal"
                  ? config.macdCondition
                  : "bullish_signal"
              }
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
            chips={[10, 20, 50]}
            chipValue={config.bbPeriod}
            onChipChange={(v) =>
              setConfig({ ...config, bbPeriod: Number(v) })
            }
            stepper={
              <Stepper
                value={config.bbPeriod}
                onChange={(v) => setConfig({ ...config, bbPeriod: v })}
                min={5}
                max={100}
                step={1}
              />
            }
          />
          <Separator c={c} />
          <ParamRow
            label="Desviación"
            c={c}
            chips={[1.5, 2, 2.5, 3]}
            chipValue={config.bbDeviation}
            onChipChange={(v) =>
              setConfig({ ...config, bbDeviation: Number(v) })
            }
            chipLabelFn={(v) => fmtDecimalChip(Number(v))}
            stepper={
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
          <Separator c={c} />
          <ParamRow label="Condición" c={c}>
            <Segmented
              options={[
                {
                  value: "touch_upper",
                  label: "Banda superior",
                  icon: "trending-up",
                },
                {
                  value: "touch_lower",
                  label: "Banda inferior",
                  icon: "trending-down",
                },
              ]}
              active={
                config.bbCondition === "touch_upper" ||
                config.bbCondition === "touch_lower"
                  ? config.bbCondition
                  : "touch_upper"
              }
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
          chips={[1.5, 2, 3]}
          chipValue={config.volumeMultiplier}
          onChipChange={(v) =>
            setConfig({ ...config, volumeMultiplier: Number(v) })
          }
          chipLabelFn={(v) => `${fmtDecimalChip(Number(v))}x`}
          stepper={
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
        />
      ) : null}

      <Separator c={c} />

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

/** Section "Ejecución" — agrupa los parámetros sobre CÓMO se notifica
 *  (frecuencia). Por ahora solo una fila. */
function ExecutionSection({
  config,
  setConfig,
  c,
}: {
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  c: ColorMap;
}) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionHeader, { color: c.textSecondary }]}>
        Ejecución
      </Text>
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

/* ─── Helpers de layout de las sections ──────────────────────── */

/** ParamRow — fila genérica con label arriba y control debajo.
 *
 *  Dos modos:
 *  (A) Con `chips` + `stepper` props: renderea chips presets a la
 *      izquierda (horizontal scroll si overflow) + stepper a la
 *      derecha en una sola línea. Tocar un chip actualiza el valor;
 *      usar el stepper para un valor que NO está en los presets
 *      deselecciona los chips visualmente (chip no marcado activo
 *      porque value !== chip).
 *  (B) Con `children`: control libre (segmented, chips fila simple)
 *      debajo del label.
 *  Si pasás los dos, ambos renderean — children abajo del row de
 *  chips+stepper. */
function ParamRow({
  label,
  c,
  chips,
  chipValue,
  onChipChange,
  chipLabelFn,
  stepper,
  children,
}: {
  label: string;
  c: ColorMap;
  chips?: readonly (number | string)[];
  chipValue?: number | string;
  onChipChange?: (v: number | string) => void;
  chipLabelFn?: (v: number | string) => string;
  stepper?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const hasChipsStepper = chips && stepper;
  return (
    <View style={s.paramRow}>
      <Text style={[s.paramLabel, { color: c.textMuted }]}>{label}</Text>
      {hasChipsStepper ? (
        <View style={s.chipsStepperRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsScrollContent}
            style={s.chipsScroll}
          >
            {chips.map((v) => {
              const active = chipValue === v;
              return (
                <Chip
                  key={String(v)}
                  active={active}
                  label={chipLabelFn ? chipLabelFn(v) : String(v)}
                  onPress={() => onChipChange?.(v)}
                  c={c}
                />
              );
            })}
          </ScrollView>
          <View style={s.stepperWrap}>{stepper}</View>
        </View>
      ) : null}
      {children ? <View style={s.paramControl}>{children}</View> : null}
    </View>
  );
}

/** Separador sutil — línea hairline de c.border, vertical margin
 *  para dar respiro entre param rows. Reemplaza el card chrome de
 *  la versión anterior. */
function Separator({ c }: { c: ColorMap }) {
  return <View style={[s.separator, { backgroundColor: c.border }]} />;
}

/* ─── Controles ─────────────────────────────────────────────── */

/** Chip individual — outline-only, dos estados:
 *
 *  Inactive: bg transparent + border c.border + text c.textMuted.
 *  Active:   bg transparent + border c.brand + text c.brand.
 *
 *  Sin fills. Convención del design system (alamos-design SKILL.md
 *  categorías B/C): outline gray para disponible, outline brand para
 *  seleccionado. Mismo lenguaje que el resto de chips/segmented de
 *  la app (PR #205/#207/#208). */
function Chip({
  active,
  label,
  onPress,
  c,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  c: ColorMap;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
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
        {label}
      </Text>
    </Pressable>
  );
}

/** Fila de chips horizontales — para casos sin stepper (e.g.
 *  Temporalidad). Sin scroll porque los presets son fijos y caben
 *  en el ancho. */
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
          <Chip
            key={String(v)}
            active={active}
            label={labelFn ? labelFn(v) : String(v)}
            onPress={() => onChange(v)}
            c={c}
          />
        );
      })}
    </View>
  );
}

/** Segmented control — dos (o más) chips outline lado a lado con
 *  gap entre items. Sin container chrome. Misma convención de
 *  colores que Chip (outline gray inactive / outline brand active).
 *  Soporta ícono opcional a la izquierda del label. */
function Segmented<T extends string>({
  options,
  active,
  onChange,
  c,
}: {
  options: { value: T; label: string; icon?: keyof typeof Feather.glyphMap }[];
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
            style={({ pressed }) => [
              s.segmentedItem,
              {
                backgroundColor: "transparent",
                borderColor: isActive ? c.brand : c.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {opt.icon ? (
              <Feather
                name={opt.icon}
                size={14}
                color={isActive ? c.brand : c.textMuted}
                style={{ marginRight: 6 }}
              />
            ) : null}
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

/** Formatea un número para mostrar en un chip cuando los presets
 *  mezclan enteros y decimales. Entero → "2". Decimal → "1,5"
 *  (locale es-AR). No agrega sufijo — caller suma "x", "σ", etc. */
function fmtDecimalChip(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1).replace(".", ",");
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
    if (cfg && cfg.maVariant === "ema") return "Media móvil exponencial";
    return "Media móvil simple";
  }
  if (t === "rsi") return "RSI";
  if (t === "macd") return "MACD";
  if (t === "bollinger") return "Bandas de Bollinger";
  return "Volumen";
}

/** Genera los segmentos del preview — partes en c.brand (highlight)
 *  vs partes en c.textSecondary. La estructura de cada return define
 *  qué va resaltado: ticker, números, períodos, umbrales, timeframe. */
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
      T(" toque la "),
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

  /* ── Paso 1 — picker ── */
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
  pickerSection: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  configBack: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  configTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.3,
  },

  /* ── Hero rect ──
   * Full-width con margin horizontal 16. Bg HERO_DARK constante.
   * Radius 14 (override del token md/lg porque el spec lo pide
   * literal). overflow hidden para que la ilustración respete los
   * corners. */
  heroRect: {
    marginHorizontal: 16,
    marginTop: 8,
    height: 130,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  /* ── Statement ──
   * Centered, eyebrow 12 + sentence 15 en c.textSecondary con
   * tokens en c.brand 500 weight. Un padding vertical generoso para
   * que respire entre el hero y la sección Señal. */
  statementBlock: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: "center",
  },
  statementEyebrow: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 6,
    textAlign: "center",
  },
  statementSentence: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
  },

  /* ── Section (sin card chrome) ──
   * Margen horizontal 16 alineado con el hero, padding interno
   * controlado por las ParamRow + Separator. Sin bg, sin border,
   * sin radius — los controles viven sobre c.bg. */
  section: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  sectionHeader: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 10,
  },

  /* ── ParamRow ──
   * Label arriba (12/textMuted) + control debajo. Vertical padding
   * leve para densidad cómoda sin sentirse compacto. */
  paramRow: {
    paddingVertical: 8,
  },
  paramLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginBottom: 8,
  },
  paramControl: {
    // container para children libres (segmented, chips fila).
  },

  /* ── Chips + Stepper inline ──
   * Row con chips scroll horizontal a la izquierda y stepper a la
   * derecha con marginLeft auto via flex layout. */
  chipsStepperRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chipsScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  chipsScrollContent: {
    gap: 8,
    alignItems: "center",
    paddingRight: 8,
  },
  stepperWrap: {
    marginLeft: 8,
  },

  /* ── Chips (outline-only) ──
   * Inactive: border c.border + text c.textMuted.
   * Active:   border c.brand + text c.brand.
   * Pill radius, padding 14h / 7v para feel compacto sin perder
   * tap target. */
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },

  /* ── Chips row simple (sin scroll) ──
   * Para Temporalidad y otros casos con presets fijos. */
  chipsWrap: {
    flexDirection: "row",
    gap: 8,
  },

  /* ── Segmented (outline-only) ──
   * Dos (o más) chips outline lado a lado con gap entre items.
   * Sin container chrome. Cada item lleva su propio border:
   * c.brand si active, c.border si inactive. Pill radius para
   * matchear el lenguaje del resto de chips. */
  segmented: {
    flexDirection: "row",
    gap: 8,
  },
  segmentedItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  segmentedText: {
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* ── Separator sutil entre ParamRows ── */
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },

  /* ── CTA container ──
   * Floata sobre c.bg sin chrome bar. Bottom inset manejado a
   * nivel del sheet padding. */
  ctaContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 0,
    gap: 8,
  },

  /* ── Warning MACD ── */
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
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

  /* ── CTA — radius 14 + bell icon ─ texto 16/500 ── */
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderCurve: "continuous",
    borderRadius: 14,
  },
  ctaText: {
    fontFamily: fontFamily[500],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});

// Suppress unused TextInput import warning — TextInput se usa
// indirectamente via Stepper.tsx, lo dejamos importado por si en
// un futuro queremos un campo numeric inline en este archivo.
void TextInput;
