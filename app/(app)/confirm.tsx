import { useEffect, useState } from "react";
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

/** Helper para el único haptic .success de la pantalla, al aparecer el
 * checkmark. Total de haptics en el flow = 2 (el del SwipeToSubmit al
 * completar + este). */
function fireSuccessHaptic() {
  Haptics.notificationAsync(
    Haptics.NotificationFeedbackType.Success,
  ).catch(() => {});
}

/** Alias para tipado corto en el helper crossfadeText. */
type SharedValueOf<T> = { value: T };

/** Alto visible de la franja verde (pill del SwipeToSubmit) en reposo. */
const STRIP_HEIGHT = 72;
/** Radio inferior de la card blanca. */
const CARD_RADIUS = 28;
/** "Orden Enviada..." — corto, sólo confirma que salió. */
const PHASE_SENDING_MS = 900;
/** "Orden Recibida..." — queda un buen tiempo. */
const PHASE_RECEIVED_MS = 2400;
/** Mínimo absoluto de loading antes de mostrar success. */
const MIN_LOADING_MS = 600;
/** Hold del estado "Orden Ejecutada" con el checkmark antes de navegar. */
const DONE_HOLD_MS = 1700;
/** Longitud del path del checkmark (viewBox 0 0 24 24). */
const CHECK_PATH_LEN = 24;
/** Fracción del ancho de pantalla que ocupa el ring. */
const RING_DIAMETER_FRACTION = 0.27;
/** Stroke width como fracción del diámetro del ring. */
const RING_STROKE_FRACTION = 0.028;
/** Duración del loop de rotación del spinner (ms). */
const SPIN_DURATION_MS = 1000;
/** Circunferencia en unidades del viewBox (r=44). */
const CIRC = 2 * Math.PI * 44;
/** Arco visible del spinner: 75° ≈ 20% de la circunferencia. */
const ARC_LEN = CIRC * (75 / 360);

const AVAILABLE_ARS = 1272850;

type Phase = "idle" | "sending" | "received" | "done";

