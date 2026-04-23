import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { AlamosLogo } from "../components/Logo";
import { brand, fontFamily } from "../theme";
import type { ProTransitionTarget } from "./context";

const { width: SCREEN_W } = Dimensions.get("window");

interface Props {
  target: ProTransitionTarget;
  /** Llamado cuando la animación está por la mitad — flippea `isPro`. */
  onCommit: () => void;
  /** Llamado al final — limpia el target y desmonta el overlay. */
  onEnd: () => void;
}

/**
 * Overlay full-screen tipo "Welcome to Alamos Pro" que se muestra al
 * cambiar de modo. Orquesta una secuencia de animaciones entretenidas:
 * fade de background, stagger de welcome/logo/accent con spring + slide,
 * commit del flip por detrás, y fade-out final.
 */
export function ProTransition({ target, onCommit, onEnd }: Props) {
  // Animated values — se crean una sola vez y se resetean en cada ciclo.
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTx = useRef(new Animated.Value(24)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoTx = useRef(new Animated.Value(16)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const accentTx = useRef(new Animated.Value(40)).current;
  const accentOpacity = useRef(new Animated.Value(0)).current;
  const accentScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!target) return;

    // Reset todos los valores al punto inicial.
    bgOpacity.setValue(0);
    welcomeTx.setValue(24);
    welcomeOpacity.setValue(0);
    logoScale.setValue(0.5);
    logoTx.setValue(16);
    logoOpacity.setValue(0);
    accentTx.setValue(40);
    accentOpacity.setValue(0);
    accentScale.setValue(0.6);

    // Entrada staggered.
    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.timing(welcomeOpacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(welcomeTx, {
            toValue: 0,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.parallel([
          Animated.spring(logoScale, {
            toValue: 1,
            tension: 70,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(logoTx, {
            toValue: 0,
            tension: 85,
            friction: 13,
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(520),
        Animated.parallel([
          Animated.timing(accentOpacity, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(accentTx, {
            toValue: 0,
            tension: 95,
            friction: 11,
            useNativeDriver: true,
          }),
          Animated.spring(accentScale, {
            toValue: 1,
            tension: 80,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    // Haptic cuando termina el stagger de entrada.
    const hapticTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 900);

    // Flip por detrás — el overlay está opaco, el user no ve el swap.
    const commitTimer = setTimeout(() => {
      onCommit();
    }, 1150);

    // Fade-out final + onEnd.
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 440,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(welcomeOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(accentOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.08,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onEnd();
      });
    }, 1650);

    return () => {
      clearTimeout(hapticTimer);
      clearTimeout(commitTimer);
      clearTimeout(exitTimer);
    };
  }, [
    target,
    bgOpacity,
    welcomeTx,
    welcomeOpacity,
    logoScale,
    logoTx,
    logoOpacity,
    accentTx,
    accentOpacity,
    accentScale,
    onCommit,
    onEnd,
  ]);

  if (!target) return null;

  const toPro = target === "toPro";
  const bgColor = toPro ? brand.ink : brand.bg;
  const welcomeColor = toPro ? "rgba(250,250,247,0.72)" : "rgba(14,15,12,0.54)";
  const accentColor = brand.green;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <Animated.View
        style={[
          s.backdrop,
          { backgroundColor: bgColor, opacity: bgOpacity },
        ]}
      >
        <View style={s.content}>
          <Animated.Text
            style={[
              s.welcome,
              {
                color: welcomeColor,
                opacity: welcomeOpacity,
                transform: [{ translateY: welcomeTx }],
              },
            ]}
          >
            Bienvenido a
          </Animated.Text>

          <View style={s.logoRow}>
            <Animated.View
              style={{
                opacity: logoOpacity,
                transform: [
                  { translateY: logoTx },
                  { scale: logoScale },
                ],
              }}
            >
              <AlamosLogo
                variant="lockupShort"
                tone={toPro ? "dark" : "light"}
                size={44}
              />
            </Animated.View>

            {toPro ? (
              <Animated.Text
                style={[
                  s.accentText,
                  {
                    color: accentColor,
                    opacity: accentOpacity,
                    transform: [
                      { translateY: accentTx },
                      { scale: accentScale },
                    ],
                  },
                ]}
              >
                Pro
              </Animated.Text>
            ) : null}
          </View>
        </View>
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
    paddingHorizontal: 24,
    paddingTop: "42%",
    width: SCREEN_W,
  },
  welcome: {
    fontFamily: fontFamily[500],
    fontSize: 18,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accentText: {
    fontFamily: fontFamily[500],
    fontSize: 34,
    letterSpacing: -1,
    marginLeft: 2,
  },
});
