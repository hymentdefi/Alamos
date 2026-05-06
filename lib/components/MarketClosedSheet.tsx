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
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
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

  /* Pan + shake del candado — declarados acá arriba porque el
   * useEffect de abajo los toca al abrir el sheet (reset + trigger
   * del shake). El gesture en sí se construye después. */
  const lockTX = useSharedValue(0);
  const lockTY = useSharedValue(0);
  const lockShake = useSharedValue(0);

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
      // Reset por si en una apertura previa el user dejó el candado
      // movido y el sheet se cerró antes del spring back.
      lockTX.value = 0;
      lockTY.value = 0;
      lockShake.value = 0;
      // Shake "como si lo intentaran abrir" — oscilación lateral que
      // decae. Delay de 220ms para que arranque cuando el sheet ya
      // entró visualmente (no antes, sino se ve raro). Después queda
      // en 0 y el user puede agarrarlo y moverlo libremente.
      lockShake.value = withDelay(
        220,
        withSequence(
          withTiming(12, { duration: 70, easing: Easing.out(Easing.quad) }),
          withTiming(-12, { duration: 100, easing: Easing.inOut(Easing.quad) }),
          withTiming(10, { duration: 90, easing: Easing.inOut(Easing.quad) }),
          withTiming(-10, { duration: 90, easing: Easing.inOut(Easing.quad) }),
          withTiming(7, { duration: 85, easing: Easing.inOut(Easing.quad) }),
          withTiming(-7, { duration: 85, easing: Easing.inOut(Easing.quad) }),
          withTiming(4, { duration: 80, easing: Easing.inOut(Easing.quad) }),
          withTiming(-4, { duration: 80, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 110, easing: Easing.out(Easing.cubic) }),
        ),
      );
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

  /* ─── Candado interactivo — pan gesture en la ilustración ───
   *
   * Drag con el dedo y vuelve a su lugar con spring rebotón al soltar.
   * Una rotación sutil ligada a translationX da feel "candado
   * balanceándose" — combinada con el shake de bienvenida (lockShake)
   * hace que el candado se sienta vivo. La gesture es propia de la
   * ilustración; el swipe-down de dismiss del sheet sigue andando en
   * el resto del área.
   *
   * onBegin cancela el shake si todavía está corriendo, así el user
   * que agarra durante el wiggle toma el control inmediato. */
  const lockPan = Gesture.Pan()
    .onBegin(() => {
      "worklet";
      cancelAnimation(lockShake);
      lockShake.value = 0;
    })
    .onUpdate((e) => {
      "worklet";
      lockTX.value = e.translationX;
      lockTY.value = e.translationY;
    })
    .onEnd(() => {
      "worklet";
      lockTX.value = withSpring(0, { damping: 7, stiffness: 110 });
      lockTY.value = withSpring(0, { damping: 7, stiffness: 110 });
    });

  const lockStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lockTX.value },
      { translateY: lockTY.value },
      // Rotación = (drag * 0.06) + shake. Drag de 80px ≈ 5 deg; el
      // shake aporta hasta 12 deg al inicio y va decayendo a 0.
      { rotate: `${lockTX.value * 0.06 + lockShake.value}deg` },
    ],
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
            <GestureDetector gesture={lockPan}>
              <Animated.View style={[s.illustrationWrap, lockStyle]}>
                <MarketClosedIllustration size={188} />
              </Animated.View>
            </GestureDetector>

            <Text style={[s.title, { color: c.text }]}>Mercado cerrado</Text>
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              {instrumentLabel} se opera{" "}
              <Text style={[s.subtitleBold, { color: c.text }]}>
                {session.days}
              </Text>
              , de{" "}
              <Text style={[s.subtitleMono, { color: c.text }]}>
                {session.hours}
              </Text>
              .
            </Text>
            <Text style={[s.scheduledNote, { color: c.textMuted }]}>
              Podés enviar{" "}
              <Text style={[s.subtitleBold, { color: c.text }]}>
                órdenes de compra y venta
              </Text>
              . Quedan{" "}
              <Text style={[s.subtitleBold, { color: c.text }]}>
                programadas
              </Text>{" "}
              y se ejecutan al abrir el mercado.
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
  /* Nota tranquilizadora — las órdenes durante mercado cerrado no
   * se rechazan, se schedulean. La separamos del subtitle con un
   * marginTop para dar respiro entre el "horario" (info dura) y el
   * "podés operar igual" (acción del usuario). */
  scheduledNote: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 14,
  },
});
