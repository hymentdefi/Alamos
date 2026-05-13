import { useEffect } from "react";
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
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { fontFamily, radius, useTheme } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

const STROKE_INK = "#0E0F0C";
const BRAND_GREEN = "#00C805";

/* Posiciones de los dots brand sobre el grid 3×4. (col, row) con col en
 * [0..2] y row en [0..3]. Distribución pensada para que se lean como
 * meses con cobros (semestral + trimestral mezclado). */
const DOT_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], // Ene
  [2, 0], // Mar
  [1, 1], // May
  [0, 2], // Jul
  [2, 2], // Sep
  [1, 3], // Nov
];

/* Geometría de la ilustración (200×200 viewBox). El "calendar card" es
 * un rounded rect con header strip arriba y grid 3×4 debajo. */
const W = 200;
const CARD_X = 22;
const CARD_Y = 28;
const CARD_W = 156;
const CARD_H = 156;
const HEADER_H = 22; // banda superior del calendar
const GRID_Y = CARD_Y + HEADER_H;
const GRID_H = CARD_H - HEADER_H;
const COL_W = CARD_W / 3;
const ROW_H = GRID_H / 4;
const DOT_R = 8;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* Cada dot vive en su propio componente para poder llamar useAnimated
 * Props sin violar rules of hooks dentro de un .map(). Animamos el
 * radio: 0 → DOT_R con spring overshoot, que da un "pop" natural. */
function AnimatedDot({
  cx,
  cy,
  scaleSV,
}: {
  cx: number;
  cy: number;
  scaleSV: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => ({
    r: DOT_R * scaleSV.value,
  }));
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill={BRAND_GREEN}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Ilustración "Calendar con pagos" — la metáfora visual de Cobros. Un
 * calendario tipo desk-pad con un header strip arriba y un grid 3×4
 * debajo. Sobre 6 cells caen dots brand (los meses con cobros), con
 * un stagger sequence que termina con un settle subtle.
 *
 * Capas animadas:
 *   1. Wrapper: scale 0.78→1 con spring overshoot, opacity 0→1.
 *   2. Header strip + grid lines: estáticos, presentes desde el frame 0.
 *   3. Dots: cada uno scale 0→1 con spring, stagger 90ms entre uno y
 *      otro. Total ~720ms para los 6 dots.
 */
function AnimatedCobrosIcon({
  size,
  play,
}: {
  size: number;
  play: boolean;
}) {
  const wrapScale = useSharedValue(0.78);
  const wrapOpacity = useSharedValue(0);
  const dotScales = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  useEffect(() => {
    cancelAnimation(wrapScale);
    cancelAnimation(wrapOpacity);
    for (const s of dotScales) cancelAnimation(s);

    if (!play) {
      wrapScale.value = 0.78;
      wrapOpacity.value = 0;
      for (const s of dotScales) s.value = 0;
      return;
    }

    wrapScale.value = withSpring(1, {
      damping: 13,
      stiffness: 150,
      mass: 0.7,
    });
    wrapOpacity.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });

    dotScales.forEach((s, i) => {
      s.value = withDelay(
        260 + i * 90,
        withSpring(1, { damping: 10, stiffness: 220, mass: 0.55 }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: wrapScale.value }],
    opacity: wrapOpacity.value,
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, wrapStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${W} ${W}`}>
        {/* Calendar card — rounded rect white con stroke ink. */}
        <Rect
          x={CARD_X}
          y={CARD_Y}
          width={CARD_W}
          height={CARD_H}
          rx={14}
          fill="#FFFFFF"
          stroke={STROKE_INK}
          strokeWidth={3}
        />
        {/* Header strip — top banda 22pt, separación horizontal con
         *  el grid. Mantiene el look "calendar" reconocible. */}
        <Path
          d={`M${CARD_X} ${GRID_Y} H${CARD_X + CARD_W}`}
          stroke={STROKE_INK}
          strokeWidth={3}
        />
        {/* Grid lines — 2 horizontales + 2 verticales que dividen
         *  el área en 12 cells (3 cols × 4 rows). Stroke fino, ink. */}
        {[1, 2, 3].map((i) => (
          <Path
            key={`h${i}`}
            d={`M${CARD_X} ${GRID_Y + i * ROW_H} H${CARD_X + CARD_W}`}
            stroke={STROKE_INK}
            strokeWidth={1.4}
            opacity={0.18}
          />
        ))}
        {[1, 2].map((i) => (
          <Path
            key={`v${i}`}
            d={`M${CARD_X + i * COL_W} ${GRID_Y} V${CARD_Y + CARD_H}`}
            stroke={STROKE_INK}
            strokeWidth={1.4}
            opacity={0.18}
          />
        ))}
        {/* Dots brand — uno por (col, row) en DOT_POSITIONS. Cada uno
         *  con su propio radio animado vía AnimatedDot. */}
        {DOT_POSITIONS.map(([col, row], i) => {
          const cx = CARD_X + col * COL_W + COL_W / 2;
          const cy = GRID_Y + row * ROW_H + ROW_H / 2;
          return (
            <AnimatedDot key={i} cx={cx} cy={cy} scaleSV={dotScales[i]} />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

/**
 * Bottom sheet "¿Qué son los cobros?". Mismo patrón que
 * BalanceInfoSheet / PygInfoSheet / EarningsInfoSheet — backdrop fade,
 * pan-to-dismiss en UI thread, ilustración hero + título + body corto.
 *
 * Voz alamos-copy: directo, "vos", sin guiones largos ni exclamaciones.
 */
export function CobrosInfoSheet({ visible, onClose }: Props) {
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
              paddingBottom: insets.bottom + 24,
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
            <View style={s.heroWrap}>
              <AnimatedCobrosIcon size={168} play={visible} />
            </View>

            <Text style={[s.title, { color: c.text }]}>
              ¿Qué son los cobros?
            </Text>

            <Text style={[s.body, { color: c.textSecondary }]}>
              Los bonos pagan{" "}
              <Text style={[s.bodyBold, { color: c.text }]}>
                cupones
              </Text>{" "}
              a fechas fijas. Las acciones y CEDEARs pagan{" "}
              <Text style={[s.bodyBold, { color: c.text }]}>
                dividendos
              </Text>{" "}
              cuando la empresa los aprueba.
              {"\n\n"}
              Acá ves cuándo y cuánto vas a cobrar este año.
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
    paddingTop: 24,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  heroWrap: {
    marginBottom: 18,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -1,
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  bodyBold: {
    fontFamily: fontFamily[700],
  },
});
