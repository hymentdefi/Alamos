import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { fontFamily, radius, useTheme } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

const STROKE_INK = "#0E4310";
const FILL_GREEN = "#5FE850";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/* Largo aproximado de cada flecha (path con 4 puntos). Lo usamos para
 * dash-offset drawing. */
const ARROW_LEN = 70;

/**
 * Ilustración "PyG" animada — Robinhood-style entry.
 *
 *  Layers animados:
 *    1. Wrapper: scale 0.7→1.0 con spring overshoot, opacity 0→1.
 *    2. Green top half: scaleY 0→1 desde el TOP de la mitad (fill-down).
 *    3. Up arrow: stroke-dash drawing (path se "dibuja" de abajo
 *       hacia arriba) + translateY 8→0 con spring.
 *    4. Down arrow: stroke-dash drawing + translateY -8→0 con spring.
 *
 *  Loop idle (post-entrada):
 *    - Up arrow: translateY 0 ↔ -3, 1700ms in/out, infinite.
 *    - Down arrow: translateY 0 ↔ +3, 1700ms in/out, infinite (en
 *      contra-fase con el up — uno sube cuando el otro baja).
 *
 *  La animación arranca cuando `play` pasa a true (cuando el sheet se
 *  hace visible). Cancelamos todo en cleanup para que la próxima
 *  apertura re-corra la secuencia desde cero.
 */
