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
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme";
import { AlamosLogo } from "./Logo";

interface Props {
  /** Llamado cuando termina la animación de salida — desmontar overlay. */
  onEnd: () => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ─── Geometría del ring (igual que confirm.tsx) ───────────────────── */
const RING_VIEWBOX = 100;
const RING_RADIUS = 44;
const CIRC = 2 * Math.PI * RING_RADIUS;
const RING_SIZE = 220;
const RING_STROKE = 2.6;
const LOGO_SIZE = 140;

/**
 * Splash post-native — apertura premium:
 *
 *   1. PANTALLA BLANCA + LOGO MIX (verde + negro) entrance (spring +
 *      fadeIn).
 *
 *   2. COVER VERDE BRAND sube desde abajo MIENTRAS el logo se va
 *      tornando BLANCO en la zona que el cover ya cubrió. Wipe
 *      genuino atado pixel-a-pixel al avance del cover.
 *
 *      Cover y wipe comparten el mismo `coverProgress` shared value.
 *      La altura del wipe se interpola con `wipeStart`/`wipeEnd`
 *      calculados con la geometría real (windowH y LOGO_SIZE).
 *      El wipe usa un wrapper con `overflow: hidden` + altura
 *      animada (sin MaskedView, más predecible).
 *
 *   3. RING SVG se TRAZA con `useAnimatedProps` — strokeDashoffset
 *      CIRC→0. Lo vemos nacer y cerrarse, no aparece de golpe.
 *      Selection haptic + pulse al cerrar.
 *
 *   4. EXIT — logo + ring fade quietos, cover sale slide hacia
 *      arriba revelando el home detrás (gesto "telón").
 *
 * Tappeable para skip. Total ~3.7s.
 */
export function GreetingOverlay({ onEnd }: Props) {
  const { c } = useTheme();
  const { height: windowH } = useWindowDimensions();

  /* ─── Shared values (Reanimated 3) ─── */

  // Progreso del cover + wipe (0 → 1). Único valor para los dos.
  const coverProgress = useSharedValue(0);

  // Logo: NO hay entry animada — el splash nativo de Expo ya mostró
  // el logo MIX estático. Arrancamos visible directamente para que
  // la transición native→JS sea invisible. Sólo el pulse del ring y
  // el fade-out final usan estos valores.
  const logoPulse = useSharedValue(1);

  // Ring.
  const ringProgress = useSharedValue(0); // 0 = invisible, 1 = cerrado
  const ringOpacity = useSharedValue(0);

  // Exit global — todo el overlay (cover + logo + ring) hace fade-out
  // smooth cuando el ring cierra, dejando el home detrás.
  const exitOpacity = useSharedValue(1);

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

  // Cover: translateY de windowH (todo abajo) a 0 (full-cover).
  const coverStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(coverProgress.value, [0, 1], [windowH, 0]),
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

  // Hero (logo + ring): siempre visible al 100%; sólo el pulse del
  // ring escala. El fade-out final lo maneja `exitOpacity` aplicado
  // al overlay entero.
  const heroStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoPulse.value }],
  }));

  // Exit global del overlay — cover + logo + ring fadean juntos.
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
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

  /* ─── Coreografía ─── */
  useEffect(() => {
    /* 1. Hold breve sobre el logo mix (0–220ms) — el splash nativo
     *    ya lo mostró estático, sólo necesitamos un beat para que
     *    el ojo registre la continuidad antes del cover. */

    /* 2. Cover sube + WIPE en sincro (a partir de 220ms) */
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
    }, 220);

    /* 3. Cover terminó (≈1620ms). Ring se TRAZA. */
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
    }, 1720);

    /* 4. EXIT smooth — todo el overlay (cover + logo + ring) hace
     *    fade-out conjunto cuando el ring cerró + el pulse terminó.
     *    Sin gestos, sin slide, sin ruido — desaparece y aparece
     *    el home. */
    const exitTimer = setTimeout(() => {
      exitOpacity.value = withTiming(
        0,
        {
          duration: 420,
          easing: Easing.inOut(Easing.cubic),
        },
        (finished) => {
          "worklet";
          if (finished) runOnJS(onEnd)();
        },
      );
    }, 2780);

    return () => {
      clearTimeout(coverTimer);
      clearTimeout(ringTimer);
      clearTimeout(exitTimer);
      cancelAnimation(coverProgress);
      cancelAnimation(ringProgress);
      cancelAnimation(exitOpacity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip rápido al tap — fade-out del overlay entero.
  const skip = () => {
    exitOpacity.value = withTiming(
      0,
      { duration: 220, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) runOnJS(onEnd)();
      },
    );
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
        style={[s.root, { backgroundColor: c.bg }, overlayStyle]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={skip}>
          {/* Cover verde brand sólido. Sin halo, sin gradient. */}
          <Animated.View
            style={[s.cover, { backgroundColor: c.brand }, coverStyle]}
            pointerEvents="none"
          />

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
      </Animated.View>
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
});
