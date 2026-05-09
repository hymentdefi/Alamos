import { useCallback } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme";

/**
 * Slider de variación porcentual desde -50 % a +50 %.
 *
 * Anatomía del track (estilo "premium", no default del sistema):
 *   - Capa 0 (base): gris suave del theme con opacity baja, sólo
 *     para que se vea la pista cuando ningún color domina.
 *   - Capa 1 (gradiente IZQ): naranja al borde izquierdo → transparente
 *     en el centro. Pintado SIEMPRE (no depende del thumb).
 *   - Capa 2 (gradiente DER): transparente en el centro → verde al
 *     borde derecho. Pintado SIEMPRE.
 *   - Marcador del 0 % en el centro: barrita vertical más oscura
 *     que el track, marca el punto de equilibrio.
 *   - Tick marks chicos cada 10 %: dots discretos.
 *
 * Anatomía del thumb:
 *   - Círculo blanco de 30 × 30 px.
 *   - Borde de 3 px coloreado según el signo del valor (verde si
 *     positivo, naranja/rojo si negativo).
 *   - Drop shadow sutil (iOS shadow + Android elevation).
 *
 * Interacción:
 *   - Pan gesture sobre toda el área del slider (track + thumb
 *     extendido vertical para que el tap target sea cómodo).
 *   - Selection haptic en cada step (cada 0.5 % de cambio) para que
 *     el usuario sienta el slider granular sin que el motor se
 *     sature.
 *   - Light impact haptic al soltar (commit).
 *   - Tap directo en el track salta el thumb a ese punto con un
 *     spring animado.
 */

interface Props {
  /** Variación porcentual actual (-30..+30). El padre lo controla. */
  value: number;
  /** Llamado durante el drag y al terminar. El padre actualiza
   *  threshold + sincroniza el input. */
  onChange: (next: number) => void;
  /** Light impact haptic + posible callback al soltar el dedo. */
  onCommit?: (value: number) => void;
  /** Color del borde del thumb del lado positivo. Default c.brand. */
  positiveColor?: string;
  /** Color del borde del thumb del lado negativo. Default c.red. */
  negativeColor?: string;
  /** Ancho total del slider. */
  width: number;
}

const RANGE = 50;
const HALF = RANGE;
const STEP = 0.5;

/* Curva logarítmica: ±10 % cae al ~65 % del ancho del slider. Los
 * extremos se comprimen hacia ±50 %, así no perdemos precisión en
 * el rango útil donde está el 80 % de los usuarios.
 *
 *   v = sign(t) · |t|^CURVE · HALF       (forward, position → value)
 *   t = sign(v) · (|v| / HALF)^(1/CURVE) (inverse, value → position)
 *
 * Con CURVE = 3.5 → (0.2)^(1/3.5) ≈ 0.63, o sea ±10 a ~63 % del ancho.
 * Si subís el exponente, comprimís más los extremos; si lo bajás,
 * acercás la curva a lineal. */
const CURVE = 3.5;

/* Helpers de la curva — anotadas como worklets porque se llaman
 * tanto en el JS thread (memo, render de ticks) como en el UI thread
 * (gesto del slider, useAnimatedStyle del thumb). */
function valueToFraction(v: number): number {
  "worklet";
  if (v === 0) return 0;
  const abs = Math.min(HALF, Math.abs(v));
  return Math.sign(v) * Math.pow(abs / HALF, 1 / CURVE);
}

function fractionToValue(t: number): number {
  "worklet";
  if (t === 0) return 0;
  const abs = Math.min(1, Math.abs(t));
  return Math.sign(t) * Math.pow(abs, CURVE) * HALF;
}

const THUMB_SIZE = 30;
const TRACK_HEIGHT = 8;
const TRACK_RADIUS = TRACK_HEIGHT / 2;
const SLIDER_HEIGHT = THUMB_SIZE + 18;

