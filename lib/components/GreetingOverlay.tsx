import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { fontFamily, useTheme } from "../theme";
import { useAuth } from "../auth/context";

interface Props {
  /** Llamado cuando termina la animación de salida — desmontar overlay. */
  onEnd: () => void;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Buen día,";
  if (h >= 12 && h < 20) return "Buenas tardes,";
  return "Buenas noches,";
}

/* ─── Geometría del isotipo (brand-kit) ───────────────────────────── */

const TRI_BACK_PATH = "M 38,26 L 16,86 L 60,86 Z";
const TRI_FRONT_PATH = "M 56,12 L 29,86 L 83,86 Z";

// Lados back:    sqrt(22²+60²)=64, 44, sqrt(22²+60²)=64 → 172
// Lados front:   sqrt(27²+74²)≈79, 54, sqrt(27²+74²)≈79 → 212
const TRI_BACK_PERIMETER = 172;
const TRI_FRONT_PERIMETER = 212;

const STROKE_W = 5.5;
const LOGO_SIZE = 124;

/**
 * Animación de entrada — secuencia continua, ningún corte:
 *
 *   A. Boot (0–340ms)        — backdrop + logo entry (scale 0.94→1).
 *   B. Charge / TRACE        — el verde brand se dibuja sobre el
 *      (340–940ms)             front-negro animando strokeDashoffset.
 *                              El negro fadea desde el 40% del trace
 *                              para overlap suave. Selection haptic
 *                              al cerrar.
 *   C. Hold del logo verde   — 250ms quieto. El "beat" premium —
 *      (940–1190ms)            le da al logo un momento de respiro
 *                              antes de la transición.
 *   D. Logo out + Text in    — el logo se desvanece quieto con un
 *      (1190–1700ms)           scale-up muy sutil (1→1.04). El texto
 *                              entra en su propia posición (left
 *                              padding, ~42% altura) con fadeIn +
 *                              translateY de 10px. Greeting antes,
 *                              name con stagger 80ms. NO viajan
 *                              hacia ningún lado: cada elemento se
 *                              mueve mínimo, lo que coordina es el
 *                              TIMING, no la trayectoria.
 *   E. Hold (1700–2200ms)    — el saludo respira.
 *   F. Exit (2200–2500ms)    — fade global, onEnd.
 *
 * Tappeable para skip rápido.
 */
