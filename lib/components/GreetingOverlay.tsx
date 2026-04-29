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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fontFamily, useTheme } from "../theme";
import { useAuth } from "../auth/context";
import { AlamosLogo } from "./Logo";

interface Props {
  /** Llamado cuando termina la animación de salida — desmontar overlay. */
  onEnd: () => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

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
const RING_SIZE = 168;
const RING_STROKE = 2.2;
const LOGO_SIZE = 96;

/**
 * Splash post-native — la apertura premium estilo "activación de
 * cuenta", referenciando el SwipeToSubmit del confirm screen.
 *
 * Coreografía (~3.6s):
 *
 *   1. Backdrop blanco + LOGO MIX aparece en el centro (mismo del
 *      splash nativo: triángulo trasero verde + delantero negro
 *      outline). Spring sutil + fadeIn.
 *
 *   2. HOLD del logo mix — 240ms. Le da tiempo al ojo para registrar
 *      el splash "normal" antes de la transición.
 *
 *   3. Cover verde brand SUBE desde abajo CON AURA — un gradient en
 *      el top edge (transparent → verde brand) que crea un halo de
 *      ~120px arriba del cover sólido, dándole el feel de "ola con
 *      luz" en vez de un edge duro. Subida tranquila (820ms,
 *      bezier 0.32 0.72 0 1 = slow-out contemplativo). Mientras
 *      sube, el logo se mantiene quieto en el centro y el cover
 *      pasa por detrás del logo.
 *
 *   4. Cover llega al top → LOGO crossfade MIX → BLANCO mono. El
 *      logo cambia de color cuando el cover terminó de cubrir todo,
 *      sintiéndose como "el cover dejó al logo en blanco" sobre el
 *      verde.
 *
 *   5. Ring SVG se dibuja alrededor del logo blanco (strokeDashoffset
 *      CIRC→0, 720ms, mismo bezier que el spinner del confirm).
 *      Selection haptic + pulse al cerrar el ring.
 *
 *   6. Ring cerrado → emerge "Buen día, / Christian" en blanco
 *      sobre el verde brand, alineado a la izquierda. El logo y el
 *      ring desvanecen quietos (NO viajan al texto), el saludo
 *      aparece en su propia posición con fade + ty mínimo.
 *
 *   7. Hold del saludo + exit global.
 *
 * Tappeable para skip rápido.
 */
export function GreetingOverlay({ onEnd }: Props) {
  const { c } = useTheme();
  const { user } = useAuth();
  const { height: windowH } = useWindowDimensions();
  const firstName = user?.fullName?.split(" ")[0] ?? "Christian";
  const greeting = timeGreeting();

  /* ─── Cover verde (sube en stage 3) ─── */
  // Empieza fuera de pantalla. Sube → 0. Halo extra arriba del cover
  // de ~120px; lo posicionamos ABAJO del top del cover sólido.
  const HALO_HEIGHT = 140;
  const coverY = useRef(new Animated.Value(windowH)).current;

  /* ─── Logo entrance ─── */
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  // Pulse al cerrar el ring.
  const logoPulse = useRef(new Animated.Value(1)).current;
  // Exit final.
  const logoExitOpacity = useRef(new Animated.Value(1)).current;
  const logoExitScale = useRef(new Animated.Value(1)).current;

  /* ─── Logo color crossfade (mix → white) ─── */
  // Mix (verde + negro outline) visible al inicio; cuando el cover
  // termina de subir, fadea y emerge el blanco mono.
  const mixLogoOpacity = useRef(new Animated.Value(1)).current;
  const whiteLogoOpacity = useRef(new Animated.Value(0)).current;

  /* ─── Ring ─── */
  const ringOffset = useRef(new Animated.Value(CIRC)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  /* ─── Greeting in ─── */
  const greetTy = useRef(new Animated.Value(12)).current;
  const greetOpacity = useRef(new Animated.Value(0)).current;
  const nameTy = useRef(new Animated.Value(16)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;

  // Re-entry guard.
  const endedRef = useRef(false);

  useEffect(() => {
    /* ─── 1. Logo mix entry (0–360ms) ─── */
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();

    /* ─── 2. HOLD del logo mix (360–600ms) ─── */
    /* ─── 3. Cover sube CON AURA (a partir de 600ms) ─── */
    setTimeout(() => {
      // Haptic Light muy sutil al inicio del cover — "comienza el gesto".
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      Animated.timing(coverY, {
        toValue: 0,
        duration: 820,
        // slow-out contemplativo — el cover empieza rápido y se
        // asienta al final, dándole feel premium.
        easing: Easing.bezier(0.32, 0.72, 0, 1),
        useNativeDriver: true,
      }).start();
    }, 600);

    /* ─── 4. Cover terminó → crossfade logo mix → blanco
     *      (a partir de 1420ms) ─── */
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(mixLogoOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(whiteLogoOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Ring fade-in para que esté visible cuando empiece a dibujarse.
        Animated.timing(ringOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 1420);

    /* ─── 5. Ring se dibuja (a partir de 1660ms) ─── */
    setTimeout(() => {
      Animated.timing(ringOffset, {
        toValue: 0,
        duration: 720,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false, // strokeDashoffset no soporta native
      }).start(() => {
        // Selection haptic al cerrar — confirma sin gritar.
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
    }, 1660);

    /* ─── 6. Ring cerrado → logo + ring desvanecen +
     *      saludo emerge (a partir de 2580ms) ─── */
    setTimeout(() => {
      Animated.parallel([
        // Logo + ring fade-out quietos.
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
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // Greeting entra.
        Animated.sequence([
          Animated.delay(180),
          Animated.parallel([
            Animated.timing(greetOpacity, {
              toValue: 1,
              duration: 380,
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
        // Name stagger 90ms.
        Animated.sequence([
          Animated.delay(270),
          Animated.parallel([
            Animated.timing(nameOpacity, {
              toValue: 1,
              duration: 460,
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
    }, 2580);

    /* ─── 7. EXIT (a los 3500ms) ─── */
    const exitTimer = setTimeout(() => exit(), 3500);

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
          {/* Cover verde brand — sube desde abajo full-screen.
              Tiene un halo arriba (gradient transparent→verde) que
              precede al cover sólido, dándole el feel "ola con
              aura" en vez de edge plano. Va detrás del logo y del
              saludo. */}
          <Animated.View
            style={[
              s.coverContainer,
              { transform: [{ translateY: coverY }] },
            ]}
            pointerEvents="none"
          >
            {/* Halo encima del cover — extiende el verde hacia arriba
                con gradiente transparent → verde, simulando luz que
                sale del top del cover. */}
            <LinearGradient
              colors={["transparent", c.brand]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[
                s.coverHalo,
                { height: HALO_HEIGHT, top: -HALO_HEIGHT },
              ]}
            />
            {/* Cover sólido — verde brand. */}
            <View style={[s.coverSolid, { backgroundColor: c.brand }]} />
          </Animated.View>

          {/* Greeting alineado a la izquierda — vive en blanco/foreground;
              aparece sobre el verde después de que el ring cierra.
              Color blanco para máximo contraste con el cover verde. */}
          <View style={s.greetingWrap} pointerEvents="none">
            <Animated.Text
              style={[
                s.greeting,
                {
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
                  opacity: nameOpacity,
                  transform: [{ translateY: nameTy }],
                },
              ]}
            >
              {firstName}
            </Animated.Text>
          </View>

          {/* Hero centrado: ring + logo. SIEMPRE en el mismo lugar —
              el cover pasa por DETRÁS del logo, no lo desplaza. */}
          <Animated.View
            style={[
              s.hero,
              {
                opacity: Animated.multiply(logoOpacity, logoExitOpacity),
                transform: [
                  {
                    scale: Animated.multiply(
                      Animated.multiply(logoScale, logoPulse),
                      logoExitScale,
                    ),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            {/* Ring (SVG) — quieto, dibujado con dashoffset. */}
            <Animated.View
              style={[s.ringWrap, { opacity: ringOpacity }]}
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

            {/* Dos copias del logo en crossfade: mix (start) y blanco
                (después de que el cover termina de cubrir). */}
            <Animated.View
              style={[s.logoLayer, { opacity: mixLogoOpacity }]}
            >
              <AlamosLogo variant="mark" tone="light" size={LOGO_SIZE} />
            </Animated.View>
            <Animated.View
              style={[s.logoLayer, { opacity: whiteLogoOpacity }]}
            >
              <AlamosLogo variant="mark" tone="white" size={LOGO_SIZE} />
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
  coverContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  coverHalo: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  coverSolid: {
    flex: 1,
  },
  hero: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringWrap: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLayer: {
    position: "absolute",
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: "center",
    justifyContent: "center",
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
  /* Tipografía editorial Alamos en BLANCO sobre el cover verde
   * — máximo contraste, feel "panel premium". */
  greeting: {
    fontFamily: fontFamily[500],
    fontSize: 17,
    letterSpacing: -0.2,
    marginBottom: 6,
    color: "rgba(255,255,255,0.78)",
  },
  name: {
    fontFamily: fontFamily[700],
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1.4,
    color: "#FFFFFF",
  },
});
