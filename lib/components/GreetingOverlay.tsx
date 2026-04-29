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
import MaskedView from "@react-native-masked-view/masked-view";
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
const RING_SIZE = 220;
const RING_STROKE = 2.6;
const LOGO_SIZE = 140;

/**
 * Splash post-native — apertura premium.
 *
 *   1. Backdrop BLANCO + logo MIX (verde + negro outline) entra spring
 *      en el centro. Sin halos, sin degradés. Pantalla totalmente
 *      blanca, logo limpio.
 *
 *   2. Hold del logo mix 220ms — el ojo lo registra como el "splash
 *      normal" antes de que arranque el cambio.
 *
 *   3. Cover verde brand SUBE desde abajo SÓLIDO, sin halo (edge
 *      limpio). Sube con easing in-out cubic, duración 1100ms,
 *      contemplativo. Light haptic al iniciar.
 *
 *   4. WIPE coordinado: a medida que el cover pasa por la zona del
 *      logo, una máscara revela la versión BLANCO mono del logo
 *      desde abajo hacia arriba — exacto píxel del logo donde está
 *      el cover, queda en blanco. Donde todavía no llegó el cover,
 *      queda mix. La transición es 1:1 con el avance del cover.
 *      MaskedView con un rectángulo opaco que crece de bottom→top.
 *
 *   5. Cover terminó arriba → logo blanco completo sobre el verde.
 *      Pausa breve.
 *
 *   6. Ring SVG se DIBUJA — strokeDashoffset CIRC→0, easing del
 *      spinner del confirm. "Lo vemos nacer y cerrarse". Selection
 *      haptic + pulse al cerrar.
 *
 *   7. Ring cerrado → emerge "Buen día, / Christian" en blanco
 *      sobre verde, alineado a la izquierda con tipografía editorial
 *      Alamos. Logo y ring desvanecen quietos.
 *
 *   8. Hold + exit.
 *
 * Tappeable para skip. Total ~3.5s.
 */
