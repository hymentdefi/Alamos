import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  Easing,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius, spacing, brand } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";
import { AmountDisplay } from "../../lib/components/AmountDisplay";

const { height: SCREEN_H } = Dimensions.get("window");

/** Distancia mínima del swipe para confirmar (px). */
const SWIPE_THRESHOLD = 240;
/** Distancia sobre la que la franja verde alcanza 100%. */
const SWIPE_RANGE = 320;
/** Primeros N px se descartan para que un tap no active nada. */
const SWIPE_DEAD_ZONE = 20;
/** Velocidad mínima para shortcut con flick. */
const SWIPE_FLICK_VELOCITY = 1.4;
/** Alto visible de la franja verde en reposo. */
const STRIP_HEIGHT = 72;
/** Radio inferior de la card blanca. */
const CARD_RADIUS = 28;
/** Delay de cada fase de ejecución — suficiente para que se lea. */
const PHASE_MS = 1900;

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

  // ─── Animated values ───
  // Progreso 0-1 del swipe verde. Animated su transform translateY nativo.
  const greenProgress = useRef(new Animated.Value(0)).current;
  // 0 = fuera, 1 = dentro (overlay de ejecución).
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  // Rotación del spinner.
  const spinLoop = useRef(new Animated.Value(0)).current;
  // Morph logo → check (0 = logo, 1 = check).
  const checkMorph = useRef(new Animated.Value(0)).current;
  // Transición del statusText entre fases.
  const statusOpacity = useRef(new Animated.Value(0)).current;
  const statusY = useRef(new Animated.Value(20)).current;

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");

  // Spinner loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinLoop, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinLoop]);

  // Haptic ticks progresivos al 25%, 50%, 75% — feeling Robinhood.
  const hapticStep = useRef(0);
  useEffect(() => {
    const id = greenProgress.addListener(({ value }) => {
      const thresholds = [0.25, 0.5, 0.75];
      const next = thresholds.findIndex((t) => value < t);
      const crossed = next === -1 ? thresholds.length : next;
      if (crossed > hapticStep.current) {
        hapticStep.current = crossed;
        Haptics.selectionAsync().catch(() => {});
      } else if (value < 0.1) {
        hapticStep.current = 0;
      }
    });
    return () => greenProgress.removeListener(id);
  }, [greenProgress]);

  /** Fade-out del texto actual, swap, fade-in del nuevo. */
  const transitionText = (next: string): Promise<void> => {
    return new Promise((resolve) => {
      Animated.parallel([
        Animated.timing(statusOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(statusY, {
          toValue: -18,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setStatusText(next);
        statusY.setValue(22);
        Animated.parallel([
          Animated.timing(statusOpacity, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(statusY, {
            toValue: 0,
            tension: 160,
            friction: 14,
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });
    });
  };

  const runOrderFlow = async () => {
    setPhase("sending");
    // Fade-in del overlay entero
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Primer texto: desde vacío, fade-in
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setStatusText("Enviando orden");
    statusY.setValue(22);
    Animated.parallel([
      Animated.timing(statusOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(statusY, {
        toValue: 0,
        tension: 160,
        friction: 14,
        useNativeDriver: true,
      }),
    ]).start();

    await wait(PHASE_MS);

    // Transición a "Orden recibida"
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await transitionText("Orden recibida");

    await wait(PHASE_MS);

    // Transición a "Ejecutada" + checkmark morph
    setPhase("done");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    Animated.spring(checkMorph, {
      toValue: 1,
      tension: 140,
      friction: 5,
      useNativeDriver: true,
    }).start();
    await transitionText("Orden ejecutada");

    await wait(1400);

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

  const completeSwipe = () => {
    if (phase !== "idle") return;
    // "fuim" — haptic heavy + timing punchy al soltar.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    Animated.timing(greenProgress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      runOrderFlow();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          phase === "idle" && -g.dy > SWIPE_DEAD_ZONE,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          phase === "idle" && -g.dy > SWIPE_DEAD_ZONE,
        onPanResponderGrant: () => {
          Haptics.selectionAsync().catch(() => {});
        },
        onPanResponderMove: (_, g) => {
          if (phase !== "idle") return;
          const dy = -g.dy;
          if (dy <= 0) {
            greenProgress.setValue(0);
            return;
          }
          const effective = Math.max(0, dy - SWIPE_DEAD_ZONE);
          const raw = Math.min(1, effective / (SWIPE_RANGE - SWIPE_DEAD_ZONE));
          // Curva sutil: arranca lineal, suaviza al final
          const curved = 1 - Math.pow(1 - raw, 1.8);
          greenProgress.setValue(curved);
        },
        onPanResponderRelease: (_, g) => {
          if (phase !== "idle") return;
          const dy = -g.dy;
          const vy = -g.vy;
          if (
            dy > SWIPE_THRESHOLD ||
            (vy > SWIPE_FLICK_VELOCITY && dy > SWIPE_RANGE * 0.35)
          ) {
            completeSwipe();
          } else {
            Animated.spring(greenProgress, {
              toValue: 0,
              tension: 220,
              friction: 18,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (phase !== "idle") return;
          Animated.spring(greenProgress, {
            toValue: 0,
            tension: 220,
            friction: 18,
            useNativeDriver: true,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase],
  );

  if (!asset) return null;

  // Translate del cover verde: en reposo, translateY = SCREEN_H - strip, así
  // solo se ve la franja al fondo. Al completar swipe, translateY = 0 = cubre.
  const greenCoverStartY = SCREEN_H - (STRIP_HEIGHT + insets.bottom);
  const greenCoverY = greenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [greenCoverStartY, 0],
  });
  const hintOpacity = greenProgress.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
  });
  const spin = spinLoop.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

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
    <View
      style={[s.root, { backgroundColor: brand.green }]}
      {...panResponder.panHandlers}
    >
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

        <View style={s.chevronBottom}>
          <PullChevron color={c.text} />
        </View>
      </View>

      {/* Cover verde que sube desde abajo con translateY (nativo, smooth) */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.greenCover,
          {
            height: SCREEN_H,
            transform: [{ translateY: greenCoverY }],
          },
        ]}
      />

      {/* Hint "Deslizá para ejecutar" anclado al bottom, se desvanece al subir */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.hintBar,
          {
            height: STRIP_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            opacity: hintOpacity,
          },
        ]}
      >
        <Text style={s.hintText}>Deslizá para ejecutar</Text>
      </Animated.View>

      {/* Overlay de ejecución */}
      {phase !== "idle" ? (
        <Animated.View
          pointerEvents="none"
          style={[s.execOverlay, { opacity: overlayOpacity }]}
        >
          <View style={s.execCenter}>
            <View style={s.logoWrap}>
              {phase !== "done" ? (
                <Animated.View
                  style={[s.spinnerWrap, { transform: [{ rotate: spin }] }]}
                >
                  <Svg width={160} height={160} viewBox="0 0 100 100">
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
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray="60 220"
                      strokeLinecap="round"
                    />
                  </Svg>
                </Animated.View>
              ) : null}

              <Animated.View
                style={[
                  s.logoOverlay,
                  {
                    opacity: checkMorph.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                    transform: [
                      {
                        scale: checkMorph.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.4],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Image
                  source={require("../../assets/brand-assets/empresa-mono/png/brand-mono-white-isotipo-1024.png")}
                  style={s.logoImg}
                  resizeMode="contain"
                />
              </Animated.View>

              <Animated.View
                style={[
                  s.checkOverlay,
                  {
                    opacity: checkMorph,
                    transform: [{ scale: checkMorph }],
                  },
                ]}
              >
                <Feather
                  name="check"
                  size={90}
                  color="#FFFFFF"
                  strokeWidth={3.5}
                />
              </Animated.View>
            </View>

            {/* Status text con slide + fade entre fases */}
            <Animated.Text
              style={[
                s.execText,
                {
                  opacity: statusOpacity,
                  transform: [{ translateY: statusY }],
                },
              ]}
            >
              {statusText}
            </Animated.Text>
          </View>

          <View style={[s.disclaimerWrap, { paddingBottom: insets.bottom + 22 }]}>
            <Text style={s.disclaimerText}>
              La respuesta del sistema, el precio y velocidad de ejecución, la
              liquidez, los datos del mercado y los tiempos de acceso pueden
              verse afectados por muchos factores — incluidos la volatilidad,
              el tamaño y tipo de orden, y las condiciones del mercado.
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function PullChevron({ color }: { color: string }) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -4,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);
  return (
    <Animated.View style={{ transform: [{ translateY: bounce }] }}>
      <Feather name="chevron-up" size={26} color={color} />
    </Animated.View>
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
  chevronBottom: {
    alignItems: "center",
    paddingBottom: 18,
    paddingTop: 8,
  },

  /* Green cover (sube sobre la card via translateY) */
  greenCover: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: brand.green,
  },

  /* Hint "Deslizá para ejecutar" — fixed bottom strip */
  hintBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },

  /* Execution overlay */
  execOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "space-between",
  },
  execCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 44,
  },
  spinnerWrap: {
    position: "absolute",
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  logoOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 66,
    height: 66,
    tintColor: "#FFFFFF",
  },
  checkOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  execText: {
    fontFamily: fontFamily[700],
    fontSize: 30,
    color: "#FFFFFF",
    letterSpacing: -0.7,
    textAlign: "center",
  },

  /* Disclaimer al pie del overlay */
  disclaimerWrap: {
    paddingHorizontal: 28,
    alignItems: "center",
  },
  disclaimerText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    letterSpacing: -0.05,
  },
});
