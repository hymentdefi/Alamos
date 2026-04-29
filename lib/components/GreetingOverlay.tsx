import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { fontFamily, useTheme } from "../theme";
import { useAuth } from "../auth/context";

interface Props {
  /** Llamado cuando termina la animación de salida — desmontar overlay. */
  onEnd: () => void;
}

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Buen día,";
  if (h >= 12 && h < 20) return "Buenas tardes,";
  return "Buenas noches,";
}

/**
 * Overlay full-screen post-splash con la animación de marca:
 *
 *   1. Logo aparece como el "empresa" mix — triángulo trasero verde
 *      brand + delantero outline negro (mismo que el splash nativo,
 *      sin pop de color). Pequeño scale-up + fade-in.
 *   2. MORPH: el triángulo delantero crossfade de negro a verde brand
 *      (~250ms). Pulse sutil del scale como confirmación + haptic Light.
 *      Resultado: logo "todo verde" — la identidad oficial.
 *   3. DISARM: los dos triángulos se separan (translateX opuesto) y
 *      hacen fade-out. Mientras tanto, "Buen día, / Christian" entra
 *      desde la izquierda con stagger.
 *   4. HOLD breve para que el saludo se lea.
 *   5. Fade-out global.
 *
 * Total ~1.7s. Tappeable para skip rápido (algunos usuarios prefieren
 * ir directo al home, no los frenamos).
 */
export function GreetingOverlay({ onEnd }: Props) {
  const { c } = useTheme();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "Christian";
  const greeting = timeGreeting();

  /* ─── Backdrop ─── */
  const bgOpacity = useRef(new Animated.Value(0)).current;

  /* ─── Logo (entry + morph + disarm) ─── */
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  // Morph: el front-negro fadea out mientras el front-verde fadea in.
  const frontBlackOpacity = useRef(new Animated.Value(1)).current;
  const frontGreenOpacity = useRef(new Animated.Value(0)).current;
  // Pulse sutil al confirmar el morph.
  const morphPulse = useRef(new Animated.Value(1)).current;
  // Disarm: cada triángulo se mueve en direcciones opuestas + fadeOut.
  const backTriX = useRef(new Animated.Value(0)).current;
  const frontTriX = useRef(new Animated.Value(0)).current;
  const trianglesOpacity = useRef(new Animated.Value(1)).current;

  /* ─── Greeting (entry + exit) ─── */
  const greetTx = useRef(new Animated.Value(-24)).current;
  const greetOpacity = useRef(new Animated.Value(0)).current;
  const nameTx = useRef(new Animated.Value(-32)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameScale = useRef(new Animated.Value(0.94)).current;

  // Guardamos el ended state en un ref para que skip y auto-exit no
  // disparen onEnd dos veces.
  const endedRef = useRef(false);

  useEffect(() => {
    /* ─── 1. Backdrop + entry del logo (0–280ms) ─── */
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 90,
        friction: 11,
        useNativeDriver: true,
      }),
    ]).start();

    /* ─── 2. MORPH (a partir de 380ms, dura ~280ms) ─── */
    const morphTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Animated.parallel([
        // Cross-fade: negro out, verde in (con leve overlap).
        Animated.timing(frontBlackOpacity, {
          toValue: 0,
          duration: 240,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(frontGreenOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Pulse: 1 → 1.06 → 1 sobre todo el SVG, "energía" al cambiar.
        Animated.sequence([
          Animated.timing(morphPulse, {
            toValue: 1.06,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(morphPulse, {
            toValue: 1,
            duration: 180,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, 380);

    /* ─── 3. DISARM + entrada del greeting (a partir de 760ms) ─── */
    const disarmTimer = setTimeout(() => {
      Animated.parallel([
        // Triángulos se separan + fade-out.
        Animated.timing(backTriX, {
          toValue: -36,
          duration: 360,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(frontTriX, {
          toValue: 36,
          duration: 360,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(trianglesOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // Greeting entra desde la izquierda — stagger entre línea
        // chica y nombre grande.
        Animated.sequence([
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(greetOpacity, {
              toValue: 1,
              duration: 320,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(greetTx, {
              toValue: 0,
              tension: 80,
              friction: 11,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(nameOpacity, {
              toValue: 1,
              duration: 380,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(nameTx, {
              toValue: 0,
              tension: 70,
              friction: 9,
              useNativeDriver: true,
            }),
            Animated.spring(nameScale, {
              toValue: 1,
              tension: 65,
              friction: 8,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    }, 760);

    /* ─── 4. EXIT (1700ms — total ~2s) ─── */
    const exitTimer = setTimeout(() => exit(), 1700);

    return () => {
      clearTimeout(morphTimer);
      clearTimeout(disarmTimer);
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
        duration: 320,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(greetOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(nameOpacity, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(nameScale, {
        toValue: 1.04,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onEnd());
  };

  /* ─── Triángulos del isotipo — geometría oficial brand-kit
   *     (viewBox 100, mismos `points` que el logo empresa). */
  const TRI_BACK_POINTS = "38,26 16,86 60,86";
  const TRI_FRONT_POINTS = "56,12 29,86 83,86";
  const STROKE_W = 5.5;

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
          {/* Logo: aparece centrado, hace morph negro→verde, después
              se desarma. Position absoluta para que pueda compartir
              el centro óptico con el greeting (que también va al
              centro vertical). */}
          <Animated.View
            style={[
              s.logoWrap,
              {
                opacity: Animated.multiply(logoOpacity, trianglesOpacity),
                transform: [
                  { scale: Animated.multiply(logoScale, morphPulse) },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Svg width={120} height={120} viewBox="0 0 100 100">
              {/* Triángulo trasero — verde brand desde el inicio. */}
              <AnimatedPolygon
                points={TRI_BACK_POINTS}
                stroke={c.brand}
                strokeWidth={STROKE_W}
                strokeLinejoin="round"
                fill="none"
                translateX={backTriX}
              />
              {/* Triángulo delantero — capa negra (start). */}
              <AnimatedPolygon
                points={TRI_FRONT_POINTS}
                stroke={c.text}
                strokeWidth={STROKE_W}
                strokeLinejoin="round"
                fill="none"
                opacity={frontBlackOpacity}
                translateX={frontTriX}
              />
              {/* Triángulo delantero — capa verde (end del morph). */}
              <AnimatedPolygon
                points={TRI_FRONT_POINTS}
                stroke={c.brand}
                strokeWidth={STROKE_W}
                strokeLinejoin="round"
                fill="none"
                opacity={frontGreenOpacity}
                translateX={frontTriX}
              />
            </Svg>
          </Animated.View>

          {/* Greeting alineado a la izquierda — entra desde fuera. */}
          <View style={s.greetingWrap} pointerEvents="none">
            <Animated.Text
              style={[
                s.greeting,
                {
                  color: c.textMuted,
                  opacity: greetOpacity,
                  transform: [{ translateX: greetTx }],
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
                  transform: [
                    { translateX: nameTx },
                    { scale: nameScale },
                  ],
                },
              ]}
            >
              {firstName}
            </Animated.Text>
          </View>
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
  logoWrap: {
    // Centrado absoluto para que se solape con el greeting (mismo
    // centro óptico vertical, ambos en el medio de la pantalla).
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  greetingWrap: {
    // Alineado a la izquierda — el saludo "vive" donde estaba el
    // logo pero alineado al edge para sentirse personal.
    alignItems: "flex-start",
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