export function GreetingOverlay({ onEnd }: Props) {
  const { c } = useTheme();
  const { user } = useAuth();
  const { height: windowH } = useWindowDimensions();
  const firstName = user?.fullName?.split(" ")[0] ?? "Christian";
  const greeting = timeGreeting();

  /* ─── Cover verde ─── */
  const coverY = useRef(new Animated.Value(windowH)).current;

  /* ─── Logo entrance ─── */
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const logoExitOpacity = useRef(new Animated.Value(1)).current;
  const logoExitScale = useRef(new Animated.Value(1)).current;

  /* ─── Wipe del logo MIX → BLANCO ─── */
  // Altura del rectángulo de máscara: 0 = ninguna parte revelada,
  // LOGO_SIZE = todo el blanco visible. Anclado al bottom para que
  // crezca de abajo hacia arriba (en sincro con el cover subiendo).
  // useNativeDriver:false porque animamos `height` (layout, no transform).
  const wipeHeight = useRef(new Animated.Value(0)).current;

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
    /* ─── 1. Logo mix entry (0–340ms) ─── */
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

    /* ─── 2. HOLD del logo mix (340–560ms) ─── */
    /* ─── 3. Cover sube + WIPE coordinado (a partir de 560ms) ─── */
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Cover y wipe son DOS animaciones paralelas con el mismo
      // duración + easing — así el wipe avanza visualmente en
      // sincronía con el cover que sube. La máscara crece sólo
      // durante la fracción del recorrido en que el cover está
      // pasando por la zona del logo.
      const COVER_DURATION = 1100;
      // Posición del cover (translateY) cuando llega al bottom del
      // logo y cuando pasa el top, expresado como progreso 0–1.
      // En vez de calcularlo exacto (depende de windowH), arrancamos
      // el wipe a un 40% del avance y lo terminamos al 75% — eso
      // distribuye 35% del recorrido al wipe, es visualmente lento
      // sin ser dramático.
      const WIPE_DELAY = COVER_DURATION * 0.4;
      const WIPE_DURATION = COVER_DURATION * 0.35;

      Animated.parallel([
        // Cover: in-out cubic, suave constante. Sin halo, edge limpio.
        Animated.timing(coverY, {
          toValue: 0,
          duration: COVER_DURATION,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // Wipe: la máscara crece de 0 a LOGO_SIZE durante la zona
        // central del recorrido del cover. Mismo easing para que
        // visualmente "siga" el avance del cover píxel por píxel.
        Animated.sequence([
          Animated.delay(WIPE_DELAY),
          Animated.timing(wipeHeight, {
            toValue: LOGO_SIZE,
            duration: WIPE_DURATION,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: false, // height no soporta native
          }),
        ]),
        // Ring fade-in mientras el cover está terminando — para que
        // esté listo a dibujarse apenas el cover llega al top.
        Animated.sequence([
          Animated.delay(900),
          Animated.timing(ringOpacity, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, 560);

    /* ─── 5. Cover terminó (1660ms). Pausa breve. ─── */
    /* ─── 6. Ring se DIBUJA (a partir de 1760ms — el ring
     *      "nace" desde un punto y se cierra) ─── */
    setTimeout(() => {
      Animated.timing(ringOffset, {
        toValue: 0,
        duration: 760,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }).start(() => {
        Haptics.selectionAsync().catch(() => {});
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
    }, 1760);

    /* ─── 7. Ring cerrado → logo + ring desvanecen +
     *      saludo emerge (a partir de 2700ms) ─── */
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoExitOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoExitScale, {
          toValue: 1.05,
          duration: 440,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
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
        Animated.sequence([
          Animated.delay(280),
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
    }, 2700);

    /* ─── 8. EXIT (a los 3700ms) ─── */
    const exitTimer = setTimeout(() => exit(), 3700);

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
          {/* Cover verde brand SÓLIDO — sin halo, sin gradient, edge
              limpio. Sube desde abajo cubriendo full-screen. */}
          <Animated.View
            style={[
              s.cover,
              {
                backgroundColor: c.brand,
                transform: [{ translateY: coverY }],
              },
            ]}
            pointerEvents="none"
          />

          {/* Saludo — alineado a la izquierda, vive en el blanco/cover.
              Aparece después del ring. */}
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

          {/* Hero centrado: ring + logo. El logo MIX está siempre
              renderizado, y encima un MaskedView revela la versión
              BLANCO en sincronía con el avance del cover. */}
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

            {/* Stack de logos: MIX abajo (siempre visible), BLANCO
                arriba con MaskedView que se revela en sincronía con
                el cover subiendo. */}
            <View style={s.logoStack}>
              {/* Capa MIX — splash normal, siempre visible. */}
              <View style={s.logoLayer}>
                <AlamosLogo variant="mark" tone="light" size={LOGO_SIZE} />
              </View>

              {/* Capa BLANCA con MaskedView. La máscara es un rect
                  anclado al bottom cuya altura crece de 0 a LOGO_SIZE
                  en sincro con el cover. Donde la máscara es opaca,
                  el blanco se ve; donde es transparente, sigue
                  visible el mix de abajo. */}
              <View style={s.logoLayer}>
                <MaskedView
                  style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
                  maskElement={
                    <View
                      style={{
                        width: LOGO_SIZE,
                        height: LOGO_SIZE,
                        justifyContent: "flex-end",
                      }}
                    >
                      <Animated.View
                        style={{
                          width: LOGO_SIZE,
                          height: wipeHeight,
                          backgroundColor: "#000", // opaco = visible
                        }}
                      />
                    </View>
                  }
                >
                  <AlamosLogo variant="mark" tone="white" size={LOGO_SIZE} />
                </MaskedView>
              </View>
            </View>
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
  cover: {
    ...StyleSheet.absoluteFillObject,
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
  logoStack: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
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
    paddingBottom: 80,
  },
  greeting: {
    fontFamily: fontFamily[500],
    fontSize: 19,
    letterSpacing: -0.2,
    marginBottom: 6,
    color: "rgba(255,255,255,0.88)",
  },
  name: {
    fontFamily: fontFamily[800],
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.7,
    color: "#FFFFFF",
  },
});