export function PercentRangeSlider({
  value,
  onChange,
  onCommit,
  positiveColor,
  negativeColor,
  width,
}: Props) {
  const { c } = useTheme();
  const pos = positiveColor ?? c.brand;
  const neg = negativeColor ?? c.red;

  const usableWidth = width - THUMB_SIZE;
  const halfTrack = usableWidth / 2;
  const centerX = THUMB_SIZE / 2 + halfTrack;

  /* Internal shared value seguido por el thumb. */
  const drag = useSharedValue(value);
  const dragging = useSharedValue(false);
  const lastHapticStep = useSharedValue(Math.round(value / STEP));

  /* Cuando value cambia desde afuera, animamos el thumb a la nueva
   * posición — pero sólo si NO estamos en medio de un drag. */
  useAnimatedReaction(
    () => value,
    (cur, prev) => {
      "worklet";
      if (dragging.value) return;
      if (cur === prev) return;
      drag.value = withTiming(cur, { duration: 220 });
    },
    [value],
  );

  const setValueJS = useCallback(
    (v: number) => {
      onChange(Math.max(-HALF, Math.min(HALF, v)));
    },
    [onChange],
  );

  const commitJS = useCallback(
    (v: number) => {
      const clamped = Math.max(-HALF, Math.min(HALF, v));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onCommit?.(clamped);
    },
    [onCommit],
  );

  const stepHapticJS = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const pan = Gesture.Pan()
    .onBegin((e) => {
      "worklet";
      dragging.value = true;
      const x = Math.max(0, Math.min(usableWidth, e.x - THUMB_SIZE / 2));
      // Posición normalizada en [-1, 1] → valor con curva log.
      const t = (x / usableWidth - 0.5) * 2;
      const v = fractionToValue(t);
      drag.value = v;
      const step = Math.round(v / STEP);
      lastHapticStep.value = step;
      runOnJS(setValueJS)(v);
    })
    .onUpdate((e) => {
      "worklet";
      const x = Math.max(0, Math.min(usableWidth, e.x - THUMB_SIZE / 2));
      const t = (x / usableWidth - 0.5) * 2;
      const v = fractionToValue(t);
      drag.value = v;
      const step = Math.round(v / STEP);
      if (step !== lastHapticStep.value) {
        lastHapticStep.value = step;
        runOnJS(stepHapticJS)();
      }
      runOnJS(setValueJS)(v);
    })
    .onEnd(() => {
      "worklet";
      dragging.value = false;
      runOnJS(commitJS)(drag.value);
    })
    .onFinalize(() => {
      "worklet";
      dragging.value = false;
    });

  const tap = Gesture.Tap().onEnd((e) => {
    "worklet";
    const x = Math.max(0, Math.min(usableWidth, e.x - THUMB_SIZE / 2));
    const t = (x / usableWidth - 0.5) * 2;
    const v = fractionToValue(t);
    drag.value = withSpring(v, { damping: 18, stiffness: 200 });
    runOnJS(setValueJS)(v);
    runOnJS(commitJS)(v);
  });

  const composed = Gesture.Simultaneous(pan, tap);

  /* Animated styles */

  /* Thumb sigue al value vía la inversa de la curva — al value=0 le
   * corresponde el centro, al ±10 % le corresponde ~65 % del ancho,
   * al ±50 % los extremos. Usamos valueToFraction (worklet) y mapeo
   * lineal después para convertir a px. */
  const thumbStyle = useAnimatedStyle(() => {
    const t = valueToFraction(drag.value);
    const x = ((t + 1) / 2) * usableWidth;
    return {
      transform: [
        { translateX: x },
        { scale: dragging.value ? 1.08 : 1 },
      ],
    };
  });

  const thumbBorderStyle = useAnimatedStyle(() => {
    const v = drag.value;
    return {
      borderColor: v >= 0 ? pos : neg,
    };
  });

  /* Tick marks @ ±10/±25/±40 — dots discretos sobre el track. El 0
   * tiene su propio marker (más prominente). */
  const tickPositions = [-40, -25, -10, 10, 25, 40];

  return (
    <GestureDetector gesture={composed}>
      <View
        style={[s.root, { width, height: SLIDER_HEIGHT }]}
        accessibilityRole="adjustable"
      >
        {/* Capa 0: base muted del track */}
        <View
          style={[
            s.trackBase,
            {
              backgroundColor: c.surfaceSunken,
              top: (SLIDER_HEIGHT - TRACK_HEIGHT) / 2,
              left: THUMB_SIZE / 2,
              right: THUMB_SIZE / 2,
            },
          ]}
        />

        {/* Capa 1: gradiente IZQUIERDA — naranja → transparente */}
        <View
          style={[
            s.gradWrap,
            {
              top: (SLIDER_HEIGHT - TRACK_HEIGHT) / 2,
              left: THUMB_SIZE / 2,
              width: halfTrack,
              borderTopLeftRadius: TRACK_RADIUS,
              borderBottomLeftRadius: TRACK_RADIUS,
            },
          ]}
        >
          <LinearGradient
            colors={[neg, neg + "00"] as [string, string]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={s.gradFill}
          />
        </View>

        {/* Capa 2: gradiente DERECHA — transparente → verde */}
        <View
          style={[
            s.gradWrap,
            {
              top: (SLIDER_HEIGHT - TRACK_HEIGHT) / 2,
              left: centerX,
              width: halfTrack,
              borderTopRightRadius: TRACK_RADIUS,
              borderBottomRightRadius: TRACK_RADIUS,
            },
          ]}
        >
          <LinearGradient
            colors={[pos + "00", pos] as [string, string]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={s.gradFill}
          />
        </View>

        {/* Marcador del 0 % en el centro */}
        <View
          style={[
            s.centerMark,
            {
              left: centerX - 1,
              top: (SLIDER_HEIGHT - 14) / 2,
              backgroundColor: c.text,
            },
          ]}
        />

        {/* Tick marks chicos a ±10/±25/±40. Posición usa la inversa
         *  de la curva para que se acomoden donde realmente caen
         *  (sino los ticks de ±10 quedarían a 20 % del ancho cuando
         *  visualmente están a ~65 %). */}
        {tickPositions.map((tick) => {
          const t = valueToFraction(tick);
          const left = THUMB_SIZE / 2 + ((t + 1) / 2) * usableWidth;
          return (
            <View
              key={tick}
              style={[
                s.tickDot,
                {
                  left: left - 1.5,
                  top: SLIDER_HEIGHT / 2 - 1.5,
                  backgroundColor: c.borderStrong,
                },
              ]}
            />
          );
        })}

        {/* Thumb */}
        <Animated.View
          style={[
            s.thumb,
            {
              backgroundColor: c.bg,
              top: (SLIDER_HEIGHT - THUMB_SIZE) / 2,
            },
            thumbStyle,
            thumbBorderStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  root: {
    position: "relative",
    justifyContent: "center",
  },
  trackBase: {
    position: "absolute",
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
  },
  gradWrap: {
    position: "absolute",
    height: TRACK_HEIGHT,
    overflow: "hidden",
  },
  gradFill: {
    flex: 1,
  },
  centerMark: {
    position: "absolute",
    width: 2,
    height: 14,
    borderRadius: 1,
    opacity: 0.55,
  },
  tickDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderCurve: "continuous",
    borderWidth: 3,
    /* Drop shadow para sensación de elevación premium. */
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});
