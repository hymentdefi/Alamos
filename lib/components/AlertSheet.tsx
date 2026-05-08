import { useCallback, useEffect, useMemo, useState } from "react";
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
import { PercentRangeSlider } from "./PercentRangeSlider";
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
  /** Si está presente, la sheet abre en modo EDICIÓN: precarga el
   *  threshold + currency de la alerta, el CTA dice "Guardar" y al
   *  submit llama update() en lugar de create(). Si es undefined,
   *  modo CREACIÓN normal. */
  editingAlert?: PriceAlert;
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
//
// Opacity ramp continua: la magnitud del chip mapea linealmente a la
// opacidad. ±5 → 35 %, ±10 → 65 %, ±25 → 100 %. Da sensación de
// "escala" en vez de "botones individuales sueltos".
//
// Naranja del lado negativo, verde del positivo.
const QUICK_CHIPS: { pct: number; opacity: number }[] = [
  { pct: -25, opacity: 1 },
  { pct: -10, opacity: 0.65 },
  { pct: -5, opacity: 0.35 },
  { pct: 5, opacity: 0.35 },
  { pct: 10, opacity: 0.65 },
  { pct: 25, opacity: 1 },
];

/* Rango del slider — coincide con PercentRangeSlider. Valores fuera
 * de este rango en la UI se manejan como "fuera de rango" (slider
 * en su extremo + clamp visual; el threshold puede seguir teniendo
 * el valor que el usuario ingresó por keypad). */
const SLIDER_RANGE = 30;

