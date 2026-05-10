import { useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
 *            el editor correspondiente (segmented / chips + stepper
 *            / lista de opciones), animado con LayoutAnimation.
 *            Single-expansion: solo una fila abierta a la vez. Sin
 *            section headers en caps, sin radios circulares,
 *            estética iOS Settings / Robinhood.
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
  | "activo"
  | "ma_tipo"
  | "ma_periodo"
  | "ma_condicion"
  | "rsi_periodo"
  | "rsi_umbral"
  | "rsi_condicion"
  | "macd_params"
  | "macd_condicion"
  | "bb_periodo"
  | "bb_desviacion"
  | "bb_condicion"
  | "vol_multiplicador"
  | "vol_condicion"
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
                    Seleccioná el indicador que querés monitorear
                  </Text>
                </View>
                <ScrollView
                  contentContainerStyle={{ paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  <PickerRow
                    icon={() => <MAIndicatorIllustration size={44} />}
                    title="Media Móvil (MA)"
                    description="Cuando el precio cruza el promedio"
                    onPress={() => handlePickType("ma")}
                    c={c}
                  />
                  <PickerRow
                    icon={() => <RSIIndicatorIllustration size={44} />}
                    title="RSI"
                    description="Sobrecompra / sobreventa"
                    onPress={() => handlePickType("rsi")}
                    c={c}
                  />
                  <PickerRow
                    icon={() => <MACDIndicatorIllustration size={44} />}
                    title="MACD"
                    description="Cruces de línea y señal"
                    onPress={() => handlePickType("macd")}
                    c={c}
                  />
                  <PickerRow
                    icon={() => <BollingerIndicatorIllustration size={44} />}
                    title="Bandas de Bollinger"
                    description="Volatilidad y rangos"
                    onPress={() => handlePickType("bollinger")}
                    c={c}
                  />
                  <PickerRow
                    icon={() => <VolumeIndicatorIllustration size={44} />}
                    title="Volumen"
                    description="Picos vs promedio"
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
                  contentContainerStyle={{ paddingBottom: 130 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* HERO — preview en lenguaje natural arriba del
                      todo. Mismo lenguaje visual que la priceBlock
                      del AlertSheet (eyebrow caps + sentencia 22/700
                      + sub-line muted). NO border, NO bg — flota
                      directo sobre c.bg como el hero del Precio. */}
                  {selectedType ? (
                    <View style={s.hero}>
                      <Text
                        style={[s.heroEyebrow, { color: c.textMuted }]}
                      >
                        TE AVISAREMOS CUANDO
                      </Text>
                      <Text
                        style={[s.heroSentence, { color: c.text }]}
                      >
                        {renderPreviewSentence(
                          selectedType,
                          asset.ticker,
                          config,
                          c.brand,
                          c.text,
                        )}
                      </Text>
                      <Text
                        style={[s.heroSub, { color: c.textMuted }]}
                      >
                        En {config.timeframe} ·{" "}
                        {config.frequency === "once"
                          ? "Solo una vez"
                          : "Cada vez que ocurra"}
                      </Text>
                    </View>
                  ) : null}

                  {/* Divisor entre hero y rows */}
                  <View
                    style={[
                      s.heroDivider,
                      { backgroundColor: c.border },
                    ]}
                  />

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

                  {/* Warning MACD inline arriba del CTA si emaSlow
                      <= emaFast — pintado fuera del scroll area pero
                      antes del sticky CTA para que sea visible. */}
                </ScrollView>

                {/* Warning + CTA sticky abajo, sin chrome bar (sin
                    borderTop) — sit on c.bg como AlertSheet. */}
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
          numberOfLines={1}
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

/** Hairline color — gris al ~15% opacidad. Usa c.border y le baja
 *  la opacidad por encima de una capa neutra. RN no soporta alpha
 *  channel directo en hex, así que devolvemos un rgba sintético
 *  basado en si el tema es light o dark. */
function hairlineColor(c: ColorMap): string {
  // c.border es ya bastante sutil. Aprovechamos como está.
  return c.border;
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
  const assetValue = `${asset.ticker}`;

  /* Helpers de format por tipo. */
  const tipoMA = config.maVariant.toUpperCase();
  const periodoMA = config.maPeriod.toString();
  const condicionMA =
    config.maCondition === "above" ? "Cruza por encima" : "Cruza por debajo";

  const periodoRSI = config.rsiPeriod.toString();
  const umbralRSI = config.rsiThreshold.toString();
  const condicionRSI =
    config.rsiCondition === "above"
      ? "Cruza por encima"
      : "Cruza por debajo";

  const paramsMACD = `${config.macdEmaFast}, ${config.macdEmaSlow}, ${config.macdSignal}`;
  const condicionMACD =
    config.macdCondition === "bullish_signal"
      ? "Cruce alcista"
      : config.macdCondition === "bearish_signal"
        ? "Cruce bajista"
        : config.macdCondition === "zero_up"
          ? "Cruza cero al alza"
          : "Cruza cero a la baja";

  const periodoBB = config.bbPeriod.toString();
  const desviacionBB = `${config.bbDeviation.toFixed(1).replace(".", ",")}σ`;
  const condicionBB =
    config.bbCondition === "touch_upper"
      ? "Toca banda superior"
      : config.bbCondition === "touch_lower"
        ? "Toca banda inferior"
        : "Squeeze (volatilidad baja)";

  const multiplicadorVol = `${config.volumeMultiplier
    .toFixed(1)
    .replace(".", ",")}×`;
  const condicionVol = "Supera promedio";

  const timeframeLabel = config.timeframe;
  const frecuenciaLabel =
    config.frequency === "once" ? "Solo una vez" : "Cada vez que ocurra";

  // El "Activo" ya vive en el hero, así que en las rows lo
  // eliminamos para no duplicarlo. Si en el futuro hay un asset
  // switcher, vuelve como su propia row.
  void assetValue;
  return (
    <View style={s.flatList}>
      {/* Section eyebrow — PARÁMETROS */}
      <Text style={[s.sectionEyebrow, { color: c.textMuted }]}>
        PARÁMETROS
      </Text>

      {type === "ma" ? (
        <>
          <FlatRow
            label="Tipo"
            value={tipoMA}
            expanded={expandedRow === "ma_tipo"}
            onPress={() => toggleRow("ma_tipo")}
            c={c}
          >
            <SegmentedSMA
              value={config.maVariant}
              onChange={(v) => setConfig({ ...config, maVariant: v })}
              c={c}
            />
          </FlatRow>
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
        <>
          <FlatRow
            label="Parámetros"
            value={paramsMACD}
            expanded={expandedRow === "macd_params"}
            onPress={() => toggleRow("macd_params")}
            c={c}
          >
            <View style={{ gap: 10 }}>
              <View style={s.macdParamRow}>
                <Text style={[s.macdParamLabel, { color: c.text }]}>
                  Rápida
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
                  Lenta
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
        </>
      ) : null}

      {type === "bollinger" ? (
        <>
          <FlatRow
            label="Período"
            value={periodoBB}
            expanded={expandedRow === "bb_periodo"}
            onPress={() => toggleRow("bb_periodo")}
            c={c}
          >
            <View style={s.stepperWrap}>
              <Stepper
                value={config.bbPeriod}
                onChange={(v) => setConfig({ ...config, bbPeriod: v })}
                min={5}
                max={100}
                step={1}
              />
            </View>
          </FlatRow>
          <FlatRow
            label="Desviación"
            value={desviacionBB}
            expanded={expandedRow === "bb_desviacion"}
            onPress={() => toggleRow("bb_desviacion")}
            c={c}
          >
            <View style={s.stepperWrap}>
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
          </FlatRow>
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
        </>
      ) : null}

      {type === "volume" ? (
        <>
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
          <FlatRow
            label="Condición"
            value={condicionVol}
            expanded={expandedRow === "vol_condicion"}
            onPress={() => toggleRow("vol_condicion")}
            c={c}
          >
            <Text style={[s.helperText, { color: c.textMuted }]}>
              La alerta se dispara cuando el volumen del período supera el
              multiplicador configurado sobre el volumen promedio.
            </Text>
          </FlatRow>
        </>
      ) : null}

      {/* Section eyebrow — CUÁNDO */}
      <Text
        style={[
          s.sectionEyebrow,
          { color: c.textMuted, marginTop: 24 },
        ]}
      >
        CUÁNDO
      </Text>

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
                    /* removed border — solid bg only */
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
    </View>
  );
}

/* ─── Inline editors ──────────────────────────────────────────── */

function SegmentedSMA({
  value,
  onChange,
  c,
}: {
  value: "sma" | "ema";
  onChange: (v: "sma" | "ema") => void;
  c: ColorMap;
}) {
  return (
    <View
      style={[s.segmented, { backgroundColor: c.surfaceHover }]}
    >
      {(["sma", "ema"] as const).map((v) => {
        const active = value === v;
        return (
          <Pressable
            key={v}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(v);
            }}
            style={[s.segmentedItem, active && { backgroundColor: c.bg }]}
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
  );
}

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

function indicatorTitle(t: IndicatorType): string {
  if (t === "ma") return "Media Móvil";
  if (t === "rsi") return "RSI";
  if (t === "macd") return "MACD";
  if (t === "bollinger") return "Bandas de Bollinger";
  return "Volumen";
}

/** Renderiza la sentencia preview con tokens highlightados (ticker,
 *  números, símbolos) en brand color + fontFamily[800], y el resto
 *  en texto regular. Devuelve un array de Text children. */
function renderPreviewSentence(
  type: IndicatorType,
  ticker: string,
  cfg: ConfigState,
  highlightColor: string,
  baseColor: string,
): React.ReactNode {
  const segments = previewSegments(type, ticker, cfg);
  return segments.map((seg, i) => (
    <Text
      key={`${i}-${seg.text}`}
      style={
        seg.highlight
          ? {
              fontFamily: fontFamily[800],
              color: highlightColor,
            }
          : { color: baseColor }
      }
    >
      {seg.text}
    </Text>
  ));
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

  /* ── Paso 1 — picker ── */
  pickerHeader: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  pickerTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  pickerSubtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 4,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderCurve: "continuous",
  },
  pickerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerRowTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  pickerRowDesc: {
    fontFamily: fontFamily[500],
    fontSize: 12,
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

  /* Hero block — eyebrow caps + sentencia 22/700 con tokens
   * highlightados + sub-line muted. Mismo lenguaje que el
   * priceBlock del AlertSheet. */
  hero: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 22,
  },
  heroEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
  },
  heroSentence: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  heroSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 8,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
  },

  /* Section eyebrow entre grupos de rows. */
  sectionEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
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

  /* ── Editores inline ── */
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
  helperText: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.05,
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
  ctaWrap: {
    /* legacy — ya no se usa, queda por compat de referencias. */
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
  },
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
