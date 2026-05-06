import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { fontFamily, radius, useTheme } from "../theme";
import { Tap } from "./Tap";
import {
  type Asset,
  type AssetCurrency,
  assetCurrency,
  formatMoney,
} from "../data/assets";
import {
  isDuplicateAlertError,
  useAlerts,
} from "../alerts/context";
import {
  type AlertDirection,
  type PriceAlert,
} from "../api/alerts";
import { useToast } from "../toast/context";
import { useAssetColorOptional } from "../asset-color/context";

/**
 * Bottom sheet de creación + gestión de alertas para un activo.
 *
 * Layout (de arriba hacia abajo):
 *   1. Header: "Alertas de precio" + nombre del activo
 *   2. Lista de alertas active (si hay) — cada una con delete
 *   3. Form: input precio + selector dirección + selector moneda
 *   4. CTA "Crear alerta"
 *
 * Interacciones:
 *   - Swipe down para cerrar (mismo patrón que MarketClosedSheet)
 *   - Tap fuera (backdrop) cierra
 *   - Tap "Crear" → llama a useAlerts().create()
 *     - Éxito: toast + cierra
 *     - Error duplicado: error inline en el form, sheet sigue abierto
 *     - Otros errores: mensaje inline genérico
 *   - Delete de alerta: tap en ícono "x" → llama remove() → toast
 */

