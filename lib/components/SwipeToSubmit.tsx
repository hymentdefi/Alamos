import { useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import * as Haptics from "expo-haptics";
import { fontFamily, radius } from "../theme";

/* ─── Constantes del gesto (calibradas contra Robinhood) ──────────── */

/** Distancia nominal del recorrido del dedo, en px. */
const SWIPE_RANGE = 280;
/** Fracción del recorrido del dedo para considerar "confirmado". */
const SWIPE_COMMIT_FRACTION = 0.45;
/** Velocidad mínima de flick para confirmar, px/ms. */
const SWIPE_FLICK_VELOCITY = 0.6;
/** Distancia mínima junto con flick, fracción del range. */
const SWIPE_FLICK_MIN_FRACTION = 0.35;
/** Damping máximo al 100% del recorrido (banda elástica). */
const SWIPE_DAMPING_MAX = 0.3;
/** Altura visual del pill en reposo. */
const PILL_HEIGHT = 72;

/* ─── Constantes del shimmer ─────────────────────────────────────── */

/** Fracción del ancho del pill que ocupa el wave del shimmer. */
const SHIMMER_WIDTH_FRACTION = 0.55;
/** Duración del recorrido del shimmer de punta a punta, ms. */
const SHIMMER_SWEEP_MS = 2200;
/** Pausa entre ciclos del shimmer, ms. */
const SHIMMER_PAUSE_MS = 900;
/** Fracción del progress a partir de la cual el shimmer se oculta
 * (cuando empezás a arrastrar, el brillo desaparece rápido). */
const SHIMMER_FADE_OUT_AT = 0.15;

/** Colores del gradiente del shimmer. 5 stops para transiciones suaves
 * sin "flash" cortante. */
const SHIMMER_COLORS = [
  "rgba(255,255,255,0)",
  "rgba(255,255,255,0.22)",
  "rgba(255,255,255,0.55)",
  "rgba(255,255,255,0.22)",
  "rgba(255,255,255,0)",
] as const;
const SHIMMER_LOCATIONS = [0, 0.3, 0.5, 0.7, 1] as const;

/* ─── Haptics JS-side (se invocan vía runOnJS desde el worklet) ──── */

function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
function hapticHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Log temporal para debuggear la race del onEnd (bug 1). */
function logSwipeEnd(
  dy: number,
  vy: number,
  visualProgress: number,
  threshold: number,
  commit: boolean,
) {
  // eslint-disable-next-line no-console
  console.log(
    `[Swipe] dy=${dy.toFixed(0)} vy=${vy.toFixed(2)} visual=${visualProgress.toFixed(3)} thr=${threshold} commit=${commit}`,
  );
}

/* ─── Tipos públicos ─────────────────────────────────────────────── */

export interface SwipeToSubmitProps {
  /** Se llama cuando el swipe cruza el threshold y el spring termina. */
  onSubmit: () => void;
  /** Label del pill. Default: "Desliza para ejecutar". */
  label?: string;
  /** Color de fondo del pill. Default: brand green de Robinhood. */
  backgroundColor?: string;
  /** Deshabilita el gesto. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Shared value expuesto (opcional) para que el padre pueda bindear
   * estilos al progreso del swipe (ej: un fill verde que crece
   * fullscreen). Si se pasa, el componente hace `progressOut.value = ...`
   * desde el worklet sin cruzar el bridge.
   */
  progressOut?: ReturnType<typeof useSharedValue<number>>;
}

/* ─── Componente ─────────────────────────────────────────────────── */

/**
 * Pill "Desliza para ejecutar" estilo Robinhood.
 *
 * Todo el gesto y las animaciones viven en el UI thread:
 *  - Valores: `useSharedValue`.
 *  - Estilos: `useAnimatedStyle`.
 *  - Gesto: `Gesture.Pan()` con callbacks marcados `'worklet'`.
 *  - Haptics y callbacks hacia JS: `runOnJS`.
 *
 * Durante el drag el JS thread no corre nada; por eso el 60-120 fps
 * se mantiene aunque el JS esté ocupado.
 */
export function SwipeToSubmit({
  onSubmit,
  label = "Desliza para ejecutar",
  backgroundColor = "#00C805",
  disabled = false,
  style,
  progressOut,
}: SwipeToSubmitProps) {
  // progress 0..1: 0 = pill en reposo; 1 = swipe completo.
  const progress = useSharedValue(0);
  // Flag en UI thread para disparar el haptic-medium una sola vez al
  // cruzar el threshold.
  const crossedCommit = useSharedValue(false);
  // Fail-safe: garantiza que triggerSubmit se llame UNA sola vez aunque
  // haya múltiples paths que lo disparen (onEnd, spring callback,
  // useAnimatedReaction al cruzar 0.99).
  const didFire = useSharedValue(false);

  // React state sólo para DESHABILITAR el gesto después del submit.
  // No lo leemos durante el drag (leemos el sharedValue disabled si hace
  // falta, pero como rearmamos el gesture con useMemo, un cambio de
  // committed reconstruye Gesture.Pan().enabled(false) y listo).
  const [committed, setCommitted] = useState(false);

  const triggerSubmit = useCallback(() => {
    setCommitted(true);
    onSubmit();
  }, [onSubmit]);

  // Fail-safe global: si progress.value cruza 0.99 por CUALQUIER motivo
  // (onEnd completó, spring terminó, usuario llegó a 1 mid-drag), se
  // dispara triggerSubmit. El flag didFire evita el double-fire.
  useAnimatedReaction(
    () => progress.value,
    (current) => {
      "worklet";
      if (current >= 0.99 && !didFire.value) {
        didFire.value = true;
        runOnJS(triggerSubmit)();
      }
    },
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled && !committed)
        // Sólo enganchamos el gesto cuando el movimiento es claramente
        // vertical: ±10 px de "slop" horizontal. Así no peleamos con
        // scroll views o back-swipe.
        .activeOffsetY([-10, 10])
        .onBegin(() => {
          "worklet";
          runOnJS(hapticLight)();
        })
        .onChange((e) => {
          "worklet";
          const dy = -e.translationY;
          if (dy <= 0) {
            progress.value = 0;
            if (progressOut) progressOut.value = 0;
            return;
          }
          const raw = dy / SWIPE_RANGE;
          const clamped = raw < 1 ? raw : 1;
          // Damping progresivo: visual = raw * (1 - 0.3 * clamp(raw,0,1)).
          // Arranca 1:1 con el dedo, al tope el visual va al 70%.
          const damped = raw * (1 - SWIPE_DAMPING_MAX * clamped);
          const v = damped < 1 ? damped : 1;
          progress.value = v;
          if (progressOut) progressOut.value = v;

          if (v > SWIPE_COMMIT_FRACTION && !crossedCommit.value) {
            crossedCommit.value = true;
            runOnJS(hapticMedium)();
          } else if (
            v < SWIPE_COMMIT_FRACTION - 0.1 &&
            crossedCommit.value
          ) {
            crossedCommit.value = false;
          }
        })
        .onEnd((e) => {
          "worklet";
          const dy = -e.translationY;
          // velocityY viene en px/s; normalizamos a px/ms.
          const vy = -e.velocityY / 1000;
          // IMPORTANTE: leemos el VISUAL progress (damped) directo del
          // sharedValue, no lo recomputamos desde translationY. Esto cubre
          // el caso en el que la animación ya disparó y progress.value
          // está por encima de lo que daría dy/SWIPE_RANGE.
          const visualProgress = progress.value;
          const passedByPosition = visualProgress >= SWIPE_COMMIT_FRACTION;
          // Flick: velocidad alta + al menos 25% de recorrido visual.
          // Proyecta que la posición final va a cruzar el threshold.
          const passedByVelocity =
            vy > SWIPE_FLICK_VELOCITY && visualProgress >= 0.25;
          const commit = passedByPosition || passedByVelocity;

          runOnJS(logSwipeEnd)(
            dy,
            vy,
            visualProgress,
            SWIPE_COMMIT_FRACTION,
            commit,
          );

          if (commit) {
            runOnJS(hapticHeavy)();
            // Spring físico. El triggerSubmit lo dispara useAnimatedReaction
            // cuando progress.value cruza 0.99 (primary path). Mantenemos
            // también el callback del spring como segundo red de seguridad.
            progress.value = withSpring(
              1,
              { stiffness: 300, damping: 20, mass: 1 },
              (finished) => {
                "worklet";
                if (
                  !didFire.value &&
                  (finished || progress.value >= 0.99)
                ) {
                  didFire.value = true;
                  runOnJS(triggerSubmit)();
                }
              },
            );
            if (progressOut) {
              progressOut.value = withSpring(1, {
                stiffness: 300,
                damping: 20,
                mass: 1,
              });
            }
          } else {
            runOnJS(hapticLight)();
            // Regreso lento y elástico: 380 ms ease-out-cubic.
            progress.value = withTiming(0, {
              duration: 380,
              easing: Easing.out(Easing.cubic),
            });
            if (progressOut) {
              progressOut.value = withTiming(0, {
                duration: 380,
                easing: Easing.out(Easing.cubic),
              });
            }
          }
          crossedCommit.value = false;
        }),
    [
      disabled,
      committed,
      progress,
      crossedCommit,
      didFire,
      triggerSubmit,
      progressOut,
    ],
  );

  /* ─── Estilos animados (todos corren en UI thread) ─────────────── */

  // El pill "se levanta" a medida que subís: translateY negativo hasta
  // -70% del SWIPE_RANGE (por el damping). Se siente como arrastrar
  // algo pesado con un tope.
  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [0, -SWIPE_RANGE * (1 - SWIPE_DAMPING_MAX)],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // El chevron se desvanece a medida que subís (más progreso = menos
  // afordance necesario).
  const chevronStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.6],
      [1, 0.25],
      Extrapolation.CLAMP,
    ),
  }));

  /* ─── Shimmer (todo en UI thread) ──────────────────────────────── */

  // Mide el ancho del pill para calcular el recorrido del wave.
  const [pillWidth, setPillWidth] = useState(0);
  // Shared value: 0 = wave offscreen left, 1 = wave offscreen right.
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (pillWidth <= 0) return;
    // Reseteamos el valor antes de arrancar el loop para que el wave
    // siempre empiece offscreen izquierda.
    shimmer.value = 0;
    // Loop: 2200 ms moviendo + pausa de 900 ms + salto instantáneo a 0
    // (withTiming duration 0). Se repite infinito.
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: SHIMMER_SWEEP_MS,
          easing: Easing.linear,
        }),
        withDelay(SHIMMER_PAUSE_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pillWidth]);

  const gradientWidth = pillWidth * SHIMMER_WIDTH_FRACTION;

  // Wave sliding from -gradientWidth to pillWidth (offscreen to offscreen).
  const shimmerWaveStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmer.value,
          [0, 1],
          [-gradientWidth, pillWidth],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Overlay visibility: se desvanece apenas empezás a arrastrar; se
  // restaura solo cuando progress vuelve a ~0 (bounce-back). Todo en UI
  // thread: no depende de React state, reacciona inmediato.
  const shimmerOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, SHIMMER_FADE_OUT_AT],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
        style={[s.pill, { backgroundColor }, pillStyle, style]}
      >
        {/* Base: chevron + texto atenuados. Siempre visibles. */}
        <Animated.View style={chevronStyle}>
          <Feather
            name="chevron-up"
            size={14}
            color="rgba(255,255,255,0.72)"
            style={{ marginBottom: 2 }}
          />
        </Animated.View>
        <Text style={s.label}>{label}</Text>

        {/* Shimmer overlay clippeado a la FORMA del chevron+texto via
            MaskedView. El LinearGradient corre en un Animated.View que
            desliza dentro del mask; sólo se ve en los píxeles donde el
            mask element (chevron + texto en blanco) es opaco. */}
        {pillWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, shimmerOverlayStyle]}
          >
            <MaskedView
              style={StyleSheet.absoluteFill}
              maskElement={
                <View style={s.maskContainer}>
                  <Feather
                    name="chevron-up"
                    size={14}
                    color="#FFFFFF"
                    style={{ marginBottom: 2 }}
                  />
                  <Text style={s.maskLabel}>{label}</Text>
                </View>
              }
            >
              {/* Children del mask: wave deslizante con el gradiente
                  de shimmer. Sólo renderiza donde el mask es opaco
                  (letras y chevron). */}
              <Animated.View
                style={[
                  s.shimmerWave,
                  { width: gradientWidth },
                  shimmerWaveStyle,
                ]}
              >
                <LinearGradient
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  colors={SHIMMER_COLORS as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  locations={SHIMMER_LOCATIONS as any}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </MaskedView>
          </Animated.View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  pill: {
    height: PILL_HEIGHT,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    // Base atenuada para que el shimmer se note al pasar.
    color: "rgba(255,255,255,0.72)",
    letterSpacing: -0.2,
  },
  // Mask element: mismo layout que el pill, texto y chevron en blanco
  // sólido para que MaskedView deje pasar el shimmer por esa forma.
  maskContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  maskLabel: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  shimmerWave: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
});
