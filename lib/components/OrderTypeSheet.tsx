import { useEffect, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { fontFamily, radius, useTheme } from "../theme";
import type { AssetCurrency } from "../data/assets";

export type OrderType = "market" | "limit";

interface Props {
  visible: boolean;
  orderType: OrderType;
  /** Precio límite actual como string. Vacío si todavía no se cargó.
   *  Lo manejamos como string para evitar problemas de parseo del
   *  TextInput (separadores, coma vs punto, etc.). */
  limitPrice: string;
  /** Precio actual del activo — placeholder + ancla para el límite. */
  currentPrice: number;
  /** Moneda nativa del activo (para el prefix/suffix del input). */
  currency: AssetCurrency;
  /** Side de la operación — define el comportamiento del límite:
   *   buy  → ejecuta cuando price <= limit
   *   sell → ejecuta cuando price >= limit */
  side: "buy" | "sell";
  onApply: (next: { orderType: OrderType; limitPrice: string }) => void;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

/**
 * Sheet para elegir el tipo de orden — Mercado o Límite. Cuando se
 * selecciona Límite, aparece un input para definir el precio objetivo.
 * El sheet se cierra con swipe-down (gesture en UI thread) o con tap
 * en el backdrop. Aplicar persiste la selección y cierra.
 */
export function OrderTypeSheet({
  visible,
  orderType,
  limitPrice,
  currentPrice,
  currency,
  side,
  onApply,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();

  const [draftType, setDraftType] = useState<OrderType>(orderType);
  const [draftPrice, setDraftPrice] = useState<string>(limitPrice);

  // Sincronizar el draft con el value externo cada vez que se abre
  // el sheet — si el user lo abrió previamente, cambió algo, y
  // cerró sin aplicar, al reabrirlo tiene que ver lo aplicado, no
  // el draft anterior.
  useEffect(() => {
    if (visible) {
      setDraftType(orderType);
      setDraftPrice(limitPrice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const translateY = useSharedValue(windowH);
  const backdropOpacity = useSharedValue(0);
  /* Offset vertical para levantar el sheet cuando aparece el
   *  teclado virtual — sino el CTA "Aplicar" queda tapado. Lo
   *  manejamos como sharedValue para animarlo en UI thread junto
   *  con el resto de transforms del sheet. */
  const keyboardOffset = useSharedValue(0);

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

  /* Listeners del teclado — keyboardWillShow en iOS (anticipa la
   *  animación), keyboardDidShow en Android (no expone el evento
   *  "will"). La duración del evento es la nativa del teclado;
   *  espejamos con withTiming para mantenerlo smooth. */
  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: { endCoordinates: { height: number } }) => {
      keyboardOffset.value = withTiming(e.endCoordinates.height, {
        duration: 250,
      });
    };
    const onHide = () => {
      keyboardOffset.value = withTiming(0, { duration: 200 });
    };
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  /* Cuando el sheet se cierra, también cerramos el teclado para que
   *  no quede el offset sin sheet por encima. */
  useEffect(() => {
    if (!visible) Keyboard.dismiss();
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
        backdropOpacity.value = Math.max(
          0,
          1 - e.translationY / windowH,
        );
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

  const sheetStyle = useAnimatedStyle(() => {
    /* Combina el drag (translateY del swipe) con el offset del
     *  teclado. Cuando el teclado aparece, el sheet sube SÓLO
     *  (keyboardOffset - safeAreaBottom). Razón: el padding bottom
     *  del sheet (insets.bottom + 18) ya tenía espacio reservado
     *  para la safe area del home indicator; cuando el teclado
     *  aparece, ése espacio queda redundante (el teclado lo
     *  cubre). Restarlo nos deja el CTA sentado a ~18px sobre el
     *  teclado en vez de "flotando" alto y con gap visual feo. */
    const compensatedOffset =
      keyboardOffset.value > 0
        ? Math.max(0, keyboardOffset.value - insets.bottom)
        : 0;
    return {
      transform: [
        { translateY: translateY.value - compensatedOffset },
      ],
    };
  });
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const select = (next: OrderType) => {
    if (next === draftType) return;
    Haptics.selectionAsync().catch(() => {});
    setDraftType(next);
  };

  /* Normaliza coma → punto y bloquea caracteres no numéricos. El
   *  TextInput nativo ya filtra por keyboardType, pero algunos
   *  layouts (Android español) dejan pasar comas; las convertimos. */
  const onChangePrice = (raw: string) => {
    const cleaned = raw
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1");
    setDraftPrice(cleaned);
  };

  const parsedPrice = Number.parseFloat(draftPrice) || 0;
  const limitInvalid = draftType === "limit" && parsedPrice <= 0;

  const apply = () => {
    if (limitInvalid) return;
    Haptics.selectionAsync().catch(() => {});
    /* Cerrar teclado primero para que el offset baje antes de
     *  animar el sheet — sino se ve el sheet bajar levantado y
     *  después el teclado desaparecer, dejando un blank flash. */
    Keyboard.dismiss();
    onApply({
      orderType: draftType,
      limitPrice: draftType === "limit" ? draftPrice : "",
    });
    dismiss();
  };

  const symbol =
    currency === "ARS" ? "$" : currency === "USD" ? "US$" : "USDT";
  const placeholderPrice = currentPrice.toFixed(currentPrice < 1 ? 4 : 2);
  const limitHint =
    side === "buy"
      ? `Se ejecuta cuando el precio baje a ${symbol} ${placeholderPrice}`
      : `Se ejecuta cuando el precio suba a ${symbol} ${placeholderPrice}`;

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
            },
            sheetStyle,
          ]}
        >
          <View style={s.grabber}>
            <View
              style={[s.grabberPill, { backgroundColor: c.borderStrong }]}
            />
          </View>

          <View style={s.hero}>
            <Text style={[s.title, { color: c.text }]}>Tipo de orden</Text>
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              Elegí cómo querés que se ejecute
            </Text>
          </View>

          <View style={s.optionsCol}>
            <OptionRow
              selected={draftType === "market"}
              onPress={() => select("market")}
              icon="zap"
              title="Mercado"
              description="Se ejecuta ahora al precio disponible"
            />
            <OptionRow
              selected={draftType === "limit"}
              onPress={() => select("limit")}
              icon="target"
              title="Límite"
              description={
                side === "buy"
                  ? "Comprás cuando baje al precio que definís"
                  : "Vendés cuando suba al precio que definís"
              }
            />
          </View>

          {draftType === "limit" ? (
            <View style={s.limitBlock}>
              <Text style={[s.limitLabel, { color: c.textMuted }]}>
                Precio límite
              </Text>
              <View
                style={[
                  s.limitInputRow,
                  {
                    backgroundColor: c.surfaceSunken,
                    borderColor: limitInvalid ? c.red : c.border,
                  },
                ]}
              >
                <Text style={[s.limitSymbol, { color: c.textMuted }]}>
                  {symbol}
                </Text>
                <TextInput
                  value={draftPrice}
                  onChangeText={onChangePrice}
                  placeholder={placeholderPrice}
                  placeholderTextColor={c.textFaint}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  /* iOS muestra el botón "Listo" en el accessory bar
                   *  arriba del teclado decimal-pad; al apretarlo se
                   *  cierra el teclado sin aplicar (igual que tocar
                   *  fuera). Android no muestra accessory bar para
                   *  numérico, así que esa plataforma queda como
                   *  estaba (el user toca Aplicar o cierra con back). */
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={[s.limitInput, { color: c.text }]}
                  selectionColor={c.brand}
                />
              </View>
              <Text style={[s.limitHint, { color: c.textMuted }]}>
                {limitHint}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={apply}
            disabled={limitInvalid}
            style={[
              s.cta,
              {
                backgroundColor: limitInvalid ? c.surfaceHover : c.brand,
              },
            ]}
          >
            <Text
              style={[
                s.ctaText,
                { color: limitInvalid ? c.textMuted : c.onColor },
              ]}
            >
              Aplicar
            </Text>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

function OptionRow({
  selected,
  onPress,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onPress: () => void;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        cs.row,
        {
          backgroundColor: c.surface,
          borderColor: selected ? c.brand : c.border,
          borderWidth: selected ? 1.6 : 1,
        },
      ]}
    >
      <View
        style={[
          cs.iconWrap,
          {
            backgroundColor: selected ? c.brand : c.surfaceHover,
          },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={selected ? c.onColor : c.textSecondary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[cs.title, { color: c.text }]}>{title}</Text>
        <Text
          style={[cs.description, { color: c.textMuted }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>
      {selected ? (
        <View style={[cs.checkBubble, { backgroundColor: c.brand }]}>
          <Text style={[cs.checkText, { color: c.onColor }]}>✓</Text>
        </View>
      ) : null}
    </Pressable>
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
    maxHeight: "92%",
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
  hero: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 18,
    gap: 4,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 24,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  optionsCol: {
    gap: 10,
  },
  limitBlock: {
    marginTop: 18,
    gap: 6,
  },
  limitLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  limitInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
  },
  limitSymbol: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  limitInput: {
    flex: 1,
    fontFamily: fontFamily[700],
    fontSize: 20,
    letterSpacing: -0.4,
    padding: 0,
  },
  limitHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  cta: {
    marginTop: 22,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: radius.btn,
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});

const cs = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: radius.md,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
  },
  description: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  checkBubble: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: 11,
  },
  checkText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 14,
  },
});
