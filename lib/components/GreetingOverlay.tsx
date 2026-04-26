import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { fontFamily, useTheme } from "../theme";
import { useAuth } from "../auth/context";

interface Props {
  /** Llamado cuando termina la animación de salida — desmontar overlay. */
  onEnd: () => void;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Buen día,";
  if (h >= 12 && h < 20) return "Buenas tardes,";
  return "Buenas noches,";
}

/**
 * Overlay full-screen estilo "Bienvenido a Alamos" que aparece una vez
 * por cold start después del splash, saludando al usuario por su nombre.
 *
 * Stagger: backdrop fade-in → greeting (con translateY) → nombre (con
 * scale + translateY) → hold corto → fade-out global.
 *
 * Tappeable para skip rápido — algunos usuarios prefieren ir directo al
 * home, así no los frenamos.
 */
export function GreetingOverlay({ onEnd }: Props) {
  const { c } = useTheme();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";
  const greeting = timeGreeting();

  const bgOpacity = useRef(new Animated.Value(0)).current;
  const greetTx = useRef(new Animated.Value(20)).current;
  const greetOpacity = useRef(new Animated.Value(0)).current;
  const nameTx = useRef(new Animated.Value(28)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameScale = useRef(new Animated.Value(0.92)).current;

  // Guardamos el ended state en un ref para que skip y auto-exit no
  // disparen onEnd dos veces.
  const endedRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(greetOpacity, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(greetTx, {
            toValue: 0,
            tension: 85,
            friction: 12,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.parallel([
          Animated.timing(nameOpacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(nameTx, {
            toValue: 0,
            tension: 75,
            friction: 9,
            useNativeDriver: true,
          }),
          Animated.spring(nameScale, {
            toValue: 1,
            tension: 70,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    const hapticTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 640);

    const exitTimer = setTimeout(() => exit(), 1500);

    return () => {
      clearTimeout(hapticTimer);
      clearTimeout(exitTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exit = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 360,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(greetOpacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(nameOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(nameScale, {
        toValue: 1.06,
        duration: 360,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onEnd());
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <Animated.View
        style={[s.backdrop, { backgroundColor: c.bg, opacity: bgOpacity }]}
      >
        <Pressable style={s.content} onPress={exit}>
          <Animated.Text
            style={[
              s.greeting,
              {
                color: c.textMuted,
                opacity: greetOpacity,
                transform: [{ translateY: greetTx }],
              },
            ]}
          >
            {greeting}
          </Animated.Text>
          <Animated.Text
            style={[
              s.name,
              {
                color: c.text,
                opacity: nameOpacity,
                transform: [{ translateY: nameTx }, { scale: nameScale }],
              },
            ]}
          >
            {firstName}
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  greeting: {
    fontFamily: fontFamily[500],
    fontSize: 26,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  name: {
    fontFamily: fontFamily[700],
    fontSize: 56,
    letterSpacing: -2.4,
    transformOrigin: "left",
  },
});
