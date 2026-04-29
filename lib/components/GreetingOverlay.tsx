import { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
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
 * Splash post-native — apertura premium con tres beats:
 *
 *   1. PANTALLA BLANCA + LOGO MIX (verde + negro) entrance.
 *
 *   2. COVER VERDE BRAND sube desde abajo MIENTRAS el logo se va
 *      tornando BLANCO en la zona que el cover ya cubrió. Es un
 *      wipe genuino atado pixel-a-pixel al avance del cover.
 *
 *      Implementación: el cover y el wipe comparten el mismo
 *      `coverProgress` shared value. La altura del wipe se
 *      interpola con `wipeStart`/`wipeEnd` calculados con la
 *      geometría real (windowH y LOGO_SIZE), no aproximaciones.
 *
 *      El wipe NO usa MaskedView — usa un wrapper con overflow:
 *      hidden + altura animada. El logo blanco vive dentro del
 *      wrapper, anclado al bottom; cuando el wrapper crece desde 0
 *      hasta LOGO_SIZE, va exponiendo el logo blanco desde abajo
 *      hacia arriba en sincro con el verde subiendo.
 *
 *   3. RING SVG se TRAZA — strokeDashoffset CIRC→0 con
 *      `useAnimatedProps` (no Animated nativo, que no anima bien
 *      props SVG). "Lo vemos nacer y cerrarse".
 *
 *   4. Saludo en blanco sobre verde.
 *
 * Tappeable para skip. Total ~3.9s.
 */
export function GreetingOverlay({ onEnd }: Props) {
  const { c } = useTheme();
  const { user } = useAuth();
  const { height: windowH } = useWindowDimensions();
  const firstName = user?.fullName?.split(" ")[0] ?? "Christian";
  const greeting = timeGreeting();

  /* ─── Shared values (Reanimated 3) ─── */

  // Progreso del cover + wipe (0 → 1). Único valor para los dos.
  const coverProgress = useSharedValue(0);

  // Logo entry.
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.94);
  const logoPulse = useSharedValue(1);
  const logoExitOpacity = useSharedValue(1);
  const logoExitScale = useSharedValue(1);

  // Ring.
  const ringProgress = useSharedValue(0); // 0 = invisible, 1 = cerrado
  const ringOpacity = useSharedValue(0);

  // Greeting.
  const greetTy = useSharedValue(12);
  const greetOpacity = useSharedValue(0);
  const nameTy = useSharedValue(16);
  const nameOpacity = useSharedValue(0);

  /* ─── Geometría exacta del wipe ─── */
  // Puntos del coverProgress donde empieza/termina el wipe en el logo:
  //   - coverProgress = 0   → cover en y=windowH (todo abajo)
  //   - coverProgress = 1   → cover en y=0 (full-cover)
  //   - el TOP del cover en pantalla está en `windowH * (1 - p)`
  //   - cuando ese top toca el bottom del logo (windowH/2 + LOGO_SIZE/2)
  //     ARRANCA el wipe; cuando supera el top del logo (windowH/2 -
  //     LOGO_SIZE/2) el wipe está completo.
  const wipeStart = 1 - (windowH / 2 + LOGO_SIZE / 2) / windowH;
  const wipeEnd = 1 - (windowH / 2 - LOGO_SIZE / 2) / windowH;

  /* ─── Animated styles ─── */

  // Cover: translateY de windowH a 0.
  const coverStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          coverProgress.value,
          [0, 1],
          [windowH, 0],
        ),
      },
    ],
  }));

  // Wipe: el wrapper crece de 0 a LOGO_SIZE entre wipeStart y wipeEnd.
  // Anclado al bottom (vía paddingTop o flex-end del padre).
  const wipeStyle = useAnimatedStyle(() => ({
    height: interpolate(
      coverProgress.value,
      [0, wipeStart, wipeEnd, 1],
      [0, 0, LOGO_SIZE, LOGO_SIZE],
    ),
  }));

  // Hero (logo + ring): opacity entry × exit, scale entry × pulse × exit.
  const heroStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value * logoExitOpacity.value,
    transform: [
      { scale: logoScale.value * logoPulse.value * logoExitScale.value },
    ],
  }));

  // Ring: animatedProps con strokeDashoffset interpolado.
  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      ringProgress.value,
      [0, 1],
      [CIRC, 0],
    ),
  }));

  const ringWrapStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));

  // Greeting + nombre.
  const greetStyle = useAnimatedStyle(() => ({
    opacity: greetOpacity.value,
    transform: [{ translateY: greetTy.value }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameTy.value }],
  }));

  /* ─── Coreografía ─── */
  useEffect(() => {
    /* 1. Logo MIX entry (0–340ms) */
    logoOpacity.value = withTiming(1, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
    logoScale.value = withSpring(1, {
      mass: 1,
      stiffness: 80,
      damping: 12,
    });

    /* 2. Hold del logo mix (340–620ms) */
    /* 3. Cover sube + WIPE en sincro (a partir de 620ms) */
    const coverTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      coverProgress.value = withTiming(1, {
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
      });
      // Ring fade-in al final del cover.
      ringOpacity.value = withDelay(
        1180,
        withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      );
    }, 620);

    /* 4. Cover terminó (≈2020ms). Ring se TRAZA. */
    const ringTimer = setTimeout(() => {
      ringProgress.value = withTiming(
        1,
        {
          duration: 820,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        },
        (finished) => {
          "worklet";
          if (!finished) return;
          // Selection haptic + pulse al cerrar.
          runOnJS(triggerSelectionHaptic)();
          logoPulse.value = withTiming(
            1.05,
            { duration: 140, easing: Easing.out(Easing.quad) },
            () => {
              "worklet";
              logoPulse.value = withTiming(1, {
                duration: 200,
                easing: Easing.inOut(Easing.cubic),
              });
            },
          );
        },
      );
    }, 2120);

    /* 5. Saludo emerge cuando el ring cerró (a los 3060ms) */
    const greetingTimer = setTimeout(() => {
      logoExitOpacity.value = withTiming(0, {
        duration: 400,
        easing: Easing.inOut(Easing.cubic),
      });
      logoExitScale.value = withTiming(1.05, {
        duration: 440,
        easing: Easing.out(Easing.cubic),
      });
      ringOpacity.value = withTiming(0, {
        duration: 320,
        easing: Easing.in(Easing.cubic),
      });

      greetOpacity.value = withDelay(
        180,
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
      );
      greetTy.value = withDelay(
        180,
        withSpring(0, { mass: 1, stiffness: 78, damping: 13 }),
      );
      nameOpacity.value = withDelay(
        280,
        withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }),
      );
      nameTy.value = withDelay(
        280,
        withSpring(0, { mass: 1, stiffness: 70, damping: 12 }),
      );
    }, 3060);

    /* 6. EXIT (a los 4100ms) */
    const exitTimer = setTimeout(() => {
      greetOpacity.value = withTiming(0, { duration: 240 });
      nameOpacity.value = withTiming(0, { duration: 280 });
      // Llamar onEnd después del fade.
      setTimeout(() => onEnd(), 320);
    }, 4100);

    return () => {
      clearTimeout(coverTimer);
      clearTimeout(ringTimer);
      clearTimeout(greetingTimer);
      clearTimeout(exitTimer);
      cancelAnimation(coverProgress);
      cancelAnimation(ringProgress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip rápido al tap.
  const skip = () => {
    greetOpacity.value = withTiming(0, { duration: 180 });
    nameOpacity.value = withTiming(0, { duration: 220 });
    setTimeout(() => onEnd(), 220);
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
        <Pressable style={StyleSheet.absoluteFill} onPress={skip}>
          {/* Cover verde brand sólido. Sin halo, sin gradient. */}
          <Animated.View
            style={[s.cover, { backgroundColor: c.brand }, coverStyle]}
            pointerEvents="none"
          />

          {/* Saludo — alineado a la izquierda, vive sobre el cover.
              Aparece después del ring. */}
          <View style={s.greetingWrap} pointerEvents="none">
            <Animated.Text style={[s.greeting, greetStyle]}>
              {greeting}
            </Animated.Text>
            <Animated.Text style={[s.name, nameStyle]}>
              {firstName}
            </Animated.Text>
          </View>

          {/* Hero centrado: ring + logo. */}
          <Animated.View style={[s.hero, heroStyle]} pointerEvents="none">
            {/* Ring (SVG) — TRAZADO con strokeDashoffset animado.
                Usamos useAnimatedProps porque Animated nativo no anima
                bien props SVG, daba ese feel "aparece y ya". */}
            <Animated.View style={[s.ringWrap, ringWrapStyle]}>
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
                  rotation="-90"
                  originX={RING_VIEWBOX / 2}
                  originY={RING_VIEWBOX / 2}
                  animatedProps={ringAnimatedProps}
                />
              </Svg>
            </Animated.View>

            {/* Stack del logo: capa MIX abajo + capa BLANCA arriba con
                wipe. Cuando el cover sube por la zona del logo, el
                wrapper del blanco crece de bottom→top exponiendo el
                logo blanco píxel a píxel. */}
            <View style={s.logoStack}>
              {/* MIX siempre visible. */}
              <View style={s.logoLayer}>
                <AlamosLogo variant="mark" tone="light" size={LOGO_SIZE} />
              </View>

              {/* WIPE: wrapper anclado al bottom con altura animada
                  + overflow hidden. Adentro, el logo blanco también
                  anclado al bottom con tamaño full. A medida que el
                  wrapper crece, el logo se va exponiendo. */}
              <View style={s.logoLayer}>
                <Animated.View style={[s.wipeWrap, wipeStyle]}>
                  <View style={s.wipeInner}>
                    <AlamosLogo
                      variant="mark"
                      tone="white"
                      size={LOGO_SIZE}
                    />
                  </View>
                </Animated.View>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

/** JS thread helper para haptics — necesario porque withTiming
 *  callback corre en el UI thread. */
function triggerSelectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
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
  /** Wrapper del wipe — anclado al bottom (alignSelf flex-end + bottom 0
   *  via parent flex-end). Crece de 0 → LOGO_SIZE en altura. */
  wipeWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: LOGO_SIZE,
    overflow: "hidden",
  },
  /** Inner del wipe — el logo blanco está renderizado en su tamaño
   *  completo, posicionado al BOTTOM del wrapper. Cuando el wrapper
   *  tiene height = 0, no se ve nada (overflow hidden recorta).
   *  Cuando el wrapper crece a LOGO_SIZE, todo el blanco aparece. */
  wipeInner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
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
