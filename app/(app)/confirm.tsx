import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme, fontFamily, radius, spacing, brand } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";
import { AmountDisplay } from "../../lib/components/AmountDisplay";
import { SwipeToSubmit } from "../../lib/components/SwipeToSubmit";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function fireSuccessHaptic() {
  Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success,
  ).catch(() => {});
}
function fireErrorHaptic() {
  Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}

type SharedValueOf<T> = { value: T };

const STRIP_HEIGHT = 72;
const CARD_RADIUS = 28;
const PHASE_SENDING_MS = 900;
const PHASE_RECEIVED_MS = 2400;
const MIN_LOADING_MS = 600;
const DONE_HOLD_MS = 1700;
const TIMEOUT_MS = 8000;
const CHECK_PATH_LEN = 24;
const SPIN_DURATION_MS = 1000;
// SVG viewBox is 100x100, radius = 44 → circumference.
const CIRC = 2 * Math.PI * 44;
// Spinner arc once the draw completes: 75° ≈ 20% of circumference.
const ARC_LEN = CIRC * (75 / 360);

// Cross-fade timings (spec C) — non-negotiable.
const OUT_DURATION = 600;
const IN_DURATION = 700;
const IN_DELAY = 100;
const GHOST_OPACITY = 0.05;
const RISE_DISTANCE = 60;
const START_SCALE = 0.82;

const outEasing = Easing.out(Easing.cubic);
const inEasing = Easing.bezier(0.16, 1, 0.3, 1);

const AVAILABLE_ARS = 1272850;

type Phase = "idle" | "sending" | "received" | "done" | "error";

