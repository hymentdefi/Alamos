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
import Svg, { Path, Rect } from "react-native-svg";
import { fontFamily, radius, useTheme } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

/**
 * Ilustración "PyG" — replica del SVG en /icono-pyg.svg, inline con
 * react-native-svg. Cuadrado de esquinas redondeadas: mitad superior
 * verde con flecha hacia arriba, mitad inferior blanca con flecha
 * hacia abajo. Comunica visualmente "ganancia o pérdida" antes del
 * copy. Tamaño escalable vía prop `size`.
 */
function PygIcon({ size }: { size: number }) {
  const STROKE = "#0E4310";
  const GREEN = "#5FE850";
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Rect
        x={22}
        y={22}
        width={156}
        height={156}
        rx={14}
        fill="#FFFFFF"
        stroke={STROKE}
        strokeWidth={3}
      />
      <Rect
        x={22}
        y={22}
        width={156}
        height={74}
        rx={14}
        fill={GREEN}
        stroke={STROKE}
        strokeWidth={3}
      />
      <Path d="M22 96 H178" stroke={STROKE} strokeWidth={3} />
      <Path
        d="M70 70 L88 50 L106 70 M88 50 V82"
        stroke={STROKE}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M70 130 L88 150 L106 130 M88 150 V118"
        stroke={STROKE}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Bottom sheet "¿Qué es PyG?". Mismo patrón de presentación que
 * MarketClosedSheet / EarningsInfoSheet / ChartSettingsSheet — se
 * cierra deslizando hacia abajo, sin botones. Layout simple a la
 * Robinhood: ilustración dominante arriba, título + body abajo.
 * Cero distracciones secundarias (sin bullets, sin disclaimers).
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
              paddingBottom: insets.bottom + 32,
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
            {/* Ilustración dominante — 168 px vs los 108 anteriores.
                Robinhood usa heroes grandes en sus modales (los
                onboarding ilustrados rondan los 180-220 px), el icono
                tiene que ganar la jerarquía visual contra el título. */}
            <View style={s.illustrationWrap}>
              <PygIcon size={168} />
            </View>

            <Text style={[s.title, { color: c.text }]}>
              ¿Qué es PyG?
            </Text>

            <Text style={[s.body, { color: c.textMuted }]}>
              Es tu{" "}
              <Text style={[s.bodyBold, { color: c.text }]}>
                Pérdida y Ganancia
              </Text>{" "}
              del día. Te muestra cuánto subió o bajó el valor total
              de tus posiciones desde la apertura, en monto y en
              porcentaje.
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
    borderCurve: "continuous",
    borderRadius: 2,
  },
  content: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  illustrationWrap: {
    marginBottom: 22,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 28,
    letterSpacing: -1.1,
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.2,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  bodyBold: {
    fontFamily: fontFamily[700],
  },
});
