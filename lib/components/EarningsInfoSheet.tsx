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
import { HeroSkylineIllustration } from "./illustrations/HeroSkylineIllustration";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

/**
 * Bottom sheet "Tu dinero". Sin botones de cerrar — se cierra
 * deslizando hacia abajo (mismo patrón que MarketClosedSheet /
 * ChartSettingsSheet). Explica qué es la sección "Tu dinero" del
 * home: efectivo no invertido, disponible para ingresar, enviar
 * o convertir entre pesos y dólares.
 */
export function EarningsInfoSheet({ visible, onClose }: Props) {
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
            <View style={s.heroWrap}>
              <HeroSkylineIllustration width={340} />
            </View>

            <Text style={[s.title, { color: c.text }]}>Tu dinero</Text>

            <Text style={[s.body, { color: c.textSecondary }]}>
              Acá ves todo el efectivo que mantenés en tu cuenta y que
              todavía no invertiste — tu plata libre, lista para usar en
              cualquier momento.
            </Text>

            <View style={s.bullets}>
              <Bullet
                label="Ingresar"
                desc="Sumá pesos o dólares por transferencia desde tu banco. Acreditación inmediata."
              />
              <Bullet
                label="Enviar"
                desc="Transferí a otro CBU, CVU o alias — propio o de un tercero — sin comisiones."
              />
              <Bullet
                label="Convertir"
                desc="Cambiá entre pesos y dólares al tipo de cambio del momento, sin mínimos ni costos ocultos."
              />
            </View>

            <Text style={[s.footnote, { color: c.textMuted }]}>
              Mientras tanto, tu saldo siempre está disponible: lo podés
              invertir en cualquier instrumento del mercado o dejarlo
              ahí, listo para cuando lo necesites.
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

function Bullet({ label, desc }: { label: string; desc: string }) {
  const { c } = useTheme();
  return (
    <View style={s.bullet}>
      <Text style={[s.bulletLabel, { color: c.text }]}>{label}.</Text>
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
    paddingTop: 14,
    paddingHorizontal: 6,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 22,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -1,
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 20,
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
    fontFamily: fontFamily[700],
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
