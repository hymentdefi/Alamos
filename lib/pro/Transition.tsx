import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
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
 * fade de background, stagger de welcome/logo/texto con spring + slide,
 * commit del flip por detrás, y fade-out final.
 */
export function ProTransition({ target, onCommit, onEnd }: Props) {
  const [active, setActive] = useState<ProTransitionTarget>(target);

  // Animated values — se crean una sola vez y se resetean en cada ciclo.
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTx = useRef(new Animated.Value(24)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.4)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markRotate = useRef(new Animated.Value(-0.25)).current;
  const alamosTx = useRef(new Animated.Value(24)).current;
  const alamosOpacity = useRef(new Animated.Value(0)).current;
  const accentTx = useRef(new Animated.Value(40)).current;
  const accentOpacity = useRef(new Animated.Value(0)).current;
  const accentScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!target) return;
    setActive(target);

    // Reset todos los valores al punto inicial.
    bgOpacity.setValue(0);
    welcomeTx.setValue(24);
    welcomeOpacity.setValue(0);
    markScale.setValue(0.4);
    markOpacity.setValue(0);
    markRotate.setValue(-0.25);
    alamosTx.setValue(24);
    alamosOpacity.setValue(0);
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
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(welcomeOpacity, {
            toValue: 1,
            duration: 360,
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
        Animated.delay(260),
        Animated.parallel([
          Animated.spring(markScale, {
            toValue: 1,
            tension: 70,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.spring(markRotate, {
            toValue: 0,
            tension: 60,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(markOpacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(360),
        Animated.parallel([
          Animated.timing(alamosOpacity, {
            toValue: 1,
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(alamosTx, {
            toValue: 0,
            tension: 85,
            friction: 13,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(accentOpacity, {
            toValue: 1,
            duration: 320,
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

    // Secondary haptic cuando termina de entrar (impact light).
    const hapticTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 900);

    // Flip por detrás — el overlay está opaco, el user no ve el swap.
    const commitTimer = setTimeout(() => {
      onCommit();
    }, 1150);

    // Fade-out del overlay + onEnd.
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(welcomeOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(markOpacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(alamosOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(accentOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(markScale, {
          toValue: 1.08,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setActive(null);
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
    markScale,
    markOpacity,
    markRotate,
    alamosTx,
    alamosOpacity,
    accentTx,
    accentOpacity,
    accentScale,
    onCommit,
    onEnd,
  ]);

  if (!active) return null;

  const toPro = active === "toPro";
  const bgColor = toPro ? brand.ink : brand.bg;
  const welcomeColor = toPro ? "rgba(250,250,247,0.72)" : "rgba(14,15,12,0.54)";
  const alamosColor = toPro ? brand.bg : brand.ink;
  const accentColor = brand.green;

  const rotateStr = markRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-90deg", "0deg", "90deg"],
  });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      // No cerrable con back hardware — la transición tiene que completar.
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
                opacity: markOpacity,
                transform: [
                  { scale: markScale },
                  { rotate: rotateStr },
                ],
              }}
            >
              <AlamosLogo
                variant="mark"
                tone={toPro ? "dark" : "light"}
                size={40}
              />
            </Animated.View>

            <Animated.Text
              style={[
                s.alamosText,
                {
                  color: alamosColor,
                  opacity: alamosOpacity,
                  transform: [{ translateY: alamosTx }],
                },
              ]}
            >
              ALAMOS
            </Animated.Text>

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
    marginBottom: 10,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alamosText: {
    fontFamily: fontFamily[800],
    fontSize: 40,
    letterSpacing: -1.6,
  },
  accentText: {
    fontFamily: fontFamily[500],
    fontSize: 32,
    letterSpacing: -1,
    marginLeft: 2,
  },
});
