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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../theme";
import { formatMoney } from "../data/assets";
import { convertAmount } from "../data/accounts";
import { AlamosBalanceIllustration } from "./illustrations/AlamosBalanceIllustration";

type Currency = "ARS" | "USD";

interface Props {
  visible: boolean;
  onClose: () => void;
  selected: Currency;
  totalArs: number;
  onSelect: (c: Currency) => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

/**
 * CurrencySheet — pick "cómo querés ver tu portfolio".
 *
 * Es DELIBERADO: el usuario abre el sheet desde un pill, lee el
 * contexto (mismo portfolio, distinta valuación), y elige una de
 * las dos cards. No hay swipe horizontal — el cambio de moneda se
 * confirma activamente con un tap.
 *
 * Mismo patrón visual que BalanceInfoSheet (modal sheet con grabber,
 * gesture pan para dismiss, backdrop). La diferencia: las dos
 * opciones son tappable cards con el monto convertido + check mark
 * en la activa.
 */
export function CurrencySheet({
  visible,
  onClose,
  selected,
  totalArs,
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

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handlePick = (cur: Currency) => {
    Haptics.selectionAsync().catch(() => {});
    if (cur !== selected) onSelect(cur);
    dismiss();
  };

  const arsValue = totalArs;
  const usdValue = convertAmount(totalArs, "ARS", "USD");

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
              paddingBottom: insets.bottom + 24,
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
            <View style={s.heroWrap}>
              <AlamosBalanceIllustration size={140} play={visible} />
            </View>
            <Text style={[s.title, { color: c.text }]}>
              Cómo ver tu portfolio
            </Text>
            <Text style={[s.body, { color: c.textSecondary }]}>
              Es el mismo portfolio. Sólo cambia la moneda en la que
              ves los valores. Las tenencias se convierten al oficial
              vendedor.
            </Text>

            <View style={s.options}>
              <CurrencyOption
                label="Pesos"
                code="ARS"
                amount={arsValue}
                selected={selected === "ARS"}
                onPress={() => handlePick("ARS")}
              />
              <CurrencyOption
                label="Dólares"
                code="USD"
                amount={usdValue}
                selected={selected === "USD"}
                onPress={() => handlePick("USD")}
              />
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

interface OptProps {
  label: string;
  code: Currency;
  amount: number;
  selected: boolean;
  onPress: () => void;
}

function CurrencyOption({
  label,
  code,
  amount,
  selected,
  onPress,
}: OptProps) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.option,
        {
          backgroundColor: selected ? c.text : c.surface,
          borderColor: selected ? c.text : c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={s.optionLeft}>
        <Text
          style={[
            s.optionLabel,
            { color: selected ? c.bg : c.textSecondary },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            s.optionAmount,
            { color: selected ? c.bg : c.text },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMoney(amount, code)}
        </Text>
      </View>
      {selected ? (
        <View style={[s.check, { backgroundColor: c.bg }]}>
          <Feather name="check" size={14} color={c.text} />
        </View>
      ) : (
        <View
          style={[
            s.checkEmpty,
            { borderColor: c.borderStrong },
          ]}
        />
      )}
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
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 24,
    letterSpacing: -0.8,
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  optionLeft: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  optionAmount: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
