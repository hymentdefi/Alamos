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
import { fontFamily, fontMono, radius, useTheme } from "../theme";
import { MarketClosedIllustration } from "./illustrations/MarketClosedIllustration";
import type { MarketSession } from "../market/hours";

interface Props {
  visible: boolean;
  /** Tipo de instrumento — define el copy ("Acciones AR", "CEDEARs",
   *  "Bonos", etc.). */
  instrumentLabel: string;
  /** Sesión de mercado del activo — horario + días. */
  session: MarketSession;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

/**
 * Bottom sheet "Mercado cerrado". Sin botones de cerrar — se cierra
 * deslizando hacia abajo (swipe gesture smooth con reanimated en UI
 * thread). Mismo patrón que ChartSettingsSheet.
 */
export function MarketClosedSheet({
  visible,
  instrumentLabel,
  session,
  onClose,
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

          <View style={s.content}>
            <View style={s.illustrationWrap}>
              <MarketClosedIllustration size={188} />
            </View>

            <Text style={[s.title, { color: c.text }]}>Mercado cerrado</Text>
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              {instrumentLabel} se operan{" "}
              <Text style={[s.subtitleBold, { color: c.text }]}>
                {session.days}
              </Text>
              , de{" "}
              <Text style={[s.subtitleMono, { color: c.text }]}>
                {session.hours}
              </Text>
              .
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
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
  content: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 12,
  },
  illustrationWrap: {
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -1,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  subtitleBold: {
    fontFamily: fontFamily[700],
  },
  subtitleMono: {
    fontFamily: fontMono[700],
    letterSpacing: 0,
  },
});
