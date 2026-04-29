import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { fontFamily, useTheme } from "../theme";
import { useAuth } from "../auth/context";
import { AlamosLogo } from "./Logo";

interface Props {
  /** Llamado cuando termina la animación de salida — desmontar overlay. */
  onEnd: () => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Buen día,";
  if (h >= 12 && h < 20) return "Buenas tardes,";
  return "Buenas noches,";
}

/* ─── Geometría del ring (igual que confirm.tsx) ───────────────────── */
const RING_VIEWBOX = 100;
const RING_RADIUS = 44;
const CIRC = 2 * Math.PI * RING_RADIUS;
const RING_SIZE = 156;
const RING_STROKE = 2.2;
const LOGO_SIZE = 92;

/**
 * Splash post-native — secuencia "activación de cuenta", inspirada en
 * el SwipeToSubmit del confirm screen. La idea: cuando abrís la app
 * sentís el mismo gesto de "se ejecuta tu acción", pero acá la acción
 * es entrar a Alamos.
 *
 * Coreografía (≈3.4s):
 *
 *   1. Cover verde brand SUBE desde abajo cubriendo la pantalla
 *      (280ms, cubic). Mismo gesto que el green cover del swipe
 *      to submit.
 *
 *   2. Sobre el verde: logo BLANCO mono emerge desde abajo con
 *      spring (tension 55, friction 12 — mismo que el confirm). Ring
 *      SVG empieza a dibujarse alrededor (strokeDashoffset, 700ms,
 *      bezier 0.22 1 0.36 1 — mismo easing del spinner del confirm).
 *
 *   3. HOLD del logo encendido sobre verde — 300ms quieto. Selection
 *      haptic muy sutil al cerrar el ring.
 *
 *   4. Cover BAJA. Mientras baja, el logo crossfade de BLANCO mono a
 *      VERDE brand — efecto "el cover dejó su color en el logo".
 *      El ring también desvanece.
 *
 *   5. Logo verde se desvanece quieto y emerge "Buen día, / Christian"
 *      en su propio lugar (alineado izquierda, tipografía editorial
 *      Alamos).
 *
 *   6. Hold del saludo + exit global.
 *
 * Tappeable para skip rápido.
 */
