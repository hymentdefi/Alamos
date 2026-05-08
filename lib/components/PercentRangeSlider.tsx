import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme";

/**
 * Slider de variación porcentual desde -30% a +30%.
 *
 * El slider está pensado para ser DRIVEN por el `value` que llega de
 * afuera (controlled). Cuando el padre cambia el threshold del input
 * o tappea un chip, el `value` cambia y el thumb se anima a la nueva
 * posición. Mientras el usuario arrastra, el thumb sigue al dedo en
 * UI thread (sin re-renders del padre por frame) y dispara
 * `onChange` sólo al levantar el dedo o en cambios discretos via
 * runOnJS throttleado por step.
 *
 * El slider tiene un step efectivo de 0.5% para que el feedback
 * háptico no se sature; el render de la posición es continuo.
 *
 * Visualmente: track con gradiente sutil, marcador del 0% en el
 * centro, thumb circular con anillo de color activo. Tick marks
 * cada 10%.
 */

interface Props {
  /** Variación porcentual actual (-30..+30). El padre lo controla. */
  value: number;
  /** Llamado cuando el slider cambia el valor — durante el drag y al
   *  terminar. El padre actualiza su threshold + sincroniza el input. */
  onChange: (next: number) => void;
  /** Se dispara al levantar el dedo. Útil para haptic final. */
  onCommit?: (value: number) => void;
  /** Color del thumb + fill desde el centro hacia donde el thumb está.
   *  Default: c.brand. Cambiá según signo del value para indicar
   *  dirección (verde si arriba del 0, naranja si abajo). */
  positiveColor?: string;
  negativeColor?: string;
  /** Ancho del slider — debe coincidir con el ancho del padre. */
  width: number;
}

const RANGE = 30; // -RANGE a +RANGE
const HALF = RANGE;
const STEP = 0.5; // resolución del haptic

/* Geometría del thumb + track. */
const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;
const TRACK_RADIUS = TRACK_HEIGHT / 2;

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

  const usableWidth = width - THUMB_SIZE; // así el thumb no se va de los bordes
  const center = usableWidth / 2;

  /* Internal shared value. Drivers:
   *   - Si NO está dragging, sigue al `value` prop (mediante useEffect
   *     reactive abajo).
   *   - Si SÍ está dragging, lo manejamos en el gesto onChange. */
  const drag = useSharedValue(value);
  const dragging = useSharedValue(false);
  const lastHapticStep = useSharedValue(Math.round(value / STEP));

  /* Sincronización entrante: cuando value cambia desde afuera, animamos
   * el thumb suavemente a la nueva posición — pero sólo si no estamos
   * en medio de un drag. */
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

  /* Pan gesture sobre el track entero — el thumb sigue al dedo. */
  const pan = Gesture.Pan()
    .onBegin((e) => {
      "worklet";
      dragging.value = true;
      // Tomamos la posición x relativa al inicio del track (sin
      // offset del thumb).
      const x = Math.max(0, Math.min(usableWidth, e.x - THUMB_SIZE / 2));
      const v = (x / usableWidth - 0.5) * 2 * HALF;
      drag.value = v;
      const step = Math.round(v / STEP);
      lastHapticStep.value = step;
      runOnJS(setValueJS)(v);
    })
    .onUpdate((e) => {
      "worklet";
      const x = Math.max(0, Math.min(usableWidth, e.x - THUMB_SIZE / 2));
      const v = (x / usableWidth - 0.5) * 2 * HALF;
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

  const tap = Gesture.Tap()
    .onEnd((e) => {
      "worklet";
      const x = Math.max(0, Math.min(usableWidth, e.x - THUMB_SIZE / 2));
      const v = (x / usableWidth - 0.5) * 2 * HALF;
      drag.value = withSpring(v, { damping: 18, stiffness: 200 });
      runOnJS(setValueJS)(v);
      runOnJS(commitJS)(v);
    });

  const composed = Gesture.Simultaneous(pan, tap);

  /* Animated styles */

  const thumbStyle = useAnimatedStyle(() => {
    const x = interpolate(drag.value, [-HALF, HALF], [0, usableWidth]);
    return {
      transform: [{ translateX: x }],
    };
  });

  const fillStyle = useAnimatedStyle(() => {
    /* Fill desde el centro hacia donde está el thumb. Si v > 0, fill
     * a la derecha en color positivo. Si v < 0, fill a la izquierda
     * en color negativo. */
    const v = drag.value;
    if (v >= 0) {
      const w = (v / HALF) * (usableWidth / 2);
      return {
        left: center + THUMB_SIZE / 2,
        width: w,
        backgroundColor: pos,
      };
    } else {
      const w = (-v / HALF) * (usableWidth / 2);
      return {
        left: center + THUMB_SIZE / 2 - w,
        width: w,
        backgroundColor: neg,
      };
    }
  });

  const thumbColorStyle = useAnimatedStyle(() => {
    const v = drag.value;
    return {
      borderColor: v >= 0 ? pos : neg,
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <View style={[s.root, { width, height: THUMB_SIZE + 14 }]}>
        {/* Track base */}
        <View
          style={[
            s.track,
            {
              backgroundColor: c.surfaceHover,
              top: (THUMB_SIZE + 14 - TRACK_HEIGHT) / 2,
              left: THUMB_SIZE / 2,
              right: THUMB_SIZE / 2,
            },
          ]}
        />
        {/* Tick marks @ -30, -20, -10, 0, 10, 20, 30 */}
        {[-30, -20, -10, 0, 10, 20, 30].map((tick) => {
          const left =
            THUMB_SIZE / 2 + ((tick + HALF) / (2 * HALF)) * usableWidth;
          const isCenter = tick === 0;
          return (
            <View
              key={tick}
              style={[
                s.tick,
                {
                  left: left - 1,
                  top: (THUMB_SIZE + 14 - (isCenter ? 14 : 8)) / 2,
                  height: isCenter ? 14 : 8,
                  backgroundColor: isCenter ? c.text : c.borderStrong,
                  width: isCenter ? 2 : 1,
                },
              ]}
            />
          );
        })}
        {/* Fill animado */}
        <Animated.View
          style={[
            s.fill,
            {
              top: (THUMB_SIZE + 14 - TRACK_HEIGHT) / 2,
              borderRadius: TRACK_RADIUS,
            },
            fillStyle,
          ]}
        />
        {/* Thumb */}
        <Animated.View
          style={[
            s.thumb,
            {
              backgroundColor: c.bg,
              borderWidth: 3,
              top: 7,
            },
            thumbStyle,
            thumbColorStyle,
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
  track: {
    position: "absolute",
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
  },
  fill: {
    position: "absolute",
    height: TRACK_HEIGHT,
  },
  tick: {
    position: "absolute",
    borderRadius: 1,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderCurve: "continuous",
  },
});