function AnimatedPygIcon({
  size,
  play,
}: {
  size: number;
  play: boolean;
}) {
  const W = 200;
  const ICON_X = 22;
  const ICON_Y = 22;
  const ICON_W = 156;
  const ICON_H = 156;
  const HALF_H = 74;

  // Wrapper scale + opacity.
  const wrapScale = useSharedValue(0.7);
  const wrapOpacity = useSharedValue(0);
  // Green top half scaleY desde el top.
  const greenScaleY = useSharedValue(0);
  // Up/down arrow stroke-dash offset (path "draws in") + translateY.
  const upDash = useSharedValue(ARROW_LEN);
  const downDash = useSharedValue(ARROW_LEN);
  const upTY = useSharedValue(8);
  const downTY = useSharedValue(-8);
  // Idle breathing.
  const upBreath = useSharedValue(0);
  const downBreath = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(wrapScale);
    cancelAnimation(wrapOpacity);
    cancelAnimation(greenScaleY);
    cancelAnimation(upDash);
    cancelAnimation(downDash);
    cancelAnimation(upTY);
    cancelAnimation(downTY);
    cancelAnimation(upBreath);
    cancelAnimation(downBreath);

    if (!play) {
      // Reset al estado inicial cuando el sheet se cierra — la próxima
      // apertura arranca la secuencia fresh.
      wrapScale.value = 0.7;
      wrapOpacity.value = 0;
      greenScaleY.value = 0;
      upDash.value = ARROW_LEN;
      downDash.value = ARROW_LEN;
      upTY.value = 8;
      downTY.value = -8;
      upBreath.value = 0;
      downBreath.value = 0;
      return;
    }

    // 1. Wrapper aparece con spring + fade.
    wrapScale.value = withSpring(1, {
      damping: 12,
      stiffness: 140,
      mass: 0.7,
    });
    wrapOpacity.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });

    // 2. Green half fill-down después de 220 ms.
    greenScaleY.value = withDelay(
      220,
      withTiming(1, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
      }),
    );

    // 3. Up arrow draws + bounces in.
    upDash.value = withDelay(
      440,
      withTiming(0, {
        duration: 380,
        easing: Easing.out(Easing.cubic),
      }),
    );
    upTY.value = withDelay(
      440,
      withSpring(0, { damping: 9, stiffness: 200, mass: 0.6 }),
    );

    // 4. Down arrow stagger.
    downDash.value = withDelay(
      560,
      withTiming(0, {
        duration: 380,
        easing: Easing.out(Easing.cubic),
      }),
    );
    downTY.value = withDelay(
      560,
      withSpring(0, { damping: 9, stiffness: 200, mass: 0.6 }),
    );

    // 5. Idle breathing — arranca cuando ya entraron las flechas
    //    (~1100 ms total). Up sube y down baja en contra-fase para
    //    sugerir "el mercado se mueve".
    const breath = (v: typeof upBreath, sign: 1 | -1, delay: number) => {
      v.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(sign * 3, {
              duration: 1700,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(0, {
              duration: 1700,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          -1,
          false,
        ),
      );
    };
    breath(upBreath, -1, 1100);
    breath(downBreath, 1, 1800);
  }, [
    play,
    wrapScale,
    wrapOpacity,
    greenScaleY,
    upDash,
    downDash,
    upTY,
    downTY,
    upBreath,
    downBreath,
  ]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wrapScale.value }],
    opacity: wrapOpacity.value,
  }));

  // El rect verde scale-down desde el top: transform-origin top-left vía
  // shrink del HEIGHT del rect (no scaleY, así no necesitamos un
  // transform-origin manual). animatedProps actualiza `height` directo.
  const greenAnimProps = useAnimatedProps(() => ({
    height: HALF_H * greenScaleY.value,
  }));

  const upArrowProps = useAnimatedProps(() => ({
    strokeDashoffset: upDash.value,
  }));
  const upArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: upTY.value + upBreath.value }],
  }));
  const downArrowProps = useAnimatedProps(() => ({
    strokeDashoffset: downDash.value,
  }));
  const downArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: downTY.value + downBreath.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, wrapStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${W} ${W}`}>
        {/* Outer card — white con border ink. */}
        <Rect
          x={ICON_X}
          y={ICON_Y}
          width={ICON_W}
          height={ICON_H}
          rx={14}
          fill="#FFFFFF"
          stroke={STROKE_INK}
          strokeWidth={3}
        />
        {/* Mitad superior verde — animada por height (efecto fill-down
         *  desde el top edge del card). */}
        <AnimatedRect
          x={ICON_X}
          y={ICON_Y}
          width={ICON_W}
          rx={14}
          fill={FILL_GREEN}
          stroke={STROKE_INK}
          strokeWidth={3}
          animatedProps={greenAnimProps}
        />
        {/* Divisoria horizontal estática — siempre visible para
         *  dar la sensación de "ya hay un container" antes de que
         *  el verde lo rellene. */}
        <Path
          d="M22 96 H178"
          stroke={STROKE_INK}
          strokeWidth={3}
        />
      </Svg>
      {/* Up + down arrows en SVG separado, en absolute, para poder
       *  aplicar translateY animado por View sin que afecte al card.
       *  Cada flecha vive en su propio SVG superpuesto. */}
      <Animated.View style={[StyleSheet.absoluteFill, upArrowStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${W} ${W}`}>
          <AnimatedPath
            d="M70 70 L88 50 L106 70 M88 50 V82"
            stroke={STROKE_INK}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={ARROW_LEN}
            animatedProps={upArrowProps}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, downArrowStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${W} ${W}`}>
          <AnimatedPath
            d="M70 130 L88 150 L106 130 M88 150 V118"
            stroke={STROKE_INK}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={ARROW_LEN}
            animatedProps={downArrowProps}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Título con efecto typewriter — caracteres aparecen uno a uno desde
 * la izquierda. Layout center-anchored vía width:100% + textAlign
 * center (la grilla NO se expande con cada char nuevo, el texto
 * crece "desde el centro hacia los costados" naturalmente porque RN
 * Text con textAlign center lo hace así).
 *
 *  - Delay inicial 220 ms para que arranque cuando la pop scale del
 *    icon hero ya entró visualmente y el sheet terminó su translateY.
 *  - 36 ms por caracter — ~430 ms total para "¿Qué es PyG?" (12 ch).
 *  - Caret "|" blink durante el typing, fade-out al terminar.
 *  - Reset a string vacío cuando el sheet se cierra para que la
 *    próxima apertura re-corra la animación fresh.
 */
function TypewriterTitle({
  play,
  color,
  fullText,
}: {
  play: boolean;
  color: string;
  fullText: string;
}) {
  const [chars, setChars] = useState(0);
  const caretOpacity = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(caretOpacity);

    if (!play) {
      setChars(0);
      caretOpacity.value = 0;
      return;
    }

    setChars(0);

    // Caret blink mientras el sheet abre (incluye el delay del typing).
    caretOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 360, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.15, { duration: 360, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      let i = 0;
      intervalId = setInterval(() => {
        i += 1;
        setChars(i);
        if (i >= fullText.length) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          // Después de un beat, apagamos el caret con un fade.
          setTimeout(() => {
            caretOpacity.value = withTiming(0, { duration: 240 });
          }, 480);
        }
      }, 36);
    }, 220);

    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [play, fullText, caretOpacity]);

  const caretAnimStyle = useAnimatedStyle(() => ({
    opacity: caretOpacity.value,
  }));

  return (
    <View style={s.titleRow}>
      <Text style={[s.title, { color }]} numberOfLines={1}>
        {fullText.slice(0, chars)}
      </Text>
      <Animated.Text
        style={[s.titleCaret, { color }, caretAnimStyle]}
      >
        |
      </Animated.Text>
    </View>
  );
}

/**
 * Bottom sheet "¿Qué es PyG?". Patrón de presentación equivalente a
 * MarketClosedSheet / EarningsInfoSheet / ChartSettingsSheet. Hero:
 * ícono PyG animado + título + body. Sin notas, sin disclaimers.
 */
export function PygInfoSheet({ visible, onClose }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();

  const translateY = useSharedValue(windowH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    translateY.value = withTiming(
      windowH,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) runOnJS(onClose)();
      },
    );
    backdropOpacity.value = withTiming(0, { duration: 240 });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = Math.max(
          0,
          1 - e.translationY / windowH,
        );
      }
    })
    .onEnd((e) => {
      "worklet";
      const shouldDismiss =
        e.translationY > DISMISS_TRANSLATE ||
        e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(
          windowH,
          { duration: 240, easing: Easing.in(Easing.cubic) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(onClose)();
          },
        );
        backdropOpacity.value = withTiming(0, { duration: 240 });
      } else {
        translateY.value = withTiming(0, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
        backdropOpacity.value = withTiming(1, { duration: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: c.bg,
              borderColor: c.border,
              paddingBottom: insets.bottom + 32,
            },
            sheetStyle,
          ]}
        >
          <View style={s.grabber}>
            <View
              style={[s.grabberPill, { backgroundColor: c.borderStrong }]}
            />
          </View>

          <View style={s.content}>
            <View style={s.illustrationWrap}>
              <AnimatedPygIcon size={168} play={visible} />
            </View>

            <TypewriterTitle
              play={visible}
              color={c.text}
              fullText="¿Qué es PyG?"
            />


            <Text style={[s.body, { color: c.textMuted }]}>
              Es tu{" "}
              <Text style={[s.bodyBold, { color: c.text }]}>
                Pérdida y Ganancia
              </Text>{" "}
              del día. Te muestra cuánto subió o bajó el valor total
              de tus posiciones desde la apertura, en monto y en
              porcentaje.
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    alignItems: "center",
    paddingVertical: 8,
  },
  grabberPill: {
    width: 40,
    height: 4,
    borderCurve: "continuous",
    borderRadius: 2,
  },
  content: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  illustrationWrap: {
    marginBottom: 22,
  },
  /* Title row — wrapper para que el caret quede inline con el texto
   * typed sin afectar la métrica vertical del título. justifyContent
   * center mantiene la composición center-aligned aunque el texto sea
   * parcial (mid-typing). */
  titleRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
    marginBottom: 12,
    minHeight: 34,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 28,
    letterSpacing: -1.1,
    textAlign: "center",
  },
  /* Caret "|" del typewriter — mismo tipográfica + size que el title
   * para que blendee. marginLeft chico para separarlo del último char
   * sin colisionar con el descender de la "?". */
  titleCaret: {
    fontFamily: fontFamily[800],
    fontSize: 28,
    letterSpacing: -1.1,
    marginLeft: 2,
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.2,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  bodyBold: {
    fontFamily: fontFamily[700],
  },
});
