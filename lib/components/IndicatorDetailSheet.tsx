import { useEffect } from "react";
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
import { fontFamily, radius, useTheme } from "../theme";
import type { Asset } from "../data/assets";
import { useAlerts } from "../alerts/context";
import { useToast } from "../toast/context";
import type { IndicatorAlert } from "../api/alerts";

/**
 * IndicatorDetailSheet — bottom sheet de DETALLE de una alerta de
 * indicador. Aparece al tocar una fila del listado (no es el editor).
 *
 * Layout:
 *   Header con grabber + título "Detalle de alerta"
 *   Card con borde left coloreado: ticker + descripción + frase NL
 *   InfoRows: Indicador / Temporalidad / Frecuencia / Estado
 *   Botón "Eliminar alerta" outline naranja abajo
 *
 * Para editar, hay un secundario "Editar" (chevron) en una de las
 * info rows, que cierra este sheet y abre el IndicatorSheet en EDIT.
 */

interface Props {
  visible: boolean;
  alert: IndicatorAlert | null;
  asset: Asset;
  onClose: () => void;
  /** Llamada para abrir el IndicatorSheet en modo EDIT con esta
   *  alerta. El parent debe cerrar este sheet y abrir el otro. */
  onEdit: (alert: IndicatorAlert) => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

export function IndicatorDetailSheet({
  visible,
  alert,
  asset,
  onClose,
  onEdit,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { removeIndicator } = useAlerts();
  const { show: showToast } = useToast();

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

  if (!alert) return null;

  const meta = describeMeta(alert, asset.ticker);
  const tone = meta.bullish === null ? c.text : meta.bullish ? c.brand : c.red;

  const handleDelete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await removeIndicator(alert.id);
      dismiss();
    } catch {
      showToast("No pudimos eliminar la alerta", { variant: "error" });
    }
  };

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
            },
            sheetStyle,
          ]}
        >
          <View style={s.grabber}>
            <View
              style={[s.grabberPill, { backgroundColor: c.borderStrong }]}
            />
          </View>

          <View style={s.content}>
            <Text style={[s.title, { color: c.text }]}>
              Detalle de alerta
            </Text>

            {/* Card destacada con borde izquierdo coloreado */}
            <View
              style={[
                s.previewCard,
                {
                  backgroundColor: c.surface,
                  borderLeftColor: tone,
                  borderColor: c.border,
                },
              ]}
            >
              <View style={s.previewHead}>
                <Text style={[s.previewTicker, { color: c.text }]}>
                  {asset.ticker}
                </Text>
                <Text style={[s.previewDir, { color: tone }]}>
                  {meta.short}
                </Text>
              </View>
              <Text style={[s.previewText, { color: c.textSecondary }]}>
                {meta.sentence}
              </Text>
            </View>

            {/* Info rows */}
            <ScrollView
              contentContainerStyle={{ paddingTop: 4 }}
              showsVerticalScrollIndicator={false}
            >
              <InfoRow
                label="Indicador"
                value={meta.indicatorName}
                c={c}
                borderColor={c.border}
              />
              <InfoRow
                label="Temporalidad"
                value={alert.timeframe}
                c={c}
                borderColor={c.border}
              />
              <InfoRow
                label="Frecuencia"
                value={
                  alert.frequency === "once"
                    ? "Solo una vez"
                    : "Cada vez que ocurra"
                }
                c={c}
                borderColor={c.border}
              />
              <InfoRow
                label="Estado"
                value={
                  alert.status === "active"
                    ? "Activa"
                    : alert.status === "paused"
                      ? "Pausada"
                      : alert.status === "triggered"
                        ? "Disparada"
                        : "Cancelada"
                }
                c={c}
                borderColor={c.border}
              />
              <InfoRow
                label="Editar"
                value=""
                chevron
                onPress={() => onEdit(alert)}
                c={c}
                borderColor={c.border}
              />
            </ScrollView>

            <Pressable
              onPress={handleDelete}
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
                Eliminar alerta
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
  chevron,
  onPress,
  c,
  borderColor,
}: {
  label: string;
  value: string;
  chevron?: boolean;
  onPress?: () => void;
  c: ReturnType<typeof useTheme>["c"];
  borderColor: string;
}) {
  const content = (
    <View
      style={[
        s.infoRow,
        {
          borderBottomColor: borderColor,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[s.infoLabel, { color: c.textMuted }]}>{label}</Text>
      <View style={s.infoRight}>
        {value ? (
          <Text style={[s.infoValue, { color: c.text }]}>{value}</Text>
        ) : null}
        {chevron ? (
          <Text style={[s.infoChevron, { color: c.textFaint }]}>›</Text>
        ) : null}
      </View>
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

interface Meta {
  indicatorName: string;
  short: string;
  sentence: string;
  /** null = neutro (volumen / squeeze), true = bullish, false = bearish. */
  bullish: boolean | null;
}

function describeMeta(alert: IndicatorAlert, ticker: string): Meta {
  const tf = alert.timeframe;
  if (alert.type === "ma") {
    const v = alert.variant.toUpperCase();
    const variantWord =
      alert.variant === "ema" ? "exponencial" : "simple";
    const above = alert.condition === "above";
    return {
      indicatorName: `Media móvil ${variantWord} (${alert.period})`,
      short: above
        ? `Precio cruza sobre ${v} ${alert.period}`
        : `Precio cruza bajo ${v} ${alert.period}`,
      sentence: `Te avisaremos cuando el precio de ${ticker} ${above ? "cruce por encima" : "cruce por debajo"} de la ${v}(${alert.period}) en ${tf}.`,
      bullish: above,
    };
  }
  if (alert.type === "rsi") {
    const above = alert.condition === "above";
    return {
      indicatorName: `RSI (${alert.period})`,
      short: `RSI cruza ${above ? ">" : "<"} ${alert.threshold}`,
      sentence: `Te avisaremos cuando el RSI(${alert.period}) de ${ticker} ${above ? "suba por encima" : "baje por debajo"} de ${alert.threshold} en ${tf}.`,
      bullish: !above, // RSI alto suele ser bearish (sobrecompra)
    };
  }
  if (alert.type === "macd") {
    if (alert.condition === "bullish_signal") {
      return {
        indicatorName: `MACD (${alert.emaFast}/${alert.emaSlow}/${alert.signal})`,
        short: "Cruce alcista",
        sentence: `Te avisaremos cuando el MACD cruce la línea de señal al alza para ${ticker} en ${tf}.`,
        bullish: true,
      };
    }
    if (alert.condition === "bearish_signal") {
      return {
        indicatorName: `MACD (${alert.emaFast}/${alert.emaSlow}/${alert.signal})`,
        short: "Cruce bajista",
        sentence: `Te avisaremos cuando el MACD cruce la línea de señal a la baja para ${ticker} en ${tf}.`,
        bullish: false,
      };
    }
    if (alert.condition === "zero_up") {
      return {
        indicatorName: `MACD (${alert.emaFast}/${alert.emaSlow}/${alert.signal})`,
        short: "Cruza cero ↑",
        sentence: `Te avisaremos cuando el MACD cruce la línea cero al alza para ${ticker} en ${tf}.`,
        bullish: true,
      };
    }
    return {
      indicatorName: `MACD (${alert.emaFast}/${alert.emaSlow}/${alert.signal})`,
      short: "Cruza cero ↓",
      sentence: `Te avisaremos cuando el MACD cruce la línea cero a la baja para ${ticker} en ${tf}.`,
      bullish: false,
    };
  }
  if (alert.type === "bollinger") {
    if (alert.condition === "squeeze") {
      return {
        indicatorName: `Bollinger (${alert.period}, σ ${alert.deviation})`,
        short: "Squeeze",
        sentence: `Te avisaremos cuando las bandas de Bollinger de ${ticker} se contraigan (volatilidad baja) en ${tf}.`,
        bullish: null,
      };
    }
    const upper = alert.condition === "touch_upper";
    return {
      indicatorName: `Bollinger (${alert.period}, σ ${alert.deviation})`,
      short: upper ? "Toca banda superior" : "Toca banda inferior",
      sentence: `Te avisaremos cuando el precio de ${ticker} toque la ${upper ? "banda superior" : "banda inferior"} en ${tf}.`,
      bullish: !upper,
    };
  }
  return {
    indicatorName: "Volumen",
    short: `Vol > ${alert.multiplier.toFixed(1).replace(".", ",")}x`,
    sentence: `Te avisaremos cuando el volumen de ${ticker} supere ${alert.multiplier.toFixed(1).replace(".", ",")}x el promedio en ${tf}.`,
    bullish: null,
  };
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
  content: {
    paddingTop: 4,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  previewCard: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    marginBottom: 14,
  },
  previewHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  previewTicker: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.4,
  },
  previewDir: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.2,
  },
  previewText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  infoLabel: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  infoRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoValue: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  infoChevron: {
    fontFamily: fontFamily[600],
    fontSize: 18,
    marginTop: -2,
  },
  deleteBtn: {
    alignSelf: "stretch",
    paddingVertical: 14,
    marginTop: 18,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1.4,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  deleteBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
