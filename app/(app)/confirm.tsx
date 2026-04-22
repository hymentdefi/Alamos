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

const SWIPE_THRESHOLD = 180;
const SWIPE_RANGE = 280;
/** Alto de la franja verde en reposo (solo la strip, sin insets). */
const STRIP_HEIGHT = 70;
/** Radio de la card blanca en las esquinas inferiores. */
const CARD_RADIUS = 28;

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

  // ─── Animated ───
  const greenProgress = useRef(new Animated.Value(0)).current;
  const checkMorph = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("Enviando orden");
  const tickedMid = useRef(false);

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

  // Haptic tick al cruzar 50%
  useEffect(() => {
    const id = greenProgress.addListener(({ value }) => {
      if (value > 0.5 && !tickedMid.current) {
        tickedMid.current = true;
        Haptics.selectionAsync().catch(() => {});
      } else if (value < 0.3) {
        tickedMid.current = false;
      }
    });
    return () => greenProgress.removeListener(id);
  }, [greenProgress]);

  const runOrderFlow = async () => {
    setPhase("sending");
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setStatusText("Enviando orden");
    await wait(900);

    setStatusText("Orden recibida");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await wait(900);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(greenProgress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      runOrderFlow();
    });
  };

  // PanResponder en TODA la pantalla — captura cualquier movimiento hacia
  // arriba desde cualquier punto. Condición muy permisiva para que agarre
  // al instante.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, g) => phase === "idle" && g.dy < -2,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          phase === "idle" && g.dy < -2,
        onPanResponderGrant: () => {
          // Pequeño tick al empezar a arrastrar para dar feedback inmediato
          Haptics.selectionAsync().catch(() => {});
        },
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
          if (-g.dy > SWIPE_THRESHOLD || g.vy < -0.6) {
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

  const greenHeight = greenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [STRIP_HEIGHT + insets.bottom, SCREEN_H + 200],
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
      {/* Card blanca con contenido. Termina antes de la strip, con
          esquinas redondeadas abajo. Cuando la strip verde crece, la
          va tapando. */}
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
              hitSlop={12}
              disabled={phase !== "idle"}
            >
              <Text style={[s.edit, { color: brand.greenDark }]}>Editar</Text>
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

        {/* Chevron al final de la card */}
        <View style={s.chevronBottom}>
          <PullChevron color={c.text} />
        </View>
      </View>

      {/* Franja verde que crece para comer la pantalla */}
      <Animated.View
        style={[
          s.greenStrip,
          { height: greenHeight, paddingBottom: insets.bottom },
        ]}
      >
        <Animated.View style={[s.hintWrap, { opacity: hintOpacity }]}>
          <Text style={s.hintText}>Deslizá para ejecutar</Text>
        </Animated.View>
      </Animated.View>

      {/* Overlay de ejecución: logo + spinner + texto + check */}
      {phase !== "idle" ? (
        <Animated.View
          pointerEvents="none"
          style={[s.execOverlay, { opacity: overlayOpacity }]}
        >
          <View style={s.logoWrap}>
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

          <Text style={s.execText}>{statusText}</Text>
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
  },
  edit: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.15,
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

  /* Green strip */
  greenStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  hintWrap: {
    flex: 1,
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
    justifyContent: "center",
    paddingBottom: 40,
  },
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 56,
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
    fontSize: 26,
    color: "#FFFFFF",
    letterSpacing: -0.6,
  },
});
