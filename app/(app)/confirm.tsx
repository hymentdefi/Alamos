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
import { useTheme, fontFamily, spacing, brand } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";
import { AmountDisplay } from "../../lib/components/AmountDisplay";

const { height: SCREEN_H } = Dimensions.get("window");

/** Distancia mínima que el dedo tiene que subir para ejecutar. */
const SWIPE_THRESHOLD = 220;
/** Rango visual de drag (más que threshold para sensación de viaje). */
const SWIPE_RANGE = 320;
/** Altura de la franja verde inicial (el bottom bar). */
const BASE_GREEN_HEIGHT = 110;

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

  /** 0 = reposo, 1 = verde llenó toda la pantalla. */
  const greenProgress = useRef(new Animated.Value(0)).current;
  /** 0 = logo visible, 1 = checkmark visible. */
  const checkMorph = useRef(new Animated.Value(0)).current;
  /** Rotación infinita del spinner (0 → 1 → 0 → 1 ...). */
  const spinLoop = useRef(new Animated.Value(0)).current;
  /** Opacidad del overlay blanco (logo + texto). */
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("Enviando orden");

  // Spinner loop siempre girando
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

  // Haptic tick cuando el user cruza el 50%
  useEffect(() => {
    const id = greenProgress.addListener(({ value }) => {
      if (value > 0.48 && value < 0.52) {
        Haptics.selectionAsync().catch(() => {});
      }
    });
    return () => greenProgress.removeListener(id);
  }, [greenProgress]);

  const runOrderFlow = async () => {
    setPhase("sending");
    // Fade in overlay white (logo + texto)
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    // Estado 1: Enviando
    setStatusText("Enviando orden");
    await wait(900);

    // Estado 2: Recibida
    setStatusText("Orden recibida");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await wait(900);

    // Estado 3: Ejecutada — logo morphea a check
    setPhase("done");
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    Animated.spring(checkMorph, {
      toValue: 1,
      tension: 140,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setStatusText("Orden ejecutada");

    await wait(1100);

    // Navegar al success
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
    Animated.timing(greenProgress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      runOrderFlow();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phase === "idle",
        onMoveShouldSetPanResponder: (_, g) =>
          phase === "idle" &&
          Math.abs(g.dy) > 4 &&
          Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (phase !== "idle") return;
          if (g.dy < 0) {
            const v = Math.min(1, -g.dy / SWIPE_RANGE);
            greenProgress.setValue(v);
          } else {
            greenProgress.setValue(0);
          }
        },
        onPanResponderRelease: (_, g) => {
          if (phase !== "idle") return;
          if (-g.dy > SWIPE_THRESHOLD || g.vy < -0.8) {
            completeSwipe();
          } else {
            Animated.spring(greenProgress, {
              toValue: 0,
              tension: 180,
              friction: 12,
              useNativeDriver: false,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (phase !== "idle") return;
          Animated.spring(greenProgress, {
            toValue: 0,
            tension: 180,
            friction: 12,
            useNativeDriver: false,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase],
  );

  if (!asset) return null;

  // Interpolations
  const greenHeight = greenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [BASE_GREEN_HEIGHT, SCREEN_H + 200],
  });
  const hintOpacity = greenProgress.interpolate({
    inputRange: [0, 0.3],
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
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Contenido principal */}
      <View style={[s.content, { paddingTop: insets.top + 12 }]}>
        <View style={s.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            disabled={phase !== "idle"}
          >
            <Text style={[s.edit, { color: c.greenDark }]}>Editar</Text>
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
          <AmountDisplay value={numAmount} size={38} />
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
            {asset.ticker}. La ejecución se realiza al mejor precio disponible.
          </Text>
        </View>
      </View>

      {/* Capa verde que viene desde abajo y come la pantalla */}
      <Animated.View
        style={[s.greenLayer, { height: greenHeight }]}
        {...panResponder.panHandlers}
      >
        <Animated.View
          style={[
            s.pullerHint,
            { paddingBottom: insets.bottom + 18, opacity: hintOpacity },
          ]}
          pointerEvents="none"
        >
          <PullChevron />
          <Text style={s.pullerText}>Deslizá para ejecutar</Text>
        </Animated.View>
      </Animated.View>

      {/* Overlay blanco con logo + spinner + texto cuando se ejecuta */}
      {phase !== "idle" ? (
        <Animated.View
          pointerEvents="none"
          style={[s.execOverlay, { opacity: overlayOpacity }]}
        >
          <View style={s.logoWrap}>
            {/* Spinner giratorio */}
            {phase !== "done" ? (
              <Animated.View
                style={[
                  s.spinnerWrap,
                  { transform: [{ rotate: spin }] },
                ]}
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

            {/* Logo Alamos (visible cuando no es done) */}
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

            {/* Checkmark (aparece con scale + opacity cuando done) */}
            <Animated.View
              style={[
                s.checkOverlay,
                {
                  opacity: checkMorph,
                  transform: [{ scale: checkMorph }],
                },
              ]}
            >
              <Feather name="check" size={88} color="#FFFFFF" strokeWidth={3.5} />
            </Animated.View>
          </View>

          <Text style={s.execText}>{statusText}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function PullChevron() {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -6,
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
    <Animated.View style={{ transform: [{ translateY: bounce }], marginBottom: 6 }}>
      <Feather name="chevron-up" size={24} color="#FFFFFF" />
    </Animated.View>
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: BASE_GREEN_HEIGHT,
  },
  header: {
    paddingVertical: 8,
  },
  edit: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.15,
  },
  titleBlock: {
    marginTop: 8,
    marginBottom: 24,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 36,
    letterSpacing: -1.4,
    lineHeight: 40,
  },
  amountBlock: {
    marginBottom: 28,
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
    marginTop: 28,
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

  /* Capa verde + puller */
  greenLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: brand.green,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  pullerHint: {
    alignItems: "center",
    paddingTop: 20,
  },
  pullerText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },

  /* Overlay de ejecución */
  execOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 60,
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
    width: 64,
    height: 64,
    tintColor: "#FFFFFF",
  },
  checkOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  execText: {
    fontFamily: fontFamily[700],
    fontSize: 26,
    color: "#FFFFFF",
    letterSpacing: -0.6,
  },
});
