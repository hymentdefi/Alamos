import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme, fontFamily, radius, spacing, brand } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";
import { AmountDisplay } from "../../lib/components/AmountDisplay";
import { SwipeToSubmit } from "../../lib/components/SwipeToSubmit";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { height: SCREEN_H } = Dimensions.get("window");

/** Alto visible de la franja verde (pill del SwipeToSubmit) en reposo. */
const STRIP_HEIGHT = 72;
/** Radio inferior de la card blanca. */
const CARD_RADIUS = 28;
/** "Orden Enviada..." — corto, sólo confirma que salió. */
const PHASE_SENDING_MS = 900;
/** "Orden Recibida..." — queda un buen tiempo. */
const PHASE_RECEIVED_MS = 2400;
/** Mínimo absoluto de loading antes de mostrar success. La pausa intencional
 * le da seriedad y confianza al flujo. */
const MIN_LOADING_MS = 600;
/** Hold del estado "Orden Ejecutada" con el checkmark antes de navegar. */
const DONE_HOLD_MS = 1800;
/** Duración del morph logo → checkmark (cross-fade con scale). */
const MORPH_MS = 300;
/** Duración del stroke-draw del check. */
const CHECK_DRAW_MS = 320;
/** Duración del cross-fade del texto. */
const FADE_MS = 200;
/** Longitud del path del checkmark (suficiente con 24 para el path en
 * viewBox 0 0 24 24). */
