import { useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
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
import { LinearGradient } from "expo-linear-gradient";
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
 * IndicatorSheet — rediseño Robinhood-style con dos pasos.
 *
 *   Paso 1 — Picker: lista tappable de 5 indicadores con icono
 *            squircle + label + descripción + chevron.
 *
 *   Paso 2 — Config: lista FLAT de filas tappables (label izq +
 *            value der + chevron). Tap en una fila expande inline
 *            el editor correspondiente (chips + stepper / lista de
 *            opciones), animado con LayoutAnimation. Single-expansion:
 *            solo una fila abierta a la vez. Sin section headers en
 *            caps, sin radios circulares, estética iOS Settings /
 *            Robinhood. Preview en lenguaje natural al final del
 *            scroll y sticky CTA con gradient fade abajo.
 *
 * Slide horizontal 220ms entre paso 1 y paso 2.
 * En EDIT: arranca directamente en paso 2 del tipo correspondiente
 * con todos los parámetros pre-cargados.
 */

// Habilitar LayoutAnimation en Android.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

/** Id de cada fila flat configurable. */
type RowKey =
  | "ma_periodo"
  | "ma_condicion"
  | "rsi_periodo"
  | "rsi_umbral"
  | "rsi_condicion"
  | "macd_condicion"
  | "macd_avanzado"
  | "bb_condicion"
  | "bb_avanzado"
  | "vol_multiplicador"
  | "timeframe"
  | "frecuencia";

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
  const { createIndicator, updateIndicator, removeIndicator } = useAlerts();
  const { show: showToast } = useToast();
  const isEditing = !!editingAlert;

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<IndicatorType | null>(
    null,
  );
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [expandedRow, setExpandedRow] = useState<RowKey | null>(null);
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
      setExpandedRow(null);
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
  const sliderStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -stepProgress.value * windowW }],
  }));

  /* Toggle de fila — animado con LayoutAnimation. Single expansion. */
  const toggleRow = (key: RowKey) => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, "easeInEaseOut", "opacity"),
    );
    setExpandedRow((prev) => (prev === key ? null : key));
  };

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
    setExpandedRow(null);
    setStep(2);
  };

  const previewSentence = useMemo(() => {
    if (!selectedType) return "";
    return describePreview(selectedType, asset.ticker, config);
  }, [selectedType, asset.ticker, config]);

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
                { flexDirection: "row", width: windowW * 2 },
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
                  contentContainerStyle={{ paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
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
                      setExpandedRow(null);
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
                      setConfig({ ...DEFAULT_CONFIG, maVariant: "ema" });
                      setSelectedType("ma");
                      setExpandedRow(null);
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
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      if (isEditing) dismiss();
                      else {
                        setStep(1);
                        setExpandedRow(null);
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
                    style={[s.configTitle, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {selectedType
                      ? indicatorTitle(selectedType, config)
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
                  contentContainerStyle={{ paddingBottom: 140 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedType ? (
                    <RowsFor
                      type={selectedType}
                      asset={asset}
                      config={config}
                      setConfig={setConfig}
                      expandedRow={expandedRow}
                      toggleRow={toggleRow}
                      c={c}
                    />
                  ) : null}

                  {/* Preview en lenguaje natural — debajo de todas
                      las rows. Card con borde izquierdo verde 3px y
                      fondo surface. Texto gris tenue 13px. Se
                      actualiza en tiempo real al cambiar parámetros. */}
                  {selectedType ? (
                    <View style={s.previewWrap}>
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
                          style={[s.previewText, { color: c.textMuted }]}
                        >
                          {previewSentence}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                {/* CTA sticky abajo, con fade de gradient desde
                    transparente al c.bg para que el contenido del
                    scroll se desvanezca debajo. */}
                <LinearGradient
                  colors={[`${c.bg}00`, c.bg]}
                  pointerEvents="none"
                  style={s.ctaFade}
                />
                <View style={s.ctaContainer}>
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

/* ─── Flat row genérica ───────────────────────────────────────── */

function FlatRow({
  label,
  value,
  expanded,
  onPress,
  children,
  c,
}: {
  label: string;
  value: string;
  expanded: boolean;
  onPress: () => void;
  children?: React.ReactNode;
  c: ColorMap;
}) {
  // Animación de rotación del chevron — 0deg cerrado, 90deg abierto.
  // Mismo timing que el slide del sheet (220ms cubic).
  const rot = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    rot.value = withTiming(expanded ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, rot]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value * 90}deg` }],
  }));

  return (
    <View
      style={[
        s.flatRowWrap,
        expanded && { backgroundColor: c.bgWarm },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.flatRow,
          {
            backgroundColor: pressed && !expanded ? c.bgWarm : "transparent",
          },
        ]}
      >
        <Text style={[s.flatLabel, { color: c.text }]}>{label}</Text>
        <View style={s.flatRight}>
          <Text
            style={[
              s.flatValue,
              {
                color: expanded ? c.text : c.textMuted,
                fontFamily: expanded ? fontFamily[800] : fontFamily[700],
              },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
          <Animated.View style={chevronStyle}>
            <Feather name="chevron-right" size={18} color={c.textFaint} />
          </Animated.View>
        </View>
      </Pressable>
      {expanded && children ? (
        <View style={s.flatExpand}>{children}</View>
      ) : null}
      {/* Hairline divider abajo — inset 24 desde la izquierda para
          que no toque el edge (look iOS Settings). */}
      <View style={[s.hairline, { backgroundColor: c.border }]} />
    </View>
  );
}

/* ─── Rows compuestas por tipo ────────────────────────────────── */

function RowsFor({
  type,
  asset,
  config,
  setConfig,
  expandedRow,
  toggleRow,
  c,
}: {
  type: IndicatorType;
  asset: Asset;
  config: ConfigState;
  setConfig: (next: ConfigState) => void;
  expandedRow: RowKey | null;
  toggleRow: (k: RowKey) => void;
  c: ColorMap;
}) {
  /* Helpers de format de cada value que se muestra a la derecha
   * de las flat rows. El asset.ticker no aparece en ninguna row
   * porque ya está en el título de la sheet. */
  void asset;

  const periodoMA = config.maPeriod.toString();
  const condicionMA =
    config.maCondition === "above" ? "Cruza por encima" : "Cruza por debajo";

  const periodoRSI = config.rsiPeriod.toString();
  const umbralRSI = config.rsiThreshold.toString();
  const condicionRSI =
    config.rsiCondition === "above"
      ? "Cruza por encima"
      : "Cruza por debajo";

  const condicionMACD =
    config.macdCondition === "bullish_signal"
      ? "Cruce alcista"
      : config.macdCondition === "bearish_signal"
        ? "Cruce bajista"
        : config.macdCondition === "zero_up"
          ? "Cruza cero al alza"
          : "Cruza cero a la baja";
  const avanzadoMACD = `${config.macdEmaFast}, ${config.macdEmaSlow}, ${config.macdSignal}`;

  const condicionBB =
    config.bbCondition === "touch_upper"
      ? "Toca banda superior"
      : config.bbCondition === "touch_lower"
        ? "Toca banda inferior"
        : "Squeeze (volatilidad baja)";
  const avanzadoBB = `${config.bbPeriod}, ${config.bbDeviation.toFixed(1)}σ`;

  const multiplicadorVol = `${config.volumeMultiplier
    .toFixed(1)
    .replace(".", ",")}×`;

  const timeframeLabel = config.timeframe;
  const frecuenciaLabel =
    config.frequency === "once" ? "Solo una vez" : "Cada vez que ocurra";

  return (
    <View style={s.flatList}>
      {type === "ma" ? (
        <>
          <FlatRow
            label="Período"
            value={periodoMA}
            expanded={expandedRow === "ma_periodo"}
            onPress={() => toggleRow("ma_periodo")}
            c={c}
          >
            <ChipsAndStepper
              chips={[9, 20, 50, 100, 200]}
              value={config.maPeriod}
              onChange={(v) => setConfig({ ...config, maPeriod: v })}
              min={5}
              max={500}
              step={1}
              c={c}
            />
          </FlatRow>
          <FlatRow
            label="Condición"
            value={condicionMA}
            expanded={expandedRow === "ma_condicion"}
            onPress={() => toggleRow("ma_condicion")}
            c={c}
          >
            <OptionList
              options={[
                { value: "above", label: "Precio cruza por encima" },
                { value: "below", label: "Precio cruza por debajo" },
              ]}
              active={config.maCondition}
              onChange={(v) =>
                setConfig({ ...config, maCondition: v as "above" | "below" })
              }
              c={c}
            />
          </FlatRow>
        </>
      ) : null}

      {type === "rsi" ? (
        <>
          <FlatRow
            label="Período"
            value={periodoRSI}
            expanded={expandedRow === "rsi_periodo"}
            onPress={() => toggleRow("rsi_periodo")}
            c={c}
          >
            <ChipsAndStepper
              chips={[7, 9, 14, 21]}
              value={config.rsiPeriod}
              onChange={(v) => setConfig({ ...config, rsiPeriod: v })}
              min={2}
              max={50}
              step={1}
              c={c}
            />
          </FlatRow>
          <FlatRow
            label="Umbral"
            value={umbralRSI}
            expanded={expandedRow === "rsi_umbral"}
            onPress={() => toggleRow("rsi_umbral")}
            c={c}
          >
            <View>
              <ChipsLabeled
                chips={[
                  { v: 30, label: "30 Sobreventa" },
                  { v: 50, label: "50 Neutro" },
                  { v: 70, label: "70 Sobrecompra" },
                ]}
                value={config.rsiThreshold}
                onChange={(v) => setConfig({ ...config, rsiThreshold: v })}
                c={c}
              />
              <View style={s.stepperWrap}>
                <Stepper
                  value={config.rsiThreshold}
                  onChange={(v) =>
                    setConfig({ ...config, rsiThreshold: v })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
              </View>
            </View>
          </FlatRow>
          <FlatRow
            label="Condición"
            value={condicionRSI}
            expanded={expandedRow === "rsi_condicion"}
            onPress={() => toggleRow("rsi_condicion")}
            c={c}
          >
            <OptionList
              options={[
                { value: "above", label: "Cruza por encima del umbral" },
                { value: "below", label: "Cruza por debajo del umbral" },
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
          </FlatRow>
        </>
      ) : null}

      {type === "macd" ? (
        <FlatRow
          label="Condición"
          value={condicionMACD}
          expanded={expandedRow === "macd_condicion"}
          onPress={() => toggleRow("macd_condicion")}
          c={c}
        >
          <OptionList
            options={[
              {
                value: "bullish_signal",
                label: "Cruce alcista (MACD cruza señal al alza)",
              },
              {
                value: "bearish_signal",
                label: "Cruce bajista (MACD cruza señal a la baja)",
              },
              {
                value: "zero_up",
                label: "MACD cruza línea cero al alza",
              },
              {
                value: "zero_down",
                label: "MACD cruza línea cero a la baja",
              },
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
        </FlatRow>
      ) : null}

      {type === "bollinger" ? (
        <FlatRow
          label="Condición"
          value={condicionBB}
          expanded={expandedRow === "bb_condicion"}
          onPress={() => toggleRow("bb_condicion")}
          c={c}
        >
          <OptionList
            options={[
              {
                value: "touch_upper",
                label: "Precio toca banda superior",
              },
              {
                value: "touch_lower",
                label: "Precio toca banda inferior",
              },
              { value: "squeeze", label: "Bandas se contraen (squeeze)" },
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
        </FlatRow>
      ) : null}

      {type === "volume" ? (
        <FlatRow
          label="Multiplicador"
          value={multiplicadorVol}
          expanded={expandedRow === "vol_multiplicador"}
          onPress={() => toggleRow("vol_multiplicador")}
          c={c}
        >
          <View>
            <ChipsLabeled
              chips={[
                { v: 1.5, label: "1.5x" },
                { v: 2, label: "2x" },
                { v: 3, label: "3x" },
                { v: 5, label: "5x" },
              ]}
              value={config.volumeMultiplier}
              onChange={(v) =>
                setConfig({ ...config, volumeMultiplier: v })
              }
              c={c}
            />
            <View style={s.stepperWrap}>
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
            </View>
          </View>
        </FlatRow>
      ) : null}

      <FlatRow
        label="Temporalidad"
        value={timeframeLabel}
        expanded={expandedRow === "timeframe"}
        onPress={() => toggleRow("timeframe")}
        c={c}
      >
        <View style={s.chipsWrap}>
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
                    backgroundColor: active ? c.text : c.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[s.chipText, { color: active ? c.bg : c.text }]}
                >
                  {tf}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FlatRow>

      <FlatRow
        label="Frecuencia"
        value={frecuenciaLabel}
        expanded={expandedRow === "frecuencia"}
        onPress={() => toggleRow("frecuencia")}
        c={c}
      >
        <OptionList
          options={[
            { value: "once", label: "Solo una vez" },
            { value: "always", label: "Cada vez que ocurra" },
          ]}
          active={config.frequency}
          onChange={(v) =>
            setConfig({ ...config, frequency: v as IndicatorFrequency })
          }
          c={c}
        />
      </FlatRow>

      {/* Avanzado — MACD: 3 EMAs internas. Bollinger: período y
       *  desviación. Va al final porque es opcional / técnico. */}
      {type === "macd" ? (
        <FlatRow
          label="Avanzado"
          value={avanzadoMACD}
          expanded={expandedRow === "macd_avanzado"}
          onPress={() => toggleRow("macd_avanzado")}
          c={c}
        >
          <View style={{ gap: 10 }}>
            <View style={s.macdParamRow}>
              <Text style={[s.macdParamLabel, { color: c.text }]}>
                EMA rápida
              </Text>
              <Stepper
                value={config.macdEmaFast}
                onChange={(v) => setConfig({ ...config, macdEmaFast: v })}
                min={2}
                max={50}
                step={1}
              />
            </View>
            <View style={s.macdParamRow}>
              <Text style={[s.macdParamLabel, { color: c.text }]}>
                EMA lenta
              </Text>
              <Stepper
                value={config.macdEmaSlow}
                onChange={(v) => setConfig({ ...config, macdEmaSlow: v })}
                min={5}
                max={100}
                step={1}
              />
            </View>
            <View style={s.macdParamRow}>
              <Text style={[s.macdParamLabel, { color: c.text }]}>
                Señal
              </Text>
              <Stepper
                value={config.macdSignal}
                onChange={(v) => setConfig({ ...config, macdSignal: v })}
                min={2}
                max={50}
                step={1}
              />
            </View>
          </View>
        </FlatRow>
      ) : null}

      {type === "bollinger" ? (
        <FlatRow
          label="Avanzado"
          value={avanzadoBB}
          expanded={expandedRow === "bb_avanzado"}
          onPress={() => toggleRow("bb_avanzado")}
          c={c}
        >
          <View style={{ gap: 10 }}>
            <View style={s.macdParamRow}>
              <Text style={[s.macdParamLabel, { color: c.text }]}>
                Período
              </Text>
              <Stepper
                value={config.bbPeriod}
                onChange={(v) => setConfig({ ...config, bbPeriod: v })}
                min={5}
                max={100}
                step={1}
              />
            </View>
            <View style={s.macdParamRow}>
              <Text style={[s.macdParamLabel, { color: c.text }]}>
                Desviación
              </Text>
              <Stepper
                value={config.bbDeviation}
                onChange={(v) => setConfig({ ...config, bbDeviation: v })}
                min={0.5}
                max={5}
                step={0.5}
                decimals={1}
                suffix="σ"
              />
            </View>
          </View>
        </FlatRow>
      ) : null}
    </View>
  );
}

/* ─── Inline editors ──────────────────────────────────────────── */

function ChipsAndStepper({
  chips,
  value,
  onChange,
  min,
  max,
  step,
  c,
}: {
  chips: number[];
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  c: ColorMap;
}) {
  return (
    <View>
      <View style={s.chipsWrap}>
        {chips.map((v) => {
          const active = value === v;
          return (
            <Pressable
              key={v}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChange(v);
              }}
              style={({ pressed }) => [
                s.chip,
                {
                  /* removed border — solid bg only */
                  backgroundColor: active ? c.text : c.surface,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[s.chipText, { color: active ? c.bg : c.text }]}
              >
                {v}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={s.stepperWrap}>
        <Stepper
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
        />
      </View>
    </View>
  );
}

function ChipsLabeled({
  chips,
  value,
  onChange,
  c,
}: {
  chips: { v: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  c: ColorMap;
}) {
  return (
    <View style={s.chipsWrap}>
      {chips.map((chip) => {
        const active = value === chip.v;
        return (
          <Pressable
            key={chip.v}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(chip.v);
            }}
            style={({ pressed }) => [
              s.chip,
              {
                /* removed border — solid bg only */
                backgroundColor: active ? c.text : c.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[s.chipText, { color: active ? c.bg : c.text }]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
                  color: isActive ? c.text : c.textSecondary,
                  fontFamily: isActive ? fontFamily[800] : fontFamily[500],
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

function describePreview(
  type: IndicatorType,
  ticker: string,
  cfg: ConfigState,
): string {
  const tf = cfg.timeframe;
  if (type === "ma") {
    const v = cfg.maVariant.toUpperCase();
    const dir =
      cfg.maCondition === "above"
        ? "cruce por encima"
        : "cruce por debajo";
    return `Te avisaremos cuando el precio de ${ticker} ${dir} de la ${v}(${cfg.maPeriod}) en ${tf}.`;
  }
  if (type === "rsi") {
    const dir =
      cfg.rsiCondition === "above"
        ? "suba por encima"
        : "baje por debajo";
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
  return `Te avisaremos cuando el volumen de ${ticker} supere ${cfg.volumeMultiplier.toFixed(1).replace(".", ",")}x el promedio en ${tf}.`;
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
    paddingTop: 14,
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
    paddingVertical: 16,
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  headerSideBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  configTitle: {
    flex: 1,
    fontFamily: fontFamily[700],
    fontSize: 17,
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

  /* ── Flat list rows ── */
  flatList: {
    marginTop: 4,
  },
  flatRowWrap: {
    /* sin border — el hairline va abajo via View propia con inset
     * desde la izquierda (look iOS Settings). */
  },
  flatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  flatLabel: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  flatRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "60%",
  },
  flatValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
    textAlign: "right",
  },
  flatExpand: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 20,
  },
  /* Hairline inset desde la izquierda — toque iOS Settings. */
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 24,
  },

  /* CTA container — flota sobre c.bg, sin chrome bar (sin border). */
  ctaContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  /* Fade de gradient encima del ctaContainer — el contenido del
   * scroll se desvanece detrás del CTA sin un corte duro. Alpha
   * 0 arriba → c.bg sólido abajo. Altura 48 da suficiente fade
   * sin tapar demasiado contenido. Posicionado justo arriba del
   * ctaContainer (CTA 58 + paddings ≈ 74). */
  ctaFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 74,
    height: 48,
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
    paddingVertical: 11,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  chipText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  stepperWrap: {
    marginTop: 10,
    alignSelf: "flex-start",
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
  macdParamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  macdParamLabel: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },

  /* ── Preview + warning ── */
  previewWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  preview: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderLeftWidth: 3,
  },
  previewText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
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
