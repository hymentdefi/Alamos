import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { brand, fontFamily, useTheme } from "../theme";
import type { ProTransitionTarget } from "./context";

const { width: SCREEN_W } = Dimensions.get("window");

interface Props {
  target: ProTransitionTarget;
  /** Llamado cuando la animación está por la mitad — flippea `isPro`. */
  onCommit: () => void;
  /** Llamado al final — limpia el target y desmonta el overlay. */
  onEnd: () => void;
}

/** Long enough to cubrir el perímetro de cualquiera de los dos triángulos. */
const DASH_LEN = 260;

/**
 * Sólo los dos triángulos del isotipo Alamos, dibujados en SVG con
 * animación de trazo (estilo pencil-draw). El param `progress` va de
 * 0 a 1; los triángulos se dibujan con un stagger (verde adelanta al
 * negro) para que el recorrido del lápiz se sienta orgánico.
 */
function AnimatedAlamosMark({
  size,
  tone,
  progress,
}: {
  size: number;
  tone: "light" | "dark";
  progress: number;
}) {
  const inkColor = tone === "dark" ? "#FAFAF7" : "#0E0F0C";

  // Stagger: el verde se dibuja durante 0-0.65, el negro durante 0.35-1.
  const p1 = Math.min(1, progress / 0.65);
  const p2 = Math.max(0, (progress - 0.35) / 0.65);
  const offset1 = (1 - p1) * DASH_LEN;
  const offset2 = (1 - p2) * DASH_LEN;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M 38 26 L 16 86 L 60 86 Z"
        stroke="#00E676"
        strokeWidth={6.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${DASH_LEN} ${DASH_LEN}`}
        strokeDashoffset={offset1}
      />
      <Path
        d="M 56 12 L 29 86 L 83 86 Z"
        stroke={inkColor}
        strokeWidth={6.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${DASH_LEN} ${DASH_LEN}`}
        strokeDashoffset={offset2}
      />
    </Svg>
  );
}

/**
 * Overlay full-screen tipo "Bienvenido a Alamos Pro" que se muestra al
 * cambiar de modo. Orquesta una secuencia de animaciones entretenidas:
 * fade de background, stagger de welcome/logo/accent, drawing-in de
 * los triángulos del isotipo, commit del flip por detrás, y fade-out.
 */
export function ProTransition({ target, onCommit, onEnd }: Props) {
  const { mode, c } = useTheme();

  // Animated values — se crean una sola vez y se resetean en cada ciclo.
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTx = useRef(new Animated.Value(24)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoTx = useRef(new Animated.Value(16)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const accentTx = useRef(new Animated.Value(40)).current;
  const accentOpacity = useRef(new Animated.Value(0)).current;
  const accentScale = useRef(new Animated.Value(0.6)).current;

  // Progress del drawing (0 → 1) — se maneja por JS porque react-native-svg
  // tiene bugs con strokeDashoffset animado por Animated.Value en algunas
  // versiones. RAF + setState es estable y suficientemente suave.
  const [drawProgress, setDrawProgress] = useState(0);

  useEffect(() => {
    if (!target) return;

    // Reset todos los valores al punto inicial.
    bgOpacity.setValue(0);
    welcomeTx.setValue(24);
    welcomeOpacity.setValue(0);
    logoScale.setValue(0.6);
    logoTx.setValue(16);
    logoOpacity.setValue(0);
    accentTx.setValue(40);
    accentOpacity.setValue(0);
    accentScale.setValue(0.6);
    setDrawProgress(0);

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
            friction: 8,
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
            duration: 340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(720),
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

    // Drawing de los triángulos vía RAF — arranca con un pequeño delay
    // para que se sincronice con la aparición del logo y acompaña la
    // sensación de que el logo 'se dibuja solo'.
    let rafId: number;
    let drawStart: number | null = null;
    const DRAW_DELAY = 380;
    const DRAW_DURATION = 780;
    const drawStartTimer = setTimeout(() => {
      const tick = (now: number) => {
        if (drawStart === null) drawStart = now;
        const elapsed = now - drawStart;
        const p = Math.min(1, elapsed / DRAW_DURATION);
        // ease-out cubic — siente como un lápiz frenando al final.
        const eased = 1 - Math.pow(1 - p, 3);
        setDrawProgress(eased);
        if (p < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }, DRAW_DELAY);

    // Haptic cuando termina el stagger de entrada.
    const hapticTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 1100);

    // Flip por detrás — el overlay está opaco, el user no ve el swap.
    const commitTimer = setTimeout(() => {
      onCommit();
    }, 1300);

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
    }, 1850);

    return () => {
      clearTimeout(drawStartTimer);
      clearTimeout(hapticTimer);
      clearTimeout(commitTimer);
      clearTimeout(exitTimer);
      cancelAnimationFrame(rafId);
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
  const isDark = mode === "dark";
  const bgColor = c.bg;
  const welcomeColor = c.textMuted;
  const logoTone: "light" | "dark" = isDark ? "dark" : "light";
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

          <Animated.View
            style={[
              s.logoRow,
              {
                opacity: logoOpacity,
                transform: [
                  { translateY: logoTx },
                  { scale: logoScale },
                ],
              },
            ]}
          >
            <AnimatedAlamosMark
              size={96}
              tone={logoTone}
              progress={drawProgress}
            />
            <Animated.Text
              style={[
                s.alamosText,
                { color: isDark ? brand.bg : brand.ink },
              ]}
            >
              Alamos
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
          </Animated.View>
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
    paddingHorizontal: 28,
    justifyContent: "center",
    width: SCREEN_W,
  },
  welcome: {
    fontFamily: fontFamily[600],
    fontSize: 26,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  alamosText: {
    fontFamily: fontFamily[700],
    fontSize: 52,
    letterSpacing: -2.4,
    // Pegar el texto a la derecha del mark SVG. El viewBox del mark
    // (100x100) deja aire a los lados; compensamos con margin negativo.
    marginLeft: -10,
  },
  accentText: {
    fontFamily: fontFamily[700],
    fontSize: 52,
    letterSpacing: -1.6,
    marginLeft: 6,
  },
});
