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

// Triángulo trasero — `M 38,26 L 16,86 L 60,86 Z`
const TRI_BACK_PATH = "M 38,26 L 16,86 L 60,86 Z";
// Triángulo delantero — `M 56,12 L 29,86 L 83,86 Z`
const TRI_FRONT_PATH = "M 56,12 L 29,86 L 83,86 Z";

// Perímetros calculados — necesarios para el stroke-dashoffset reveal.
// Lados back:    sqrt(22²+60²)=64, 44, sqrt(22²+60²)=64 → 172
// Lados front:   sqrt(27²+74²)≈78.8, 54, sqrt(27²+74²)≈78.8 → 211.6
const TRI_BACK_PERIMETER = 172;
const TRI_FRONT_PERIMETER = 212;

const STROKE_W = 5.5;
const LOGO_SIZE = 132;

/**
 * Animación de entrada coordinada — todo conectado, ningún corte:
 *
 *   A. Boot (0–360ms)   — fondo + logo aparecen como en el splash
 *      nativo (back verde + front outline negro). Scale spring + fadeIn.
 *
 *   B. Charge (360–960ms) — el verde brand se TRAZA encima del front
 *      como si lo dibujaran (strokeDashoffset 0→full). Mientras el
 *      trace avanza, el negro original se va apagando proporcional.
 *      Al final el logo está "todo verde". Pulse + haptic Light al
 *      cerrar el trazo.
 *
 *   C. Morph to text (960–1700ms) — los triángulos se DESLIZAN hacia
 *      la izquierda mientras se achican y giran levemente. Cada uno
 *      "se convierte" visualmente en una línea del saludo:
 *         · back  → "Buen día,"  (se va arriba-izq)
 *         · front → "Christian"  (se va abajo-izq, más amplitud)
 *      Mientras los triángulos viajan, su opacity baja en sincronía
 *      con la opacity de cada línea de texto que emerge desde la
 *      misma trayectoria. Al cierre: triángulos en 0, textos en 1,
 *      sin pop.
 *
 *   D. Hold (1700–2050ms)
 *
 *   E. Exit (2050–2350ms) — fade global, onEnd.
 *
 * Tappeable para skip rápido. Total ~2.3s — suficiente para que cada
 * beat se lea pero corto para no aburrir.
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
  const logoScale = useRef(new Animated.Value(0.82)).current;

  /* ─── B. Charge / morph ─── */
  // Trazo verde sobre el front. Empieza con dashoffset = perímetro
  // (invisible) y termina en 0 (cerrado). Lo mismo para el back para
  // que ambos se "redibujen" sincronizados.
  const backTraceOffset = useRef(
    new Animated.Value(TRI_BACK_PERIMETER),
  ).current;
  const frontTraceOffset = useRef(
    new Animated.Value(TRI_FRONT_PERIMETER),
  ).current;
  // Front-negro original que se desvanece a medida que el verde lo cubre.
  const frontBlackOpacity = useRef(new Animated.Value(1)).current;
  // Pulse al final del charge — confirma "encendido".
  const chargePulse = useRef(new Animated.Value(1)).current;

  /* ─── C. Morph to text — viajes individuales ─── */
  // Each triangle has its own translate (X,Y), scale, rotate, opacity.
  // El back va a la posición de "Buen día," y el front a "Christian".
  const backTx = useRef(new Animated.Value(0)).current;
  const backTy = useRef(new Animated.Value(0)).current;
  const backScale = useRef(new Animated.Value(1)).current;
  const backRot = useRef(new Animated.Value(0)).current;
  const backOpacity = useRef(new Animated.Value(1)).current;

  const frontTx = useRef(new Animated.Value(0)).current;
  const frontTy = useRef(new Animated.Value(0)).current;
  const frontScale = useRef(new Animated.Value(1)).current;
  const frontRot = useRef(new Animated.Value(0)).current;
  const frontOpacity = useRef(new Animated.Value(1)).current;

  /* ─── D. Greeting in ─── */
  // Cada línea entra desde la posición desde donde llega su triángulo
  // — eso da la sensación de "el triángulo se convirtió en este texto".
  const greetTx = useRef(new Animated.Value(40)).current;
  const greetOpacity = useRef(new Animated.Value(0)).current;
  const greetScale = useRef(new Animated.Value(0.85)).current;

  const nameTx = useRef(new Animated.Value(60)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameScale = useRef(new Animated.Value(0.78)).current;

  // Re-entry guard.
  const endedRef = useRef(false);

  useEffect(() => {
    /* ─── A. BOOT (0–360ms) ─── */
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
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    /* ─── B. CHARGE / TRACE (360→960ms) ─── */
    const chargeTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Animated.parallel([
        // Trace de los dos triángulos en simultáneo — back y front se
        // "redibujan" al mismo tiempo. La duración es igual aunque
        // tengan perímetros distintos para que el feel sea unificado;
        // el ojo no nota la diferencia de velocidad.
        Animated.timing(backTraceOffset, {
          toValue: 0,
          duration: 600,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(frontTraceOffset, {
          toValue: 0,
          duration: 600,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        // El negro original se va apagando — empezamos a 30% del trace
        // para que el verde "monte" antes de que desaparezca el negro.
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(frontBlackOpacity, {
            toValue: 0,
            duration: 360,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        // Pulse al cerrar — 1 → 1.06 → 1.
        Animated.sequence([
          Animated.delay(540),
          Animated.timing(chargePulse, {
            toValue: 1.06,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(chargePulse, {
            toValue: 1,
            duration: 200,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, 360);

    /* ─── C. MORPH TO TEXT (960→1700ms) ─── */
    // Direcciones aproximadas — el back va arriba-izquierda (donde
    // "Buen día,") y el front abajo-izquierda con más amplitud
    // (donde "Christian"). Y/X negativos = arriba/izquierda.
    const morphTimer = setTimeout(() => {
      Animated.parallel([
        /* Back → "Buen día," */
        Animated.timing(backTx, {
          toValue: -110,
          duration: 720,
          easing: Easing.bezier(0.65, 0, 0.35, 1),
          useNativeDriver: true,
        }),
        Animated.timing(backTy, {
          toValue: -38,
          duration: 720,
          easing: Easing.bezier(0.65, 0, 0.35, 1),
          useNativeDriver: true,
        }),
        Animated.timing(backScale, {
          toValue: 0.18,
          duration: 720,
          easing: Easing.bezier(0.5, 0, 0.5, 1),
          useNativeDriver: true,
        }),
        Animated.timing(backRot, {
          toValue: -18,
          duration: 720,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(420),
          Animated.timing(backOpacity, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),

        /* Front → "Christian" — más amplitud y baja más */
        Animated.timing(frontTx, {
          toValue: -120,
          duration: 740,
          easing: Easing.bezier(0.65, 0, 0.35, 1),
          useNativeDriver: true,
        }),
        Animated.timing(frontTy, {
          toValue: 28,
          duration: 740,
          easing: Easing.bezier(0.65, 0, 0.35, 1),
          useNativeDriver: true,
        }),
        Animated.timing(frontScale, {
          toValue: 0.22,
          duration: 740,
          easing: Easing.bezier(0.5, 0, 0.5, 1),
          useNativeDriver: true,
        }),
        Animated.timing(frontRot, {
          toValue: 14,
          duration: 740,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(440),
          Animated.timing(frontOpacity, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),

        /* Greeting line — entra cuando el back triangle llega a destino */
        Animated.sequence([
          Animated.delay(280),
          Animated.parallel([
            Animated.timing(greetOpacity, {
              toValue: 1,
              duration: 380,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(greetTx, {
              toValue: 0,
              tension: 75,
              friction: 11,
              useNativeDriver: true,
            }),
            Animated.spring(greetScale, {
              toValue: 1,
              tension: 70,
              friction: 9,
              useNativeDriver: true,
            }),
          ]),
        ]),

        /* Name — stagger 120ms después */
        Animated.sequence([
          Animated.delay(400),
          Animated.parallel([
            Animated.timing(nameOpacity, {
              toValue: 1,
              duration: 460,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.spring(nameTx, {
              toValue: 0,
              tension: 65,
              friction: 9,
              useNativeDriver: true,
            }),
            Animated.spring(nameScale, {
              toValue: 1,
              tension: 60,
              friction: 8,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    }, 960);

    /* ─── E. EXIT (a los 2050ms) ─── */
    const exitTimer = setTimeout(() => exit(), 2050);

    return () => {
      clearTimeout(chargeTimer);
      clearTimeout(morphTimer);
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

  /* ─── Estilos animados de cada triángulo (transforms compuestos) ─── */
  const backRotStr = backRot.interpolate({
    inputRange: [-360, 360],
    outputRange: ["-360deg", "360deg"],
  });
  const frontRotStr = frontRot.interpolate({
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
      <Animated.View
        style={[s.backdrop, { backgroundColor: c.bg, opacity: bgOpacity }]}
      >
        <Pressable style={s.content} onPress={exit}>
          {/* Logo wrapper — escala global de entrada + pulse del charge.
              Centrado absoluto en la pantalla. */}
          <Animated.View
            style={[
              s.logoWrap,
              {
                opacity: logoOpacity,
                transform: [
                  { scale: Animated.multiply(logoScale, chargePulse) },
                ],
              },
            ]}
            pointerEvents="none"
          >
            {/* Triángulo BACK — un container animado individual para
                que su trayectoria al texto sea independiente. */}
            <Animated.View
              style={[
                s.triLayer,
                {
                  opacity: backOpacity,
                  transform: [
                    { translateX: backTx },
                    { translateY: backTy },
                    { rotate: backRotStr },
                    { scale: backScale },
                  ],
                },
              ]}
            >
              <Svg
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                viewBox="0 0 100 100"
              >
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
              </Svg>
            </Animated.View>

            {/* Triángulo FRONT — capa NEGRA original (start state) */}
            <Animated.View
              style={[
                s.triLayer,
                {
                  opacity: Animated.multiply(frontOpacity, frontBlackOpacity),
                  transform: [
                    { translateX: frontTx },
                    { translateY: frontTy },
                    { rotate: frontRotStr },
                    { scale: frontScale },
                  ],
                },
              ]}
            >
              <Svg
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                viewBox="0 0 100 100"
              >
                <Path
                  d={TRI_FRONT_PATH}
                  stroke={c.text}
                  strokeWidth={STROKE_W}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </Animated.View>

            {/* Triángulo FRONT — capa VERDE que se traza encima */}
            <Animated.View
              style={[
                s.triLayer,
                {
                  opacity: frontOpacity,
                  transform: [
                    { translateX: frontTx },
                    { translateY: frontTy },
                    { rotate: frontRotStr },
                    { scale: frontScale },
                  ],
                },
              ]}
            >
              <Svg
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                viewBox="0 0 100 100"
              >
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
          </Animated.View>

          {/* Greeting alineado a la izquierda — emerge de la trayectoria
              de los triángulos. */}
          <View style={s.greetingWrap} pointerEvents="none">
            <Animated.Text
              style={[
                s.greeting,
                {
                  color: c.textMuted,
                  opacity: greetOpacity,
                  transform: [
                    { translateX: greetTx },
                    { scale: greetScale },
                  ],
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
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  triLayer: {
    position: "absolute",
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  greetingWrap: {
    alignItems: "flex-start",
  },
  greeting: {
    fontFamily: fontFamily[500],
    fontSize: 26,
    letterSpacing: -0.4,
    marginBottom: 4,
    transformOrigin: "left",
  },
  name: {
    fontFamily: fontFamily[700],
    fontSize: 56,
    letterSpacing: -2.4,
    transformOrigin: "left",
  },
});