export function GreetingOverlay({ onEnd }: Props) {
  const { c } = useTheme();
  const { user } = useAuth();
  const { height: windowH } = useWindowDimensions();
  const firstName = user?.fullName?.split(" ")[0] ?? "Christian";
  const greeting = timeGreeting();

  /* ─── Cover verde (entry up + exit down) ─── */
  // Empieza fuera de pantalla abajo. Sube → 0 → baja a windowH.
  const coverY = useRef(new Animated.Value(windowH)).current;

  /* ─── Logo entrance (mismo lenguaje que confirm.tsx) ─── */
  const entranceTravel = Math.round(windowH * 0.18);
  const logoTranslateY = useRef(
    new Animated.Value(entranceTravel),
  ).current;
  const logoRotate = useRef(new Animated.Value(-12)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  // Pulse al cerrar el ring (1 → 1.05 → 1).
  const logoPulse = useRef(new Animated.Value(1)).current;
  // Exit: scale-up sutil + opacity al saludo.
  const logoExitScale = useRef(new Animated.Value(1)).current;
  const logoExitOpacity = useRef(new Animated.Value(1)).current;

  /* ─── Logo color crossfade (white sobre cover, green tras cover) ─── */
  const whiteLogoOpacity = useRef(new Animated.Value(1)).current;
  const greenLogoOpacity = useRef(new Animated.Value(0)).current;

  /* ─── Ring (alrededor del logo) ─── */
  // strokeDashoffset: empieza en CIRC (invisible) y termina en 0 (cerrado).
  const ringOffset = useRef(new Animated.Value(CIRC)).current;
  const ringOpacity = useRef(new Animated.Value(1)).current;

  /* ─── Greeting in ─── */
  const greetTy = useRef(new Animated.Value(12)).current;
  const greetOpacity = useRef(new Animated.Value(0)).current;
  const nameTy = useRef(new Animated.Value(16)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;

  // Re-entry guard.
  const endedRef = useRef(false);

  useEffect(() => {
    /* ─── 1. Cover sube (0–280ms) ─── */
    Animated.timing(coverY, {
      toValue: 0,
      duration: 280,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();

    /* ─── 2. Logo emerge + Ring se dibuja (a partir de 220ms) ─── */
    setTimeout(() => {
      // Logo: spring desde abajo + rotación leve a 0 (mismo confirm).
      Animated.parallel([
        Animated.spring(logoTranslateY, {
          toValue: 0,
          tension: 55,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.spring(logoRotate, {
          toValue: 0,
          tension: 55,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Ring: dibuja alrededor (mismo easing que el spinner del confirm).
      Animated.timing(ringOffset, {
        toValue: 0,
        duration: 720,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false, // strokeDashoffset no soporta native
      }).start(() => {
        // Selection haptic al cerrar el ring.
        Haptics.selectionAsync().catch(() => {});
        // Pulse sutil al cerrar (1 → 1.05 → 1).
        Animated.sequence([
          Animated.timing(logoPulse, {
            toValue: 1.05,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(logoPulse, {
            toValue: 1,
            duration: 200,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 220);

    /* ─── 3. HOLD + 4. Cover baja (a partir de 1240ms) ─── */
    setTimeout(() => {
      Animated.parallel([
        // Cover desciende.
        Animated.timing(coverY, {
          toValue: windowH,
          duration: 520,
          easing: Easing.bezier(0.4, 0, 0.6, 1),
          useNativeDriver: true,
        }),
        // Logo: crossfade WHITE → GREEN durante el descenso del cover.
        // El descenso del cover "destiñe" el logo blanco que va
        // quedando expuesto sobre fondo blanco — mientras tanto el
        // logo verde toma su lugar.
        Animated.sequence([
          Animated.delay(80),
          Animated.parallel([
            Animated.timing(whiteLogoOpacity, {
              toValue: 0,
              duration: 380,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(greenLogoOpacity, {
              toValue: 1,
              duration: 400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
        // Ring desvanece junto con el cover.
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 360,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 1240);

    /* ─── 5. Logo sale + Greeting entra (a partir de 1900ms) ─── */
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoExitOpacity, {
          toValue: 0,
          duration: 380,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoExitScale, {
          toValue: 1.04,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Greeting entra.
        Animated.sequence([
          Animated.delay(140),
          Animated.parallel([
            Animated.timing(greetOpacity, {
              toValue: 1,
              duration: 360,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(greetTy, {
              toValue: 0,
              tension: 78,
              friction: 13,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(nameOpacity, {
              toValue: 1,
              duration: 440,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(nameTy, {
              toValue: 0,
              tension: 70,
              friction: 12,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    }, 1900);

    /* ─── 6. EXIT (a los 2900ms) ─── */
    const exitTimer = setTimeout(() => exit(), 2900);

    return () => clearTimeout(exitTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exit = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    Animated.parallel([
      Animated.timing(greetOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(nameOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => onEnd());
  };

  /* ─── Estilos animados ─── */
  const logoRotateStr = logoRotate.interpolate({
    inputRange: [-360, 360],
    outputRange: ["-360deg", "360deg"],
  });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={[s.root, { backgroundColor: c.bg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={exit}>
          {/* Greeting alineado a la izquierda — vive en la base, debajo
              de todo. Aparece cuando el cover se va. */}
          <View style={s.greetingWrap} pointerEvents="none">
            <Animated.Text
              style={[
                s.greeting,
                {
                  color: c.textMuted,
                  opacity: greetOpacity,
                  transform: [{ translateY: greetTy }],
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
                  transform: [{ translateY: nameTy }],
                },
              ]}
            >
              {firstName}
            </Animated.Text>
          </View>

          {/* Cover verde brand — sube full-screen y baja al final.
              Sobre el cover se renderea el logo en blanco; cuando
              baja, el logo crossfade a verde sobre fondo blanco. */}
          <Animated.View
            style={[
              s.cover,
              {
                backgroundColor: c.brand,
                transform: [{ translateY: coverY }],
              },
            ]}
            pointerEvents="none"
          >
            {/* Hero: logo + ring centrados. Comparten el wrapper para
                que la rotación de entrance (rotate del logo) NO afecte
                al ring — el ring vive arriba en su propio Animated.View
                quieto. Por eso renderizo dos capas separadas. */}
            <Animated.View
              style={[
                s.hero,
                {
                  opacity: logoExitOpacity,
                  transform: [
                    { scale: Animated.multiply(logoPulse, logoExitScale) },
                  ],
                },
              ]}
            >
              {/* Ring (SVG) — quieto, sin rotación, dibuja alrededor
                  del logo con strokeDashoffset. */}
              <Animated.View
                style={[s.ringWrap, { opacity: ringOpacity }]}
                pointerEvents="none"
              >
                <Svg
                  width={RING_SIZE}
                  height={RING_SIZE}
                  viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
                >
                  <AnimatedCircle
                    cx={RING_VIEWBOX / 2}
                    cy={RING_VIEWBOX / 2}
                    r={RING_RADIUS}
                    stroke="#FFFFFF"
                    strokeWidth={RING_STROKE}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${CIRC} ${CIRC}`}
                    strokeDashoffset={ringOffset}
                    rotation="-90"
                    originX={RING_VIEWBOX / 2}
                    originY={RING_VIEWBOX / 2}
                  />
                </Svg>
              </Animated.View>

              {/* Logo wrapper — entrance translate/rotate/opacity. Dos
                  copias del logo (white + green) en crossfade. */}
              <Animated.View
                style={[
                  s.logoWrap,
                  {
                    opacity: logoOpacity,
                    transform: [
                      { translateY: logoTranslateY },
                      { rotate: logoRotateStr },
                    ],
                  },
                ]}
              >
                <Animated.View
                  style={[s.logoLayer, { opacity: whiteLogoOpacity }]}
                >
                  <AlamosLogo variant="mark" tone="white" size={LOGO_SIZE} />
                </Animated.View>
                <Animated.View
                  style={[s.logoLayer, { opacity: greenLogoOpacity }]}
                >
                  <AlamosLogo variant="mark" tone="green" size={LOGO_SIZE} />
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  greetingWrap: {
    position: "absolute",
    left: 28,
    right: 28,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Tipografía editorial Alamos — escala display sin shouting. */
  greeting: {
    fontFamily: fontFamily[500],
    fontSize: 17,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  name: {
    fontFamily: fontFamily[700],
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.4,
  },
});