interface Props {
  visible: boolean;
  asset: Asset;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

// Shortcuts de variación porcentual respecto al precio actual del
// activo. Tap → setea threshold = price * (1 + pct/100). La dirección
// (subir/bajar) se infiere del threshold vs precio actual al crear,
// no la elige el usuario explícitamente.
const QUICK_PCTS = [-25, -10, -5, 5, 10, 25] as const;

export function AlertSheet({ visible, asset, onClose }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { activeForAsset, create, remove } = useAlerts();
  const { show: showToast } = useToast();
  const assetColor = useAssetColorOptional();

  const accent = assetColor ? assetColor.color : c.greenDark;

  const activeAlerts = useMemo(
    () => activeForAsset(asset.ticker),
    [activeForAsset, asset.ticker],
  );

  // Form state — se resetea cada vez que se abre la sheet con un
  // activo nuevo (key={asset.ticker} en el padre asegura remount).
  const [threshold, setThreshold] = useState("");
  const [currency, setCurrency] = useState<AssetCurrency>(
    () => assetCurrency(asset),
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset al cambiar visibilidad — pasada la animación de cierre,
  // limpiamos el form para que la próxima apertura arranque limpia.
  useEffect(() => {
    if (visible) {
      setThreshold("");
      setCurrency(assetCurrency(asset));
      setErrorMsg(null);
    }
  }, [visible, asset]);

  /* ─── Animación bottom sheet (mismo patrón que MarketClosedSheet) ─── */

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

  const handleCreate = async () => {
    setErrorMsg(null);
    const value = parseFloat(threshold.replace(",", "."));
    if (!isFinite(value) || value <= 0) {
      setErrorMsg("Ingresá un precio válido mayor a 0.");
      return;
    }
    // Dirección derivada del threshold vs precio actual — sin
    // segmented selector. Empate → 'above' por convención.
    const direction: AlertDirection = value >= asset.price ? "above" : "below";
    setSubmitting(true);
    try {
      await create({
        assetId: asset.ticker,
        threshold: value,
        direction,
        currency,
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      showToast("Alerta creada", { variant: "success" });
      dismiss();
    } catch (e) {
      if (isDuplicateAlertError(e)) {
        setErrorMsg("Ya tenés una alerta configurada a este precio.");
      } else {
        setErrorMsg("No pudimos crear la alerta. Reintentá.");
      }
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (alert: PriceAlert) => {
    try {
      await remove(alert.id);
      showToast("Alerta eliminada", { variant: "neutral" });
    } catch {
      showToast("No pudimos eliminar la alerta", { variant: "error" });
    }
  };

  /* ─── Keypad handlers — mismo patrón que buy.tsx (in-app
       teclado, sin keyboard nativo). USDT permite 4 decimales,
       ARS/USD se quedan en 2. ─── */

  const maxDecimals = currency === "USDT" ? 4 : 2;

  const handleKey = (k: string) => {
    setErrorMsg(null);
    if (k === "back") {
      setThreshold((p) => (p.length <= 1 ? "" : p.slice(0, -1)));
      return;
    }
    if (k === ".") {
      if (threshold.includes(".")) return;
      setThreshold((p) => (p === "" ? "0." : p + "."));
      return;
    }
    setThreshold((p) => {
      if (p === "" || p === "0") return k;
      if (p.includes(".")) {
        if (p.split(".")[1].length >= maxDecimals) return p;
      }
      return p + k;
    });
  };

  const handleBackLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setThreshold("");
    setErrorMsg(null);
  };

  const applyPct = (pct: number) => {
    setErrorMsg(null);
    const target = asset.price * (1 + pct / 100);
    if (!isFinite(target) || target <= 0) return;
    const decimals = currency === "USDT" ? 4 : 2;
    setThreshold(target.toFixed(decimals));
    Haptics.selectionAsync().catch(() => {});
  };

  // Splitea el threshold en parte entera (con separador de miles
  // estilo es-AR) y decimales — para renderear los decimales en
  // chico/gris al estilo del precio del stock detail.
  const thresholdParts = (() => {
    if (!threshold) return { integer: "0", decimals: null as string | null };
    if (threshold.includes(".")) {
      const [intRaw, decRaw = ""] = threshold.split(".");
      const intDisplay =
        intRaw === "" ? "0" : Number(intRaw).toLocaleString("es-AR");
      return { integer: intDisplay, decimals: decRaw };
    }
    return {
      integer: Number(threshold).toLocaleString("es-AR"),
      decimals: null,
    };
  })();

  /* ─── Render ─── */

  // Selector de monedas: solo la moneda nativa del activo. ARS para
  // mercado argentino, USD para US, USDT para crypto. Se renderiza
  // como una sola pill siempre seleccionada — sin opción de cambiar.
  const allCurrencies: AssetCurrency[] = [assetCurrency(asset)];

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

      <View style={s.kbAvoid} pointerEvents="box-none">
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              s.sheet,
              {
                backgroundColor: c.bg,
                borderColor: c.border,
                paddingBottom: insets.bottom + 18,
              },
              sheetStyle,
            ]}
          >
            <View style={s.grabber}>
              <View
                style={[s.grabberPill, { backgroundColor: c.borderStrong }]}
              />
            </View>

            <View style={s.header}>
              <Text style={[s.title, { color: c.text }]}>
                Alertas de precio
              </Text>
              <Text style={[s.subtitle, { color: c.textMuted }]}>
                {asset.name} · {asset.ticker}
              </Text>
            </View>

            {activeAlerts.length > 0 ? (
              <View style={s.activeList}>
                {activeAlerts.map((a) => (
                  <View
                    key={a.id}
                    style={[
                      s.activeRow,
                      { backgroundColor: c.surfaceHover, borderColor: c.border },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.activeText, { color: c.text }]}>
                        {a.direction === "above" ? "Sube a" : "Baja a"}{" "}
                        <Text style={[s.activeStrong, { color: c.text }]}>
                          {formatMoney(a.threshold, a.currency)}
                        </Text>
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleDelete(a)}
                      hitSlop={10}
                      style={s.deleteBtn}
                      accessibilityLabel="Eliminar alerta"
                    >
                      <Feather name="x" size={18} color={c.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={s.form}>
              <Text style={[s.eyebrow, { color: c.textMuted }]}>
                Nueva alerta
              </Text>

              {/* Display del precio — read-only, alimentado por el
                  keypad in-app de abajo. La pill de moneda queda
                  fija (única opción según mercado del activo). */}
              <View
                style={[
                  s.field,
                  {
                    backgroundColor: c.surface,
                    borderColor: errorMsg ? c.red : c.border,
                  },
                ]}
              >
                <View style={s.fieldHeader}>
                  <Text style={[s.fieldLabel, { color: c.textMuted }]}>
                    Precio objetivo
                  </Text>
                  <View style={s.currencyRow}>
                    {allCurrencies.map((cu) => (
                      <View
                        key={cu}
                        style={[
                          s.currencyChip,
                          {
                            backgroundColor: c.text,
                            borderColor: c.text,
                          },
                        ]}
                      >
                        <Text style={[s.currencyText, { color: c.bg }]}>
                          {cu}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={s.fieldDisplayRow}>
                  <Text
                    style={[
                      s.fieldDisplayInteger,
                      {
                        color: threshold ? c.text : c.textFaint,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {thresholdParts.integer}
                  </Text>
                  {thresholdParts.decimals !== null ? (
                    <Text
                      style={[
                        s.fieldDisplayDecimals,
                        { color: c.textMuted },
                      ]}
                    >
                      ,{thresholdParts.decimals}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Quick % chips — aplican price * (1 + pct/100) y
                  autoflippean dirección según signo. */}
              <View style={s.quickRow}>
                {QUICK_PCTS.map((pct) => (
                  <Tap
                    key={pct}
                    style={[
                      s.quickChip,
                      {
                        backgroundColor: c.surface,
                        borderColor: c.border,
                      },
                    ]}
                    haptic="selection"
                    onPress={() => applyPct(pct)}
                  >
                    <Text style={[s.quickText, { color: c.text }]}>
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </Text>
                  </Tap>
                ))}
              </View>

              {/* Keypad in-app — mismo layout que buy.tsx. */}
              <View style={s.keypad}>
                {KEYS.map((row, ri) => (
                  <View key={ri} style={s.keyRow}>
                    {row.map((k) => (
                      <Tap
                        key={k}
                        onPress={() => handleKey(k)}
                        onLongPress={
                          k === "back" ? handleBackLongPress : undefined
                        }
                        delayLongPress={400}
                        haptic="selection"
                        pressScale={0.92}
                        rippleColor="rgba(14,15,12,0.08)"
                        rippleContained={false}
                        style={s.keyBtn}
                      >
                        {k === "back" ? (
                          <Feather name="delete" size={22} color={c.text} />
                        ) : (
                          <Text style={[s.keyText, { color: c.text }]}>
                            {k === "." ? "," : k}
                          </Text>
                        )}
                      </Tap>
                    ))}
                  </View>
                ))}
              </View>

              {errorMsg ? (
                <Text style={[s.errorText, { color: c.red }]}>
                  {errorMsg}
                </Text>
              ) : null}

              <Tap
                style={[
                  s.cta,
                  {
                    backgroundColor: submitting ? c.textMuted : accent,
                    opacity: submitting ? 0.7 : 1,
                  },
                ]}
                haptic="medium"
                onPress={handleCreate}
                disabled={submitting}
              >
                <Text style={[s.ctaText, { color: c.bg }]}>
                  {submitting ? "Creando…" : "Crear alerta"}
                </Text>
              </Tap>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  kbAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
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
    borderRadius: 2,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 14,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  activeList: {
    gap: 8,
    paddingBottom: 14,
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  activeText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  activeStrong: {
    fontFamily: fontFamily[700],
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    paddingTop: 4,
    gap: 12,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  fieldDisplayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  fieldDisplayInteger: {
    fontFamily: fontFamily[700],
    fontSize: 28,
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  fieldDisplayDecimals: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
    lineHeight: 16,
    marginTop: 4,
    marginLeft: 1,
  },
  currencyRow: {
    flexDirection: "row",
    gap: 6,
  },
  quickRow: {
    flexDirection: "row",
    gap: 6,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  quickText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  keypad: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  keyBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontFamily: fontFamily[600],
    fontSize: 24,
    letterSpacing: -0.5,
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  currencyText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.4,
  },
  errorText: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: -4,
  },
  cta: {
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
