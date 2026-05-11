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
import { fontFamily, radius, useTheme } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

/**
 * Bottom sheet "¿Qué es PyG?". Sin botones de cerrar — se cierra
 * deslizando hacia abajo (mismo patrón que MarketClosedSheet /
 * EarningsInfoSheet / ChartSettingsSheet). Explica al usuario que
 * el PyG es la ganancia / pérdida del día sobre el valor total del
 * portfolio.
 */
export function PygInfoSheet({ visible, onClose }: Props) {
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
            <Text style={[s.title, { color: c.text }]}>
              ¿Qué es PyG?
            </Text>

            <Text style={[s.body, { color: c.textSecondary }]}>
              Es tu{" "}
              <Text style={[s.bodyBold, { color: c.text }]}>
                Pérdida y Ganancia
              </Text>{" "}
              del día. Te muestra cuánto subió o bajó el valor total de
              tus posiciones desde la apertura, en monto y en porcentaje.
            </Text>

            <View style={s.bullets}>
              <Bullet
                tone={c.brand}
                label="Ganancia"
                desc="Cuando tu portfolio vale más que al inicio del día. Se muestra en verde."
              />
              <Bullet
                tone={c.red}
                label="Pérdida"
                desc="Cuando tu portfolio vale menos que al inicio del día. Se muestra en naranja."
              />
            </View>

            <Text style={[s.footnote, { color: c.textMuted }]}>
              El PyG cambia minuto a minuto durante la rueda y se cierra
              al final del día. No es una ganancia realizada hasta que
              vendas las posiciones.
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

function Bullet({
  label,
  desc,
  tone,
}: {
  label: string;
  desc: string;
  tone: string;
}) {
  const { c } = useTheme();
  return (
    <View style={s.bullet}>
      <Text style={[s.bulletLabel, { color: tone }]}>{label}.</Text>
      <Text style={[s.bulletDesc, { color: c.textSecondary }]}> {desc}</Text>
    </View>
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
    paddingTop: 18,
    paddingHorizontal: 6,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -1,
    marginBottom: 14,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 22,
  },
  bodyBold: {
    fontFamily: fontFamily[700],
  },
  bullets: {
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  bullet: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  bulletLabel: {
    fontFamily: fontFamily[800],
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  bulletDesc: {
    fontFamily: fontFamily[500],
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: -0.15,
    flexShrink: 1,
  },
  footnote: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