export default function ConfirmScreen() {
  const { ticker, amount, mode } = useLocalSearchParams<{
    ticker: string;
    amount?: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { width: windowW } = useWindowDimensions();

  const asset = assets.find((a) => a.ticker === ticker);
  const isSell = mode === "sell";

  const numAmount = Number(amount) || asset?.price || 0;
  const estQty = asset ? numAmount / asset.price : 0;
  const fee = Math.round(numAmount * 0.005);
  const net = isSell ? numAmount - fee : numAmount + fee;

  // Ring sizing basado en el viewport actual (no Dimensions.get).
  const ringSize = Math.round(windowW * RING_DIAMETER_FRACTION);
  // Stroke: target fijo 2.5 px en pantalla (spec), pero con floor para
  // que en phones muy chiquitos no se vea demasiado fino.
  const ringStrokeScreen = Math.max(
    2.5,
    Math.round(ringSize * RING_STROKE_FRACTION * 10) / 10,
  );
  // Stroke en unidades del viewBox 100. El viewBox escala a ringSize px.
  const ringStrokeViewBox = (ringStrokeScreen / ringSize) * 100;
  const logoInnerSize = Math.round(ringSize * 0.58);
  const checkSize = Math.round(ringSize * 0.56);

  // ─── Shared values (todos viven en UI thread) ───
  // Progreso del swipe (0..1). Lo escribe SwipeToSubmit desde su worklet.
  const greenProgress = useSharedValue(0);

  // Entry staggered del overlay.
  // t=0ms: logo cae + rota.
  const logoEntry = useSharedValue(0);
  // t=250ms: el circle se dibuja (strokeDashoffset CIRC→0) y el wrapper
  // rota -90→270 simultáneamente.
  const circleDraw = useSharedValue(0);
  // t=350ms: el texto entra con z-depth.
  const textEntry = useSharedValue(0);

  // Rotación continua del spinner (se enciende cuando el draw termina).
  const spinDeg = useSharedValue(-90);

  // Opacidades/escalas/Y de cada texto (stacked, no condicionales).
  // Iniciales: scale 0.82 + translateY +12 (entra desde atrás y abajo).
  const txSendingOpacity = useSharedValue(0);
  const txSendingScale = useSharedValue(0.82);
  const txSendingY = useSharedValue(12);
  const txReceivedOpacity = useSharedValue(0);
  const txReceivedScale = useSharedValue(0.82);
  const txReceivedY = useSharedValue(12);
  const txDoneOpacity = useSharedValue(0);
  const txDoneScale = useSharedValue(0.82);
  const txDoneY = useSharedValue(12);

  // Morph logo→check.
  const logoOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.5);
  const checkOffset = useSharedValue(CHECK_PATH_LEN);

  // Cross-fade del arc al full-circle (estático) cuando se confirma.
  const fullCircleOpacity = useSharedValue(0);

  const [phase, setPhase] = useState<Phase>("idle");
  // Flag UI-thread: cuando el draw termina, arrancamos el spinner loop.
  const [spinnerRunning, setSpinnerRunning] = useState(false);

  // El loop del spinner arranca cuando circleDraw terminó. Arrancamos
  // desde 270° (= donde quedó el wrapper al final del orbit draw) para
  // continuidad visual sin saltos. Loop infinito lineal a 1000 ms.
  useEffect(() => {
    if (!spinnerRunning) return;
    spinDeg.value = 270;
    spinDeg.value = withRepeat(
      withTiming(270 + 360, {
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinnerRunning]);

  /** Cross-fade de textos estilo Robinhood:
   *   – SALIENTE se desvanece EN SU LUGAR: opacity 1→0 + scale 1→0.95,
   *     sin translateY. 250 ms ease-in.
   *   – ENTRANTE viene desde abajo con recorrido largo: translateY +60→0
   *     + scale 0.82→1 + opacity 0→1. 500 ms ease-out-expo.
   *   Los dos arrancan simultáneamente; el frame donde se superponen es
   *   lo que da el "aura". */
  const crossfadeText = (
    fromOpacity: SharedValueOf<number>,
    fromScale: SharedValueOf<number>,
    _fromY: SharedValueOf<number>,
    toOpacity: SharedValueOf<number>,
    toScale: SharedValueOf<number>,
    toY: SharedValueOf<number>,
  ) => {
    // Saliente: no se mueve, sólo fade + scale down sutil.
    fromOpacity.value = withTiming(0, {
      duration: 250,
      easing: Easing.in(Easing.quad),
    });
    fromScale.value = withTiming(0.95, {
      duration: 250,
      easing: Easing.in(Easing.quad),
    });
    // Entrante: valores iniciales explícitos (por si quedó con otros
    // valores de un crossfade anterior), y luego animaciones largas.
    toScale.value = 0.82;
    toY.value = 60;
    toOpacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    toScale.value = withTiming(1, {
      duration: 500,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    toY.value = withTiming(0, {
      duration: 500,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  };

  const runOrderFlow = async () => {
    setPhase("sending");

    // ─── Entry staggered (secuencia ~1.7 s) ────────────────────────
    // t=0: logo con spring lento. Viene desde MUY abajo (+120 px) para
    // que el recorrido sea visible, no un pop.
    logoEntry.value = withSpring(1, {
      mass: 1,
      stiffness: 120,
      damping: 14,
    });
    // t=300: círculo se dibuja (strokeDashoffset) + orbit rotation.
    // Duración 1100 ms ease-out-quint.
    circleDraw.value = withDelay(
      300,
      withTiming(
        1,
        { duration: 1100, easing: Easing.bezier(0.22, 1, 0.36, 1) },
        (finished) => {
          "worklet";
          if (finished) {
            runOnJS(setSpinnerRunning)(true);
          }
        },
      ),
    );
    // t=600: texto "Orden Enviada..." entra desde MUY abajo (+80 px)
    // con z-depth (scale 0.82 → 1.0) en 500 ms ease-out-expo. Recorrido
    // visible, no pop.
    txSendingScale.value = 0.82;
    txSendingY.value = 80;
    txSendingOpacity.value = withDelay(
      600,
      withTiming(1, {
        duration: 500,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );
    txSendingScale.value = withDelay(
      600,
      withTiming(1, {
        duration: 500,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );
    txSendingY.value = withDelay(
      600,
      withTiming(0, {
        duration: 500,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
    );

    // Mínimo 600 ms de loading incluso si el "API" respondiera instantáneo.
    const apiCall = wait(PHASE_SENDING_MS);
    const minLoading = wait(MIN_LOADING_MS);
    await Promise.all([apiCall, minLoading]);

    // Fase 2: cross-fade "Enviada" → "Recibida" con escala.
    setPhase("received");
    crossfadeText(
      txSendingOpacity,
      txSendingScale,
      txSendingY,
      txReceivedOpacity,
      txReceivedScale,
      txReceivedY,
    );

    await wait(PHASE_RECEIVED_MS);

    // Fase 3: cross-fade a "Ejecutada" + morph logo→check.
    setPhase("done");
    crossfadeText(
      txReceivedOpacity,
      txReceivedScale,
      txReceivedY,
      txDoneOpacity,
      txDoneScale,
      txDoneY,
    );

    // Spinner arc → full circle estático.
    fullCircleOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });

    // Logo: fade-out + scale down 200 ms ease-in.
    logoOpacity.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.quad),
    });
    logoScale.value = withTiming(0.7, {
      duration: 200,
      easing: Easing.in(Easing.quad),
    });

    // Check: 50 ms delay, luego pop con spring (overshoot controlado).
    // En el callback del spring firamos el único haptic de success.
    checkScale.value = 0.5;
    checkOpacity.value = withDelay(
      50,
      withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
    );
    checkScale.value = withDelay(
      50,
      withSpring(
        1,
        { mass: 0.8, stiffness: 220, damping: 12 },
        (finished) => {
          "worklet";
          if (finished) runOnJS(fireSuccessHaptic)();
        },
      ),
    );
    // Stroke-draw del check en paralelo al pop.
    checkOffset.value = withDelay(
      80,
      withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }),
    );

    // Hold 1.7 s sobre el estado success.
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

  /* ─── Estilos animados (todos UI thread) ─────────────────────── */

  // Cover verde fullscreen: translateY desde (screenH - strip - safe)
  // hasta 0, bindeado directamente a greenProgress (que SwipeToSubmit
  // escribe desde su worklet).
  const { height: windowH } = useWindowDimensions();
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

  // ── Entry: logo "planea" desde muy abajo con rotate + scale ──
  // translateY +120 → 0 (recorrido largo, visible). Rotate -15° → 0.
  const logoEntryStyle = useAnimatedStyle(() => ({
    opacity: logoEntry.value,
    transform: [
      {
        scale: interpolate(
          logoEntry.value,
          [0, 1],
          [0.6, 1],
          Extrapolation.CLAMP,
        ),
      },
      {
        rotate: `${interpolate(logoEntry.value, [0, 1], [-15, 0], Extrapolation.CLAMP)}deg`,
      },
      {
        translateY: interpolate(
          logoEntry.value,
          [0, 1],
          [120, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // ── Circle draw: strokeDashoffset + orbit rotation (-90→270). ──
  // Mientras se dibuja, el wrapper rota; cuando termina, spinnerRunning
  // pasa a true y `spinDeg` toma el control del loop.
  const drawStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      circleDraw.value,
      [0, 1],
      [CIRC, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Rotación del wrapper SVG: -90 al inicio (para empezar el stroke en
  // las 12), luego o bien (a) orbit rotation durante el draw, o (b) el
  // loop infinito del spinDeg. Priorizamos spinDeg cuando está corriendo.
  const spinnerStyle = useAnimatedStyle(() => {
    const baseRot = spinnerRunning
      ? spinDeg.value
      : interpolate(
          circleDraw.value,
          [0, 1],
          [-90, 270],
          Extrapolation.CLAMP,
        );
    return {
      transform: [{ rotate: `${baseRot}deg` }],
      opacity: interpolate(
        fullCircleOpacity.value,
        [0, 1],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  const fullCircleStyle = useAnimatedStyle(() => ({
    opacity: fullCircleOpacity.value,
  }));

  // ── Logo (en el ring): visible mientras no morph-amos al check. ──
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  // ── Checkmark: aparece al done. ──
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));
  const checkPathProps = useAnimatedProps(() => ({
    strokeDashoffset: checkOffset.value,
  }));

  // ── Textos stackeados. Cada uno tiene su propio shared value. ──
  const txSendingStyle = useAnimatedStyle(() => ({
    opacity: txSendingOpacity.value,
    transform: [
      { scale: txSendingScale.value },
      { translateY: txSendingY.value },
    ],
  }));
  const txReceivedStyle = useAnimatedStyle(() => ({
    opacity: txReceivedOpacity.value,
    transform: [
      { scale: txReceivedScale.value },
      { translateY: txReceivedY.value },
    ],
  }));
  const txDoneStyle = useAnimatedStyle(() => ({
    opacity: txDoneOpacity.value,
    transform: [
      { scale: txDoneScale.value },
      { translateY: txDoneY.value },
    ],
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

  // Status bar: si estamos en fase "idle" respetamos el tema (la card es
  // blanca); en cualquier otra fase el verde full-bleed necesita iconos
  // blancos (light).
  const statusBarStyle = phase === "idle" ? "dark" : "light";

  return (
    <View style={[s.root, { backgroundColor: brand.green }]}>
      <StatusBar style={statusBarStyle} translucent />
      {/* Card blanca con contenido */}
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

      {/* Cover verde fullscreen: traslada hacia arriba bindeado al
          greenProgress que escribe SwipeToSubmit desde su worklet. */}
      <Animated.View
        pointerEvents="none"
        style={[s.greenCover, { height: windowH }, greenCoverStyle]}
      />

      {/* SwipeToSubmit — pill anclado al bottom. Todo el gesto y la
          animación de swipe viven en UI thread. */}
      {phase === "idle" ? (
        <View
          style={[s.swipeAnchor, { paddingBottom: insets.bottom }]}
        >
          <SwipeToSubmit
            onSubmit={runOrderFlow}
            progressOut={greenProgress}
          />
        </View>
      ) : null}

      {/* Overlay de ejecución — layout flex 1/3/2/2.
          El spacer top (flex 1) + hero (flex 3) posicionan el logo
          automáticamente al ~38% del safe area en cualquier pantalla.
          Textos stackeados con position absolute, todos montados desde
          el arranque y animados con opacity/scale/translateY. */}
      {phase !== "idle" ? (
        <View
          pointerEvents="none"
          style={[
            s.execOverlay,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          {/* flex 1: spacer top */}
          <View style={{ flex: 1 }} />

          {/* flex 3: hero (ring + logo + check) */}
          <View style={s.hero}>
            <View
              style={{
                width: ringSize,
                height: ringSize,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Spinning arc. Durante el draw rota -90→270; cuando
                  termina, el loop infinito de spinDeg toma el control. */}
              <Animated.View
                style={[
                  s.spinnerWrap,
                  { width: ringSize, height: ringSize },
                  logoEntryStyle,
                  spinnerStyle,
                ]}
              >
                <Svg
                  width={ringSize}
                  height={ringSize}
                  viewBox="0 0 100 100"
                >
                  {/* Track: 12% opacidad. */}
                  <Circle
                    cx="50"
                    cy="50"
                    r="44"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={ringStrokeViewBox}
                    fill="none"
                  />
                  {/* Arco activo. Durante el draw dasharray=CIRC (para
                      dibujar el círculo completo via offset); una vez
                      que el draw termina y el spinner arranca, la
                      apariencia visual es la misma porque queda en
                      offset=0, pero el wrapper rota. Luego para el loop
                      usamos dasharray ARC_LEN (75°). */}
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

              {/* Full circle estático (done). */}
              <Animated.View
                style={[
                  s.spinnerWrap,
                  { width: ringSize, height: ringSize },
                  fullCircleStyle,
                ]}
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

              {/* Logo Alamos (entra con logoEntry, se apaga con
                  logoOpacity/logoScale al morph). Combinamos ambas
                  vistas animadas anidando. */}
              <Animated.View style={[s.centerAbs, logoEntryStyle]}>
                <Animated.View style={logoStyle}>
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
              </Animated.View>

              {/* Checkmark: aparece al done con spring + stroke-draw. */}
              <Animated.View style={[s.centerAbs, checkStyle]}>
                <Svg
                  width={checkSize}
                  height={checkSize}
                  viewBox="0 0 24 24"
                >
                  <AnimatedPath
                    d="M5 12 L10 17 L19 7"
                    stroke="#FFFFFF"
                    strokeWidth={2.7}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={`${CHECK_PATH_LEN} ${CHECK_PATH_LEN}`}
                    animatedProps={checkPathProps}
                  />
                </Svg>
              </Animated.View>
            </View>
          </View>

          {/* flex 1: gap entre el ring y el texto */}
          <View style={{ flex: 1 }} />

          {/* flex 1: zona del texto (justifyContent flex-start = el
              texto queda pegado al tope de esta zona, que vive en el
              ~60-73 % del screen). Los 3 Animated.Text stackeados con
              position absolute. */}
          <View style={s.textStack}>
            <Animated.Text style={[s.execText, s.textAbs, txSendingStyle]}>
              Orden Enviada...
            </Animated.Text>
            <Animated.Text style={[s.execText, s.textAbs, txReceivedStyle]}>
              Orden Recibida...
            </Animated.Text>
            <Animated.Text style={[s.execText, s.textAbs, txDoneStyle]}>
              Orden Ejecutada
            </Animated.Text>
          </View>

          {/* flex 2: spacer bottom (aire premium) */}
          <View style={{ flex: 2 }} />
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

  /* Green cover (sube sobre la card via translateY) */
  greenCover: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: brand.green,
  },

  /* Anchor del SwipeToSubmit al bottom del screen. */
  swipeAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  /* Execution overlay: flex 1/3/2/2 sin posiciones hardcoded. */
  execOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  /* Hero: ocupa flex 2.5 del overlay, centra el ring vertical y horiz.
     Layout completo: 1 spacer / 2.5 hero / 1 gap / 1 texto / 2 spacer. */
  hero: {
    flex: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Wrapper absolute del spinner/full-circle dentro del hero. */
  spinnerWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  /* Helper: centrado absoluto dentro del ring (logo y check). */
  centerAbs: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  /* Zona del texto: flex 1. El texto arranca al tope de esta zona
     (justifyContent flex-start) y los 3 Animated.Text se stackean con
     position absolute para poder animar simultáneamente. */
  textStack: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
  },
  textAbs: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  execText: {
    fontFamily: fontFamily[600],
    fontSize: 34,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 40,
  },
});
