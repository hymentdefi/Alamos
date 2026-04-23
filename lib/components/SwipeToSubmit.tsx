import { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
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

  // React state sólo para DESHABILITAR el gesto después del submit.
  // No lo leemos durante el drag (leemos el sharedValue disabled si hace
  // falta, pero como rearmamos el gesture con useMemo, un cambio de
  // committed reconstruye Gesture.Pan().enabled(false) y listo).
  const [committed, setCommitted] = useState(false);

  const triggerSubmit = useCallback(() => {
    setCommitted(true);
    onSubmit();
  }, [onSubmit]);

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
          const rawProgress = dy / SWIPE_RANGE;
          const passedThreshold = rawProgress >= SWIPE_COMMIT_FRACTION;
          const validFlick =
            vy > SWIPE_FLICK_VELOCITY &&
            rawProgress > SWIPE_FLICK_MIN_FRACTION;

          if (passedThreshold || validFlick) {
            runOnJS(hapticHeavy)();
            // Spring físico: stiffness 300, damping 20, mass 1.
            // Trae el micro-bounce al tope.
            progress.value = withSpring(
              1,
              { stiffness: 300, damping: 20, mass: 1 },
              (finished) => {
                "worklet";
                if (finished) runOnJS(triggerSubmit)();
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

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[s.pill, { backgroundColor }, pillStyle, style]}
      >
        <Animated.View style={chevronStyle}>
          <Feather
            name="chevron-up"
            size={14}
            color="rgba(255,255,255,0.85)"
            style={{ marginBottom: 2 }}
          />
        </Animated.View>
        <Text style={s.label}>{label}</Text>
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
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
});