export function AlertSheet({
  visible,
  asset,
  editingAlert,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  /* Ancho del slider: el sheet tiene paddingHorizontal 24 a cada
   * lado. El slider rellena de borde a borde del padding. */
  const SLIDER_WIDTH = windowW - 48;
  const { activeForAsset, create, update, remove } = useAlerts();
  const { show: showToast } = useToast();
  const isEditing = !!editingAlert;

  const activeAlerts = useMemo(
    () => activeForAsset(asset.ticker),
    [activeForAsset, asset.ticker],
  );

  // Form state — se resetea cada vez que se abre la sheet con un
  // activo nuevo (key del padre asegura remount). En modo edit
  // arrancamos con el threshold de la alerta.
  const [threshold, setThreshold] = useState("");
  const [currency, setCurrency] = useState<AssetCurrency>(
    () => editingAlert?.currency ?? assetCurrency(asset),
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset al cambiar visibilidad — pasada la animación de cierre,
  // limpiamos el form para que la próxima apertura arranque limpia.
  // En modo edit, precargamos el threshold con el formato del keypad
  // (punto como separador decimal, sin separadores de miles).
  useEffect(() => {
    if (visible) {
      if (editingAlert) {
        const decimals = editingAlert.currency === "USDT" ? 4 : 2;
        const txt = editingAlert.threshold.toFixed(decimals);
        // Saco trailing zeros si los hay (1500.00 → 1500).
        setThreshold(
          txt.includes(".") ? txt.replace(/\.?0+$/, "") : txt,
        );
        setCurrency(editingAlert.currency);
      } else {
        setThreshold("");
        setCurrency(assetCurrency(asset));
      }
      setErrorMsg(null);
    }
  }, [visible, asset, editingAlert]);

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

  const handleSubmit = async () => {
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
      if (editingAlert) {
        await update(editingAlert.id, { threshold: value, direction });
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        showToast("Alerta actualizada", { variant: "success" });
      } else {
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
      }
      dismiss();
    } catch (e) {
      if (isDuplicateAlertError(e)) {
        setErrorMsg("Ya tenés una alerta configurada a este precio.");
      } else {
        setErrorMsg(
          editingAlert
            ? "No pudimos actualizar la alerta. Reintentá."
            : "No pudimos crear la alerta. Reintentá.",
        );
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

  /* Slider drives:
   *   - el slider llama onChange(pct) durante el drag con un valor
   *     continuo en [-30, +30].
   *   - convertimos a threshold con price * (1 + pct/100) y lo
   *     guardamos como string formateado, lo que dispara la sincro
   *     hacia el field display + keypad.
   *   - el threshold escrito a mano por keypad también se refleja
   *     hacia atrás al slider via `sliderPct` (memo abajo). */
  const handleSliderChange = useCallback(
    (pct: number) => {
      if (!asset.price) return;
      const decimals = currency === "USDT" ? 4 : 2;
      const target = asset.price * (1 + pct / 100);
      if (!isFinite(target) || target <= 0) return;
      setThreshold(target.toFixed(decimals));
      setErrorMsg(null);
    },
    [asset.price, currency],
  );

  /* Dos pcts derivados del threshold:
   *   - actualPct: SIN clamp, refleja el delta real (puede ser
   *     +120 % si el user tipea un precio muy lejos del actual).
   *     Se muestra inline al lado del precio.
   *   - sliderPct: clampeado a [-30, +30] para la posición visual
   *     del thumb. El slider no puede mostrar valores fuera de su
   *     rango — si el actual está afuera, el thumb queda en el
   *     extremo correspondiente. */
  const actualPct = useMemo(() => {
    const v = parseFloat(threshold.replace(",", "."));
    if (!isFinite(v) || v <= 0 || asset.price <= 0) return 0;
    return (v / asset.price - 1) * 100;
  }, [threshold, asset.price]);

  const sliderPct = useMemo(
    () => Math.max(-SLIDER_RANGE, Math.min(SLIDER_RANGE, actualPct)),
    [actualPct],
  );

  /* Diferencia exacta para mostrar arriba del slider: precio actual
   * + delta absoluto (precio target en moneda nativa) + signo. */
  const targetValue = useMemo(() => {
    const v = parseFloat(threshold.replace(",", "."));
    if (!isFinite(v) || v <= 0) return null;
    return v;
  }, [threshold]);

  const direction: AlertDirection = useMemo(() => {
    if (targetValue == null) return "above";
    return targetValue >= asset.price ? "above" : "below";
  }, [targetValue, asset.price]);

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
                {isEditing ? "Editar alerta" : "Nueva alerta de precio"}
              </Text>
              <Text style={[s.subtitle, { color: c.textMuted }]}>
                {asset.name} · {asset.ticker}
              </Text>
            </View>

            {!isEditing && activeAlerts.length > 0 ? (
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
                {isEditing ? "Editando" : "Nueva alerta"}
              </Text>

              {/* Display del precio — read-only, alimentado por el
                  slider, los chips o el keypad. El banner de "precio
                  actual" desapareció (vive en el header, era
                  redundante). El % delta se integra como texto
                  secundario al lado del precio, no como pill. */}
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
                  {/* Delta inline — texto secundario al lado del
                      precio, no pill. Verde si sube, naranja si baja.
                      Se omite cuando el threshold está vacío o vale
                      el precio actual exacto (delta = 0). */}
                  {targetValue != null && Math.abs(actualPct) >= 0.05 ? (
                    <Text
                      style={[
                        s.fieldDeltaInline,
                        {
                          color: direction === "above" ? c.brand : c.red,
                        },
                      ]}
                    >
                      {actualPct >= 0 ? "+" : ""}
                      {actualPct.toFixed(1)}%
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Slider -30% / +30% — sincronizado con el threshold.
                  Mover acá actualiza el threshold; tipear en el
                  keypad mueve el thumb del slider. */}
              <PercentRangeSlider
                value={sliderPct}
                onChange={handleSliderChange}
                positiveColor={c.brand}
                negativeColor={c.red}
                width={SLIDER_WIDTH}
              />

              {/* Quick % chips — naranja del lado negativo, verde del
                  positivo, con opacidad progresiva (más cerca del 0
                  → más translúcido). Tap aplica price * (1 + pct/100)
                  y sincroniza el slider. */}
              <View style={s.quickRow}>
                {QUICK_CHIPS.map(({ pct, opacity }) => {
                  const isNeg = pct < 0;
                  const tone = isNeg ? c.red : c.brand;
                  return (
                    <Tap
                      key={pct}
                      style={[
                        s.quickChip,
                        {
                          backgroundColor: tone,
                          borderColor: tone,
                          opacity,
                        },
                      ]}
                      haptic="selection"
                      onPress={() => applyPct(pct)}
                    >
                      <Text style={[s.quickText, { color: c.onColor }]}>
                        {pct > 0 ? `+${pct}%` : `${pct}%`}
                      </Text>
                    </Tap>
                  );
                })}
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
                    /* CTA neutro ink/text — coherente con el botón
                     * principal de la pantalla de alertas. El brand
                     * verde lo dejamos para CTAs primarios del flow
                     * de transacciones (Operar, Comprar, etc.). */
                    backgroundColor: submitting ? c.textMuted : c.text,
                    opacity: submitting ? 0.7 : 1,
                  },
                ]}
                haptic="medium"
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={[s.ctaText, { color: c.bg }]}>
                  {submitting
                    ? isEditing
                      ? "Guardando…"
                      : "Creando…"
                    : isEditing
                    ? "Guardar cambios"
                    : "Crear alerta"}
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
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  grabber: {
    alignItems: "center",
    paddingVertical: 10,
  },
  grabberPill: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -0.9,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    marginTop: 4,
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
  /* Form gap aumentado para que la pantalla respire — el banner
   * de "precio actual" desapareció y el espacio liberado se reparte
   * acá, separando precio objetivo / slider / chips / keypad. */
  form: {
    paddingTop: 4,
    gap: 24,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  field: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
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
    fontSize: 36,
    letterSpacing: -0.9,
    lineHeight: 38,
  },
  fieldDisplayDecimals: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginTop: 6,
    marginLeft: 2,
  },
  /* Delta inline al lado del precio — texto secundario coloreado
   * por signo. NO es una pill, NO es una chip; es parte del display
   * tipográfico del precio para que se sienta integrado. */
  fieldDeltaInline: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
    lineHeight: 22,
    marginLeft: 10,
    marginTop: 8,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 4,
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  quickText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  keypad: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  keyBtn: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontFamily: fontFamily[600],
    fontSize: 28,
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
    height: 58,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  ctaText: {
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.2,
  },
});
