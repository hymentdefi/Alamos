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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius, spacing, brand } from "../../lib/theme";
import {
  assets,
  assetIconCode,
  formatARS,
} from "../../lib/data/assets";
import { AmountDisplay } from "../../lib/components/AmountDisplay";

const { height: SCREEN_H } = Dimensions.get("window");

/** Altura del tramo que el user tiene que subir con el dedo para confirmar. */
const SWIPE_DISTANCE = 260;
/** Umbral mínimo para que sea un "swipe válido". */
const SWIPE_THRESHOLD = 140;

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
  // 0 = reposo, 1 = user subió todo. Se usa para mover el puller arriba
  // y revelar el splash verde.
  const progress = useRef(new Animated.Value(0)).current;
  // 0 = estado normal, 1 = ejecutando (pantalla llena de verde).
  const splash = useRef(new Animated.Value(0)).current;
  // Scale del checkmark.
  const checkScale = useRef(new Animated.Value(0)).current;
  // Estado visual: "idle" | "confirming" | "done"
  const [phase, setPhase] = useState<"idle" | "confirming" | "done">("idle");

  const completeSwipe = async () => {
    if (phase !== "idle") return;
    setPhase("confirming");

    // haptic inicial fuerte
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    // 1. El puller termina de subir (completa el arrastre)
    Animated.timing(progress, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 2. El splash verde llena la pantalla
    await wait(120);
    Animated.timing(splash, {
      toValue: 1,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // 3. Checkmark pop con haptic success
    await wait(480);
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    Animated.spring(checkScale, {
      toValue: 1,
      tension: 140,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setPhase("done");

    // 4. Esperar un toque y navegar al success
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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (phase !== "idle") return;
          if (g.dy < 0) {
            const v = Math.min(1, -g.dy / SWIPE_DISTANCE);
            progress.setValue(v);
          } else {
            progress.setValue(0);
          }
        },
        onPanResponderRelease: (_, g) => {
          if (phase !== "idle") return;
          if (-g.dy > SWIPE_THRESHOLD || g.vy < -0.8) {
            completeSwipe();
          } else {
            Animated.spring(progress, {
              toValue: 0,
              tension: 180,
              friction: 12,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (phase !== "idle") return;
          Animated.spring(progress, {
            toValue: 0,
            tension: 180,
            friction: 12,
            useNativeDriver: true,
          }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase],
  );

  // Haptic "tick" cuando el user está cerca del threshold
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      if (value > 0.45 && value < 0.55) {
        Haptics.selectionAsync().catch(() => {});
      }
    });
    return () => progress.removeListener(id);
  }, [progress]);

  if (!asset) return null;

  // ─── Interpolations ───
  const pullerTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -180],
  });
  const contentOpacity = progress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 0.6, 0.3],
  });
  const splashHeight = splash.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_H + 200],
  });
  const hintOpacity = progress.interpolate({
    inputRange: [0, 0.3],
    outputRange: [1, 0],
  });

  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: "Activo", value: asset.name },
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
      <Animated.View
        style={[s.content, { opacity: contentOpacity, paddingTop: insets.top + 12 }]}
      >
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
          <Text style={[s.available, { color: c.textMuted }]}>
            {formatARS(1272850)} disponibles
          </Text>
        </View>

        <View style={s.amountBlock}>
          <Text style={[s.amountLabel, { color: c.textMuted }]}>
            {isSell ? "Vendés" : "Comprás"}
          </Text>
          <AmountDisplay value={numAmount} size={36} />
          <View style={s.assetRow}>
            <View
              style={[
                s.assetIcon,
                {
                  backgroundColor:
                    asset.iconTone === "dark" ? c.ink : c.surfaceSunken,
                },
              ]}
            >
              <Text
                style={[
                  s.assetIconText,
                  { color: asset.iconTone === "dark" ? c.bg : c.textSecondary },
                ]}
              >
                {assetIconCode(asset)}
              </Text>
            </View>
            <Text style={[s.assetName, { color: c.textSecondary }]}>
              {asset.subLabel}
            </Text>
          </View>
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
      </Animated.View>

      {/* Puller: chevron + label que el user arrastra hacia arriba */}
      <Animated.View
        style={[
          s.puller,
          {
            paddingBottom: insets.bottom + 22,
            transform: [{ translateY: pullerTranslateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={{ opacity: hintOpacity }}>
          <PullIndicator color={c.text} />
        </Animated.View>
        <Text style={[s.pullerText, { color: c.text }]}>
          Deslizá para ejecutar
        </Text>
      </Animated.View>

      {/* Splash verde que crece desde abajo al ejecutar */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.splash,
          {
            height: splashHeight,
            backgroundColor: brand.green,
          },
        ]}
      />

      {/* Checkmark flotante en el centro */}
      {phase !== "idle" ? (
        <View pointerEvents="none" style={s.checkWrap}>
          <Animated.View
            style={{
              transform: [{ scale: checkScale }],
              opacity: checkScale,
            }}
          >
            <View style={s.checkCircle}>
              <Feather name="check" size={72} color={brand.green} strokeWidth={4} />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

/* ─── Sub-components ─── */

function PullIndicator({ color }: { color: string }) {
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
      <Feather name="chevron-up" size={22} color={color} />
    </Animated.View>
  );
}

/* ─── Helpers ─── */

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  root: { flex: 1 },

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
    marginBottom: 28,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 36,
    letterSpacing: -1.4,
    lineHeight: 40,
  },
  available: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    marginTop: 4,
    letterSpacing: -0.15,
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
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  assetIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  assetIconText: {
    fontFamily: fontFamily[700],
    fontSize: 10,
  },
  assetName: {
    fontFamily: fontFamily[500],
    fontSize: 13,
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
    marginTop: 32,
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

  /* Puller area */
  puller: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pullerText: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },

  /* Splash green */
  splash: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  /* Check */
  checkWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
});