const CHECK_PATH_LEN = 24;

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

  const asset = assets.find((a) => a.ticker === ticker);
  const isSell = mode === "sell";

  const numAmount = Number(amount) || asset?.price || 0;
  const estQty = asset ? numAmount / asset.price : 0;
  const fee = Math.round(numAmount * 0.005);
  const net = isSell ? numAmount - fee : numAmount + fee;

  // ─── Shared values (todos viven en UI thread) ───
  // Progreso del swipe (0..1). Lo escribe SwipeToSubmit desde su worklet
  // y lo leemos acá en useAnimatedStyle para el cover verde.
  const greenProgress = useSharedValue(0);
  // Fade-in del overlay de ejecución entero.
  const overlayOpacity = useSharedValue(0);
  // Rotación del spinner en grados (loop infinito).
  const spinDeg = useSharedValue(0);
  // Opacidad del status text (cross-fade entre fases).
  const statusOpacity = useSharedValue(0);
  // Morph logo→check: 0 = logo, 1 = check.
  const morph = useSharedValue(0);
  // Cross-fade del spinning arc al full-circle estático.
  const fullCircleOpacity = useSharedValue(0);
  // strokeDashoffset del check: CHECK_PATH_LEN = invisible, 0 = dibujado.
  const checkOffset = useSharedValue(CHECK_PATH_LEN);

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");

  // Spinner loop — 1000 ms por vuelta (Robinhood ~900-1100).
  useEffect(() => {
    spinDeg.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Cross-fade del texto: fade-out, swap, fade-in. La transición del
   * sharedValue usa el callback de withTiming (worklet) + runOnJS para
   * bridgear a setStatusText y resolve. */
  const transitionText = (next: string): Promise<void> => {
    return new Promise((resolve) => {
      statusOpacity.value = withTiming(
        0,
        { duration: FADE_MS, easing: Easing.inOut(Easing.quad) },
        (finished) => {
          "worklet";
          if (!finished) return;
          runOnJS(setStatusText)(next);
          statusOpacity.value = withTiming(
            1,
            { duration: FADE_MS, easing: Easing.inOut(Easing.quad) },
            (done) => {
              "worklet";
              if (done) runOnJS(resolve)();
            },
          );
        },
      );
    });
  };

  const runOrderFlow = async () => {
    setPhase("sending");

    // Fade-in del overlay entero (UI thread).
    overlayOpacity.value = withTiming(1, {
      duration: 340,
      easing: Easing.out(Easing.quad),
    });

    // Haptic "success fuerte" al tocar tierra tras el swipe.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );

    // Fase 1: "Orden Enviada..." aparece con fade-in.
    setStatusText("Orden Enviada...");
    statusOpacity.value = withTiming(1, {
      duration: FADE_MS,
      easing: Easing.inOut(Easing.quad),
    });

    // Mínimo 600 ms de loading incluso si el "API" respondiera instantáneo.
    const apiCall = wait(PHASE_SENDING_MS);
    const minLoading = wait(MIN_LOADING_MS);
    await Promise.all([apiCall, minLoading]);

    // Fase 2: cross-fade a "Orden Recibida..."
    setPhase("received");
    await transitionText("Orden Recibida...");

    await wait(PHASE_RECEIVED_MS);

    // Fase 3: morph logo → check + cross-fade "Orden Ejecutada".
    setPhase("done");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );

    // Cross-fade del spinning arc al full-circle estático (UI thread).
    fullCircleOpacity.value = withTiming(1, {
      duration: MORPH_MS,
      easing: Easing.out(Easing.cubic),
    });
    // Cross-fade logo → checkmark (scale + opacity, UI thread).
    morph.value = withTiming(1, {
      duration: MORPH_MS,
      easing: Easing.out(Easing.cubic),
    });
    // Stroke-draw del check un toque después del morph — ahora en UI
    // thread también vía useAnimatedProps.
    setTimeout(() => {
      checkOffset.value = withTiming(0, {
        duration: CHECK_DRAW_MS,
        easing: Easing.out(Easing.cubic),
      });
    }, MORPH_MS * 0.5);

    await transitionText("Orden Ejecutada");

    // Hold 1.8 s sobre el estado success.
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

  // Cover verde fullscreen: translateY desde (SCREEN_H - strip - safe)
  // hasta 0, bindeado directamente a greenProgress (que SwipeToSubmit
  // escribe desde su worklet).
  const greenCoverStyle = useAnimatedStyle(() => {
    const startY = SCREEN_H - (STRIP_HEIGHT + insets.bottom);
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

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const statusStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinDeg.value}deg` }],
    // El arc se cross-fadea al full-circle cuando llegamos a "done".
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

  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          morph.value,
          [0, 1],
          [1, 0.8],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: morph.value,
    transform: [
      {
        scale: interpolate(
          morph.value,
          [0, 1],
          [0.8, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Animated props sobre el Path SVG: strokeDashoffset viene del shared
  // value, entonces el stroke-draw corre 100% en UI thread.
  const checkPathProps = useAnimatedProps(() => ({
    strokeDashoffset: checkOffset.value,
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

  return (
    <View style={[s.root, { backgroundColor: brand.green }]}>
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
        style={[s.greenCover, { height: SCREEN_H }, greenCoverStyle]}
      />

      {/* SwipeToSubmit — pill anclado al bottom. Todo el gesto y la
          animación de swipe viven en UI thread. Una vez que arrancó el
          flujo de ejecución lo desmontamos para que el overlay quede
          limpio. */}
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

      {/* Overlay de ejecución — todo con reanimated shared values. */}
      {phase !== "idle" ? (
        <Animated.View
          pointerEvents="none"
          style={[s.execOverlay, overlayStyle]}
        >
          <View style={{ height: SCREEN_H * 0.33 }} />

          <View style={s.logoWrap}>
            {/* Spinning arc (sending/received) — rotación native thread. */}
            <Animated.View style={[s.spinnerWrap, spinnerStyle]}>
              <Svg width={140} height={140} viewBox="0 0 100 100">
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="3"
                  fill="none"
                />
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  fill="none"
                  strokeDasharray="100 176"
                  strokeLinecap="round"
                />
              </Svg>
            </Animated.View>

            {/* Full circle estático (done) — cross-fade con el arc. */}
            <Animated.View style={[s.spinnerWrap, fullCircleStyle]}>
              <Svg width={140} height={140} viewBox="0 0 100 100">
                <Circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  fill="none"
                />
              </Svg>
            </Animated.View>

            {/* Logo Alamos (~60% del diámetro) — se apaga al morph. */}
            <Animated.View style={[s.logoOverlay, logoStyle]}>
              <Image
                source={require("../../assets/brand-assets/empresa-mono/png/brand-mono-white-isotipo-1024.png")}
                style={s.logoImg}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Checkmark — scale + opacity en UI thread; stroke-draw via
                useAnimatedProps sobre el Path. */}
            <Animated.View style={[s.logoOverlay, checkStyle]}>
              <Svg width={78} height={78} viewBox="0 0 24 24">
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

          <View style={{ height: SCREEN_H * 0.08 }} />

          <Animated.Text style={[s.execText, statusStyle]}>
            {statusText}
          </Animated.Text>

          <View style={{ flex: 1 }} />

          <View style={[s.disclaimerWrap, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={s.disclaimerText}>
              La respuesta del sistema, el precio y velocidad de ejecución, la
              liquidez, los datos del mercado y los tiempos de acceso pueden
              verse afectados por muchos factores, incluidos la volatilidad, el
              tamaño y tipo de orden, y las condiciones del mercado.
            </Text>
          </View>
        </Animated.View>
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

  /* Execution overlay — layout estilo Robinhood, no vertical-center */
  execOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  logoWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerWrap: {
    position: "absolute",
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  logoOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    // ~60% del diámetro interior del spinner (radio 44 en viewBox 100,
    // escala 1.4x → ~123 px interior → 60% ≈ 78 px).
    width: 78,
    height: 78,
    tintColor: "#FFFFFF",
  },
  execText: {
    fontFamily: fontFamily[700],
    fontSize: 30,
    color: "#FFFFFF",
    letterSpacing: -0.7,
    textAlign: "center",
    paddingHorizontal: 24,
  },

  /* Disclaimer al pie del overlay */
  disclaimerWrap: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  disclaimerText: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    letterSpacing: -0.1,
  },
});
