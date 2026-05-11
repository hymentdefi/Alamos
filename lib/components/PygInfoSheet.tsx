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
 * Ilustración "PyG" — mismo SVG que /icono-pyg.svg, inline con
 * react-native-svg. Cuadrado con esquinas redondeadas: mitad superior
 * verde con flecha hacia arriba, mitad inferior blanca con flecha hacia
 * abajo. Comunica visualmente "ganancia o pérdida" antes del copy.
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
 * Bottom sheet "¿Qué es PyG?". Mismo patrón que MarketClosedSheet /
 * EarningsInfoSheet / ChartSettingsSheet: se cierra deslizando hacia
 * abajo, sin botones de cerrar. Header: icono PyG + título + body.
 * Después dos párrafos cortos con label tonal (ganancia/pérdida)
 * inline — sin bullets ni indentación.
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
            <View style={s.illustrationWrap}>
              <PygIcon size={108} />
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

            <Text style={[s.note, { color: c.textMuted }]}>
              <Text style={[s.noteLabel, { color: c.brand }]}>
                Ganancia.
              </Text>{" "}
              Tu portfolio vale más que al inicio del día. Se muestra
              en verde.
            </Text>

            <Text style={[s.note, { color: c.textMuted }]}>
              <Text style={[s.noteLabel, { color: c.red }]}>
                Pérdida.
              </Text>{" "}
              Tu portfolio vale menos que al inicio del día. Se
              muestra en naranja.
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
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  illustrationWrap: {
    marginBottom: 18,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -1,
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  bodyBold: {
    fontFamily: fontFamily[700],
  },
  /* Mismo treatment que el subtitle del sheet, pero un escalón más
   * chico — funcionan como dos párrafos secundarios después del body.
   * Label inline en tone (brand / red); el resto del texto fluye sin
   * indentación. */
  note: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 12,
    marginTop: 14,
  },
  noteLabel: {
    fontFamily: fontFamily[800],
  },
});
