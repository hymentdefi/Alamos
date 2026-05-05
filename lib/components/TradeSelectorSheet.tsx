import { useEffect } from "react";
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
import type { Asset } from "../data/assets";

/**
 * Sheet selector que aparece al tocar "Operar" en la TradeBottomBar.
 *
 * Muestra las dos acciones primarias del flow:
 *   - Comprar — siempre disponible
 *   - Vender  — sólo si el usuario tiene posición abierta
 *
 * Cada opción rutea al flow existente (/(app)/buy?mode=...). El
 * brief es explícito: NO reescribir los flows internos. Esta sheet
 * es solo el dispatcher.
 *
 * Visual coherente con MarketClosedSheet y AlertSheet: bottom sheet
 * con grabber, swipe-down para cerrar, backdrop opaco al 40%.
 */

interface Props {
  visible: boolean;
  asset: Asset;
  hasPosition: boolean;
  onClose: () => void;
  onSelect: (mode: "buy" | "sell") => void;
}

const DISMISS_TRANSLATE = 90;
const DISMISS_VELOCITY = 600;

export function TradeSelectorSheet({
  visible,
  asset,
  hasPosition,
  onClose,
  onSelect,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();

  const translateY = useSharedValue(windowH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    translateY.value = withTiming(
      windowH,
      { duration: 220, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) runOnJS(onClose)();
      },
    );
    backdropOpacity.value = withTiming(0, { duration: 220 });
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
          { duration: 220, easing: Easing.in(Easing.cubic) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(onClose)();
          },
        );
        backdropOpacity.value = withTiming(0, { duration: 220 });
      } else {
        translateY.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
        backdropOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleSelect = (mode: "buy" | "sell") => {
    // Cerramos primero (animación de salida) y disparamos la
    // selección DESPUÉS — así el push de navigate corre con la
    // sheet ya fuera de pantalla y se ve más limpio.
    translateY.value = withTiming(
      windowH,
      { duration: 200, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) {
          runOnJS(onClose)();
          runOnJS(onSelect)(mode);
        }
      },
    );
    backdropOpacity.value = withTiming(0, { duration: 200 });
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
            <Text style={[s.title, { color: c.text }]}>{asset.ticker}</Text>
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              ¿Qué querés hacer?
            </Text>
          </View>

          <View style={s.options}>
            <OptionRow
              label="Comprar"
              hint={`Sumar ${asset.ticker} a tu cartera`}
              icon="trending-up"
              onPress={() => handleSelect("buy")}
            />
            {hasPosition ? (
              <OptionRow
                label="Vender"
                hint="Cerrar parte o toda la posición"
                icon="trending-down"
                onPress={() => handleSelect("sell")}
              />
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

interface OptionRowProps {
  label: string;
  hint: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}

function OptionRow({ label, hint, icon, onPress }: OptionRowProps) {
  const { c } = useTheme();
  return (
    <Tap
      style={[s.optRow, { borderColor: c.border }]}
      haptic="selection"
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <View style={[s.optIcon, { backgroundColor: c.surfaceHover }]}>
        <Feather name={icon} size={18} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.optLabel, { color: c.text }]}>{label}</Text>
        <Text style={[s.optHint, { color: c.textMuted }]}>{hint}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={c.textFaint} />
    </Tap>
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
    borderRadius: 2,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 12,
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
  options: {
    gap: 8,
    paddingTop: 4,
  },
  optRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
  },
  optIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  optLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  optHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
});