export function GreetingOverlay({ onEnd }: Props) {
  const { c } = useTheme();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "Christian";
  const greeting = timeGreeting();

  /* ─── Backdrop ─── */
  const bgOpacity = useRef(new Animated.Value(0)).current;

  /* ─── A. Logo entry ─── */
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;

  /* ─── B. Charge / trace ─── */
  const backTraceOffset = useRef(
    new Animated.Value(TRI_BACK_PERIMETER),
  ).current;
  const frontTraceOffset = useRef(
    new Animated.Value(TRI_FRONT_PERIMETER),
  ).current;
  const frontBlackOpacity = useRef(new Animated.Value(1)).current;

  /* ─── D. Logo exit ─── */
  // Scale-up muy sutil (1 → 1.04) mientras opacity 1 → 0. NO se mueve.
  const logoExitScale = useRef(new Animated.Value(1)).current;
  const logoExitOpacity = useRef(new Animated.Value(1)).current;

  /* ─── D. Greeting in ─── */
  const greetTy = useRef(new Animated.Value(10)).current;
  const greetOpacity = useRef(new Animated.Value(0)).current;

  const nameTy = useRef(new Animated.Value(14)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;

  // Re-entry guard.
  const endedRef = useRef(false);

  useEffect(() => {
    /* ─── A. BOOT ─── */
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 95,
        friction: 13,
        useNativeDriver: true,
      }),
    ]).start();

    /* ─── B. TRACE (340→940ms) ─── */
    const traceTimer = setTimeout(() => {
      Animated.parallel([
        // Trace de los dos triángulos en simultáneo. easeInOut suave
        // — más contemplativo que un easeOut punchy.
        Animated.timing(backTraceOffset, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(frontTraceOffset, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // El negro fadea desde el 40% del trace.
        Animated.sequence([
          Animated.delay(240),
          Animated.timing(frontBlackOpacity, {
            toValue: 0,
            duration: 320,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Selection haptic muy sutil al cerrar el trazo — confirma
        // sin gritar.
        Haptics.selectionAsync().catch(() => {});
      });
    }, 340);

    /* ─── D. LOGO OUT + TEXT IN (a partir de 1190ms) ─── */
    // El logo holdea 250ms quieto antes de empezar el exit. Ese hold
    // es lo que se siente premium — el ojo necesita el beat para
    // registrar el logo completo en verde.
    const transitionTimer = setTimeout(() => {
      Animated.parallel([
        // Logo se desvanece quieto + scale-up muy sutil.
        Animated.timing(logoExitOpacity, {
          toValue: 0,
          duration: 460,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoExitScale, {
          toValue: 1.04,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),

        // Greeting line — entra con fade + translateY mínimo.
        Animated.sequence([
          Animated.delay(160),
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

        // Name — stagger 80ms.
        Animated.sequence([
          Animated.delay(240),
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
    }, 1190);

    /* ─── F. EXIT (a los 2200ms) ─── */
    const exitTimer = setTimeout(() => exit(), 2200);

    return () => {
      clearTimeout(traceTimer);
      clearTimeout(transitionTimer);
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
      <Animated.View
        style={[s.backdrop, { backgroundColor: c.bg, opacity: bgOpacity }]}
      >
        <Pressable style={s.content} onPress={exit}>
          {/* Logo wrapper — centrado absoluto. Scale spring de entrada
              + scale-up sutil del exit + opacity del exit (todo
              compuesto). El logo no se mueve nunca, sólo se ilumina
              y desvanece quieto. */}
          <Animated.View
            style={[
              s.logoWrap,
              {
                opacity: Animated.multiply(logoOpacity, logoExitOpacity),
                transform: [
                  { scale: Animated.multiply(logoScale, logoExitScale) },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 100 100">
              {/* Triángulo BACK — verde brand, se traza con dashoffset. */}
              <AnimatedPath
                d={TRI_BACK_PATH}
                stroke={c.brand}
                strokeWidth={STROKE_W}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${TRI_BACK_PERIMETER} ${TRI_BACK_PERIMETER}`}
                strokeDashoffset={backTraceOffset}
              />
              {/* Triángulo FRONT capa NEGRA — start state, fadea
                  durante el trace. */}
              <AnimatedPath
                d={TRI_FRONT_PATH}
                stroke={c.text}
                strokeWidth={STROKE_W}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
                opacity={frontBlackOpacity}
              />
              {/* Triángulo FRONT capa VERDE — se traza encima. */}
              <AnimatedPath
                d={TRI_FRONT_PATH}
                stroke={c.brand}
                strokeWidth={STROKE_W}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${TRI_FRONT_PERIMETER} ${TRI_FRONT_PERIMETER}`}
                strokeDashoffset={frontTraceOffset}
              />
            </Svg>
          </Animated.View>

          {/* Greeting — alineado a la izquierda, posición propia.
              No emerge del logo: aparece en su propio lugar con un
              fade + translateY mínimo. La unidad la da el TIMING. */}
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
    // El saludo va a 42% de altura — un poquito arriba del centro
    // para que respire arriba del fold y no quede bajo.
    justifyContent: "center",
  },
  logoWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  greetingWrap: {
    alignItems: "flex-start",
  },
  /* ─── Tipografía editorial — escala Alamos (no shouting). El
   *     "Buen día," small/muted, el nombre con la jerarquía del
   *     `type.h1` del theme (32, weight 700, letter-spacing -1.1)
   *     pero un toque más bold (-1.4). */
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