export default function ConfirmScreen() {
  const { ticker, amount, mode } = useLocalSearchParams<{
    ticker: string;
    amount?: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { width: windowW, height: windowH } = useWindowDimensions();

  const asset = assets.find((a) => a.ticker === ticker);
  const isSell = mode === "sell";

  const numAmount = Number(amount) || asset?.price || 0;
  const estQty = asset ? numAmount / asset.price : 0;
  const fee = Math.round(numAmount * 0.005);
  const net = isSell ? numAmount - fee : numAmount + fee;

  // Ring sizing (spec A, updated): 28% del ancho, clamped 100-140 px.
  // Chico, elegante, discreto. NO domina la pantalla — como Robinhood.
  const ringSize = Math.min(
    140,
    Math.max(100, Math.round(windowW * 0.28)),
  );
  // Stroke fino: piso 2 px, target ~2 % del ring (≈2-2.8 px).
  const ringStrokeScreen = Math.max(
    2,
    Math.round(ringSize * 0.02 * 10) / 10,
  );
  // viewBox is 100 → convert screen-px stroke to viewBox units.
  const ringStrokeViewBox = (ringStrokeScreen / ringSize) * 100;
  // Logo inside the ring: 60 % del diámetro (fill con presencia).
  const logoInnerSize = Math.round(ringSize * 0.6);
  // Check: 55 % del ring (un toque más chico para respirar).
  const checkSize = Math.round(ringSize * 0.55);

  // Logo entrance travel: 22% of screen height (~180px on a standard iPhone).
  const entranceTravel = Math.round(windowH * 0.22);

  // ─── Shared values ─────────────────────────────────────────────
  // SwipeToSubmit writes this from its worklet (0..1) to move the green cover.
  const greenProgress = useSharedValue(0);

  // Logo entrance (spec A) — independent translate/opacity/rotate.
  const logoTranslateY = useSharedValue(entranceTravel);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(-15);
  // Logo morph to check (done phase): scale 1 → 0.7.
  const logoScale = useSharedValue(1);

  // Ring draw (spec B) + continuous spinner.
  const ringProgress = useSharedValue(0);
  const ringRotation = useSharedValue(-90);

  // Static full-circle overlay shown when arc completes at done.
  const fullCircleOpacity = useSharedValue(0);

  // Checkmark morph.
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.5);
  const checkOffset = useSharedValue(CHECK_PATH_LEN);

  // Status-text slots. Each has opacity/translateY/scale.
  // "sending" is the initial incoming text → starts in ghost state.
  const sendOpacity = useSharedValue(GHOST_OPACITY);
  const sendTranslateY = useSharedValue(80);
  const sendScale = useSharedValue(START_SCALE);
  const recvOpacity = useSharedValue(0);
  const recvTranslateY = useSharedValue(RISE_DISTANCE);
  const recvScale = useSharedValue(START_SCALE);
  const doneOpacity = useSharedValue(0);
  const doneTranslateY = useSharedValue(RISE_DISTANCE);
  const doneScale = useSharedValue(START_SCALE);
  // Error title + subtitle + "Volver" button.
  const errTitleOpacity = useSharedValue(0);
  const errTitleTranslateY = useSharedValue(RISE_DISTANCE);
  const errTitleScale = useSharedValue(START_SCALE);
  const errSubOpacity = useSharedValue(0);
  const errBtnOpacity = useSharedValue(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [spinnerRunning, setSpinnerRunning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  // Infinite spinner loop starts once the draw completes.
  useEffect(() => {
    if (!spinnerRunning) return;
    ringRotation.value = 270;
    ringRotation.value = withRepeat(
      withTiming(270 + 360, {
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinnerRunning]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /** Spec C: incoming text rises from +60 below, ghost→solid + 0.82→1 scale,
   *  700ms easeOutExpo, 100ms delay (creates ~400ms ghostly overlap with the
   *  outgoing fade). */
  const enterText = (
    op: SharedValueOf<number>,
    ty: SharedValueOf<number>,
    sc: SharedValueOf<number>,
  ) => {
    op.value = GHOST_OPACITY;
    ty.value = RISE_DISTANCE;
    sc.value = START_SCALE;
    op.value = withDelay(
      IN_DELAY,
      withTiming(1, { duration: IN_DURATION, easing: inEasing }),
    );
    ty.value = withDelay(
      IN_DELAY,
      withTiming(0, { duration: IN_DURATION, easing: inEasing }),
    );
    sc.value = withDelay(
      IN_DELAY,
      withTiming(1, { duration: IN_DURATION, easing: inEasing }),
    );
  };

  /** Spec C: outgoing text fades IN PLACE — only opacity animates, never
   *  translateY or scale. */
  const exitText = (op: SharedValueOf<number>) => {
    op.value = withTiming(0, {
      duration: OUT_DURATION,
      easing: outEasing,
    });
  };

  const runOrderFlow = async () => {
    setPhase("sending");

    // ─── t=0: Logo entrance ─ slow spring over ~700ms, ~180px visible rise.
    // (rest thresholds quedaron fuera en reanimated 4: el default threshold
    // es fino; el spring settle se calcula por mass/stiffness/damping.)
    logoTranslateY.value = withSpring(0, {
      mass: 1,
      stiffness: 55,
      damping: 12,
      overshootClamping: false,
    });
    logoOpacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    logoRotate.value = withSpring(0, {
      mass: 1,
      stiffness: 55,
      damping: 12,
    });

    // ─── t=250ms: ring draws around logo over 900ms, then becomes spinner.
    ringProgress.value = withDelay(
      250,
      withTiming(
        1,
        { duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1) },
        (finished) => {
          "worklet";
          if (finished) runOnJS(setSpinnerRunning)(true);
        },
      ),
    );
    ringRotation.value = withDelay(
      250,
      withTiming(270, {
        duration: 900,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      }),
    );

    // ─── t=500ms: "Orden Enviada..." arrives as logo is settling.
    // Starts in ghost state from useSharedValue init; animates with 700ms
    // easeOutExpo. No IN_DELAY here — the 500ms delay already covers the
    // stagger from the logo entrance.
    sendOpacity.value = withDelay(
      500,
      withTiming(1, { duration: IN_DURATION, easing: inEasing }),
    );
    sendTranslateY.value = withDelay(
      500,
      withTiming(0, { duration: IN_DURATION, easing: inEasing }),
    );
    sendScale.value = withDelay(
      500,
      withTiming(1, { duration: IN_DURATION, easing: inEasing }),
    );

    // Watchdog: if nothing confirms in 8s, fall into error state.
    timeoutRef.current = setTimeout(() => {
      if (completedRef.current) return;
      triggerError();
    }, TIMEOUT_MS);

    // Wait for the "API call" + minimum loading window.
    await Promise.all([wait(PHASE_SENDING_MS), wait(MIN_LOADING_MS)]);
    if (completedRef.current) return;

    // Phase 2: sending → received.
    setPhase("received");
    exitText(sendOpacity);
    enterText(recvOpacity, recvTranslateY, recvScale);

    await wait(PHASE_RECEIVED_MS);
    if (completedRef.current) return;

    // Phase 3: received → done + morph logo to checkmark.
    setPhase("done");
    completedRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    exitText(recvOpacity);
    enterText(doneOpacity, doneTranslateY, doneScale);

    // Arc → full static circle.
    fullCircleOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    // Logo fades out + scales down, then checkmark pops in.
    logoOpacity.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.quad),
    });
    logoScale.value = withTiming(0.7, {
      duration: 200,
      easing: Easing.in(Easing.quad),
    });

    // Check: 250ms after the logo fade begins (= ~50ms after logo is gone).
    // Spring pop with overshoot; haptic fires on the spring's rest frame.
    checkOpacity.value = withDelay(
      250,
      withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }),
    );
    checkScale.value = withDelay(
      250,
      withSpring(
        1,
        { mass: 0.8, stiffness: 220, damping: 12 },
        (finished) => {
          "worklet";
          if (finished) runOnJS(fireSuccessHaptic)();
        },
      ),
    );
    checkOffset.value = withDelay(
      280,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );

    await wait(DONE_HOLD_MS);

    router.replace({
      pathname: "/(app)/success",
      params: {
        ticker: asset?.ticker ?? "",
        amount: String(numAmount),
        qty: estQty.toFixed(4),
        mode: isSell ? "sell" : "buy",
      },
    });
  };

  const triggerError = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase("error");
    fireErrorHaptic();

    // Fade out whichever status text is currently visible.
    exitText(sendOpacity);
    exitText(recvOpacity);
    exitText(doneOpacity);

    // Incoming error title (same ghostly rise as status cross-fade).
    enterText(errTitleOpacity, errTitleTranslateY, errTitleScale);

    // Subtitle fades in after the title is mostly settled.
    errSubOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 400, easing: inEasing }),
    );

    // "Volver" button comes in last.
    errBtnOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 400, easing: inEasing }),
    );
  };

  /* ─── Animated styles ─────────────────────────────────────────── */

  // Green cover slides up as SwipeToSubmit progress advances.
  const greenCoverStyle = useAnimatedStyle(() => {
    const startY = windowH - (STRIP_HEIGHT + insets.bottom);
    return {
      transform: [
        {
          translateY: interpolate(
            greenProgress.value,
            [0, 1],
            [startY, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  // Logo wrapper: translateY (rise) + rotate (plane-in) + scale (done morph).
  const logoWrapStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { translateY: logoTranslateY.value },
      { rotate: `${logoRotate.value}deg` },
      { scale: logoScale.value },
    ],
  }));

  // Ring arc: animate ONLY strokeDashoffset (spec D — dasharray is static).
  const drawStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      ringProgress.value,
      [0, 1],
      [CIRC, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Spinner wrapper: rotates during draw + during infinite loop.
  // Hidden once fullCircleOpacity hits 1 (crossfades to static full circle).
  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
    opacity: interpolate(
      fullCircleOpacity.value,
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const fullCircleStyle = useAnimatedStyle(() => ({
    opacity: fullCircleOpacity.value,
  }));

  const checkWrapStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));
  const checkPathProps = useAnimatedProps(() => ({
    strokeDashoffset: checkOffset.value,
  }));

  const sendTextStyle = useAnimatedStyle(() => ({
    opacity: sendOpacity.value,
    transform: [
      { translateY: sendTranslateY.value },
      { scale: sendScale.value },
    ],
  }));
  const recvTextStyle = useAnimatedStyle(() => ({
    opacity: recvOpacity.value,
    transform: [
      { translateY: recvTranslateY.value },
      { scale: recvScale.value },
    ],
  }));
  const doneTextStyle = useAnimatedStyle(() => ({
    opacity: doneOpacity.value,
    transform: [
      { translateY: doneTranslateY.value },
      { scale: doneScale.value },
    ],
  }));
  const errTitleStyle = useAnimatedStyle(() => ({
    opacity: errTitleOpacity.value,
    transform: [
      { translateY: errTitleTranslateY.value },
      { scale: errTitleScale.value },
    ],
  }));
  const errSubStyle = useAnimatedStyle(() => ({
    opacity: errSubOpacity.value,
  }));
  const errBtnStyle = useAnimatedStyle(() => ({
    opacity: errBtnOpacity.value,
  }));

  if (!asset) return null;

  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: "Precio estimado", value: formatARS(asset.price) },
    { label: "Cantidad", value: `${estQty.toFixed(4)} unidades` },
    { label: "Comisión (0,5%)", value: formatARS(fee) },
    {
      label: isSell ? "Total a recibir" : "Total a pagar",
      value: formatARS(net),
      strong: true,
    },
  ];

  const statusBarStyle = phase === "idle" ? "dark" : "light";

  return (
    <View style={[s.root, { backgroundColor: brand.green }]}>
      <StatusBar style={statusBarStyle} translucent />

      {/* Card blanca con el resumen de orden — detrás del cover verde */}
      <View
        style={[
          s.card,
          {
            backgroundColor: c.bg,
            marginBottom: STRIP_HEIGHT + insets.bottom,
            borderBottomLeftRadius: CARD_RADIUS,
            borderBottomRightRadius: CARD_RADIUS,
          },
        ]}
      >
        <View style={s.content}>
          <View style={[s.header, { paddingTop: insets.top + 10 }]}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={14}
              disabled={phase !== "idle"}
              style={[s.backBtn, { backgroundColor: c.surfaceHover }]}
            >
              <Feather name="arrow-left" size={18} color={c.text} />
            </Pressable>
          </View>

          <View style={s.titleBlock}>
            <Text style={[s.title, { color: c.text }]}>
              {isSell ? "Vender" : "Comprar"} {asset.ticker}
            </Text>
          </View>

          <View style={s.amountBlock}>
            <Text style={[s.amountLabel, { color: c.textMuted }]}>
              {isSell ? "Vendés" : "Comprás"}
            </Text>
            <AmountDisplay value={numAmount} size={36} />
            <Text style={[s.available, { color: c.textMuted }]}>
              {formatARS(AVAILABLE_ARS)} disponibles para operar
            </Text>
          </View>

          <View style={[s.rows, { borderColor: c.border }]}>
            {rows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  s.row,
                  i < rows.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                  },
                ]}
              >
                <Text style={[s.rowLabel, { color: c.textMuted }]}>
                  {row.label}
                </Text>
                <Text
                  style={[
                    s.rowValue,
                    row.strong && s.rowValueStrong,
                    { color: c.text },
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={s.orderSummary}>
            <Text style={[s.summaryTitle, { color: c.text }]}>
              Resumen de orden
            </Text>
            <Text style={[s.summaryBody, { color: c.textMuted }]}>
              Estás enviando una orden a mercado para{" "}
              {isSell ? "vender" : "comprar"} {formatARS(numAmount)} de{" "}
              {asset.ticker}. La ejecución se realiza al mejor precio
              disponible.
            </Text>
          </View>
        </View>
      </View>

      {/* Green cover full-bleed */}
      <Animated.View
        pointerEvents="none"
        style={[s.greenCover, { height: windowH }, greenCoverStyle]}
      />

      {/* Swipe to submit pill anchored al bottom */}
      {phase === "idle" ? (
        <View style={[s.swipeAnchor, { paddingBottom: insets.bottom }]}>
          <SwipeToSubmit
            onSubmit={runOrderFlow}
            progressOut={greenProgress}
          />
        </View>
      ) : null}

      {/* Execution overlay: flex 1 / ring / 0.8 / text / 1.5 (spec E).
          Ring sits at ~35-40%, text at ~60-70% from top. */}
      {phase !== "idle" ? (
        <View
          pointerEvents="box-none"
          style={[
            s.execOverlay,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View style={{ flex: 1 }} />

          {/* Hero: ring + logo + checkmark, intrinsic size */}
          <View
            style={{
              width: ringSize,
              height: ringSize,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Spinning arc (active during draw + spinner loop). */}
            <Animated.View
              style={[s.absFill, s.centerContent, spinnerStyle]}
            >
              <Svg
                width={ringSize}
                height={ringSize}
                viewBox="0 0 100 100"
              >
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={ringStrokeViewBox}
                  fill="none"
                />
                <AnimatedCircle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="#FFFFFF"
                  strokeWidth={ringStrokeViewBox}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={
                    spinnerRunning
                      ? `${ARC_LEN} ${CIRC - ARC_LEN}`
                      : `${CIRC} ${CIRC}`
                  }
                  animatedProps={
                    spinnerRunning ? undefined : drawStrokeProps
                  }
                />
              </Svg>
            </Animated.View>

            {/* Static full circle shown at done (cross-fades over arc). */}
            <Animated.View
              style={[s.absFill, s.centerContent, fullCircleStyle]}
            >
              <Svg
                width={ringSize}
                height={ringSize}
                viewBox="0 0 100 100"
              >
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="#FFFFFF"
                  strokeWidth={ringStrokeViewBox}
                  fill="none"
                />
              </Svg>
            </Animated.View>

            {/* Alamos logo — rises into place, fades + scales at done. */}
            <Animated.View
              style={[s.absFill, s.centerContent, logoWrapStyle]}
            >
              <Image
                source={require("../../assets/brand-assets/empresa-mono/png/brand-mono-white-isotipo-1024.png")}
                style={{
                  width: logoInnerSize,
                  height: logoInnerSize,
                  tintColor: "#FFFFFF",
                }}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Checkmark (done). Snappy spring, stroke-draw in parallel. */}
            <Animated.View
              style={[s.absFill, s.centerContent, checkWrapStyle]}
            >
              <Svg
                width={checkSize}
                height={checkSize}
                viewBox="0 0 24 24"
              >
                <AnimatedPath
                  d="M5 12 L10 17 L19 7"
                  stroke="#FFFFFF"
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={`${CHECK_PATH_LEN} ${CHECK_PATH_LEN}`}
                  animatedProps={checkPathProps}
                />
              </Svg>
            </Animated.View>
          </View>

          {/* Spec layout: flex 0.6 gap entre el ring y el texto. */}
          <View style={{ flex: 0.6 }} />

          {/* Status-text zone. Fixed height so the 34px text has room and
              the 28px error title (potentially 2 lines) also fits. All
              slots are always mounted; animations drive visibility. */}
          <View style={s.textContainer}>
            <Animated.View style={[s.textSlot, sendTextStyle]}>
              <Text style={s.statusText}>Orden Enviada...</Text>
            </Animated.View>
            <Animated.View style={[s.textSlot, recvTextStyle]}>
              <Text style={s.statusText}>Orden Recibida...</Text>
            </Animated.View>
            <Animated.View style={[s.textSlot, doneTextStyle]}>
              <Text style={s.statusText}>Orden Ejecutada</Text>
            </Animated.View>
            <Animated.View style={[s.textSlot, errTitleStyle]}>
              <Text style={s.errorTitle}>
                No pudimos confirmar tu orden
              </Text>
            </Animated.View>
          </View>

          {/* Error subtitle (always mounted, opacity controlled). */}
          <Animated.View
            style={[s.subtitleWrap, errSubStyle]}
            pointerEvents="none"
          >
            <Text style={s.errorSubtitle}>
              Revisa el estado en tu portafolio
            </Text>
          </Animated.View>

          {/* Spec layout: flex 1.3 spacer bottom asimétrico (óptica center). */}
          <View style={{ flex: 1.3 }} />

          {/* "Volver" button — only pressable in error state. */}
          <Animated.View
            pointerEvents={phase === "error" ? "box-none" : "none"}
            style={[
              s.errorBtnWrap,
              { bottom: insets.bottom + 40 },
              errBtnStyle,
            ]}
          >
            <Pressable
              onPress={() => router.back()}
              style={s.errorBtn}
              hitSlop={12}
            >
              <Text style={s.errorBtnText}>Volver</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const s = StyleSheet.create({
  root: { flex: 1 },

  /* Card blanca */
  card: {
    flex: 1,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    marginTop: 8,
    marginBottom: 22,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 34,
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  amountBlock: {
    marginBottom: 24,
  },
  amountLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  available: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 10,
    letterSpacing: -0.1,
  },
  rows: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md + 2,
  },
  rowLabel: {
    fontFamily: fontFamily[500],
    fontSize: 15,
  },
  rowValue: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.15,
  },
  rowValueStrong: {
    fontFamily: fontFamily[700],
    fontSize: 16,
  },
  orderSummary: {
    marginTop: 24,
  },
  summaryTitle: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    marginBottom: 8,
  },
  summaryBody: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },

  /* Green cover */
  greenCover: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: brand.green,
  },

  swipeAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  /* Execution overlay — flex 1 / ring / 0.8 / text / 1.5 (spec E). */
  execOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  absFill: {
    ...StyleSheet.absoluteFillObject,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },

  /* Text zone: fixed height so the 34px line + 28px two-line error fit.
     Each slot absolutely fills the container and flex-centers its Text. */
  textContainer: {
    width: "100%",
    height: 96,
    position: "relative",
    overflow: "visible",
  },
  textSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  statusText: {
    fontFamily: fontFamily[600],
    fontSize: 34,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    textAlign: "center",
    lineHeight: 40,
  },
  errorTitle: {
    fontFamily: fontFamily[600],
    fontSize: 28,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    textAlign: "center",
    lineHeight: 34,
  },
  subtitleWrap: {
    width: "100%",
    paddingHorizontal: 32,
    marginTop: 12,
    alignItems: "center",
  },
  errorSubtitle: {
    fontFamily: fontFamily[400],
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  errorBtnWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  errorBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  errorBtnText: {
    fontFamily: fontFamily[600],
    fontSize: 17,
    color: "#FFFFFF",
  },
});
