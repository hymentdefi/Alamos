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

/** Constantes calibradas con el video de Robinhood.
 *
 * Resumen del comportamiento: el fill verde sigue al dedo 1:1 con una
 * curva easeOutCubic (respuesta directa y snappy, no resistencia rubber).
 * El commit se dispara al 70% del recorrido o con un flick deliberado
 * (velocidad > 0.5 px/ms y ≥55% del recorrido). */
const SWIPE_RANGE = 280;
/** Fracción del range para considerar "confirmado" en el release. */
const SWIPE_COMMIT_FRACTION = 0.7;
const SWIPE_THRESHOLD = SWIPE_RANGE * SWIPE_COMMIT_FRACTION; // 196
/** Velocidad mínima (px/ms) para confirmar con flick. */
const SWIPE_FLICK_VELOCITY = 0.5;
/** Distancia mínima junto con flick (fracción del range). */
const SWIPE_FLICK_MIN_FRACTION = 0.55;
/** Alto visible de la franja verde en reposo. */
const STRIP_HEIGHT = 72;
/** Radio inferior de la card blanca. */
const CARD_RADIUS = 28;
/** "Orden Enviada..." — corto, sólo confirma que salió (Robinhood: ~900 ms). */
const PHASE_SENDING_MS = 900;
/** "Orden Recibida..." — queda un buen tiempo (Robinhood: ~3000 ms). */
const PHASE_RECEIVED_MS = 3000;
/** Duración del cross-fade del texto (Robinhood: ~200 ms). */
const FADE_MS = 200;

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
  const greenProgress = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef(new Animated.Value(0)).current;
  // Texto: solo fade, sin slide. Feel Robinhood.
  const statusOpacity = useRef(new Animated.Value(0)).current;

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");

  // Spinner loop — 1000ms por vuelta (Robinhood ~900-1100).
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinLoop, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinLoop]);

  // Un solo haptic "medium" al cruzar el commit threshold (70%) —
  // feedback que te avisa "ya podés soltar".
  const crossedCommit = useRef(false);
  useEffect(() => {
    const id = greenProgress.addListener(({ value }) => {
      if (value > SWIPE_COMMIT_FRACTION && !crossedCommit.current) {
        crossedCommit.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else if (value < SWIPE_COMMIT_FRACTION - 0.1) {
        crossedCommit.current = false;
      }
    });
    return () => greenProgress.removeListener(id);
  }, [greenProgress]);

  /** Cross-fade del texto: rápido (200 ms cada dirección), sin slide. */
  const transitionText = (next: string): Promise<void> => {
    return new Promise((resolve) => {
      Animated.timing(statusOpacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setStatusText(next);
        Animated.timing(statusOpacity, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start(() => resolve());
      });
    });
  };

  const runOrderFlow = async () => {
    setPhase("sending");

    // Fade-in del overlay completo.
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Haptic "success fuerte" al tocar tierra tras el swipe (equivalente al
    // .heavy + success buzz de Robinhood).
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );

    // Fase 1: "Orden Enviada..." aparece con fade-in.
    setStatusText("Orden Enviada...");
    Animated.timing(statusOpacity, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();

    await wait(PHASE_SENDING_MS);

    // Fase 2: cross-fade a "Orden Recibida..." (queda 3s en pantalla).
    setPhase("received");
    await transitionText("Orden Recibida...");

    await wait(PHASE_RECEIVED_MS);

    // Salida al success screen.
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
    // Haptic heavy al commit — Robinhood firma el gesto con impacto fuerte.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    // easeOutExpo para que el fill termine pulido, sin bounce. ~350 ms.
    Animated.timing(greenProgress, {
      toValue: 1,
      duration: 350,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
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
          phase === "idle" && g.dy < -2,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          phase === "idle" && g.dy < -2,
        onPanResponderGrant: () => {
          // Robinhood: tap sutil al touchdown.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        },
        onPanResponderMove: (_, g) => {
          if (phase !== "idle") return;
          const dy = -g.dy;
          if (dy <= 0) {
            greenProgress.setValue(0);
            return;
          }
          const raw = Math.min(1, dy / SWIPE_RANGE);
          // easeOutCubic sobre el fill — respuesta 1:1 al inicio (se siente
          // directo y snappy), con una leve suavización hacia el final.
          const curved = 1 - Math.pow(1 - raw, 3);
          greenProgress.setValue(curved);
        },
        onPanResponderRelease: (_, g) => {
          if (phase !== "idle") return;
          const dy = -g.dy;
          const vy = -g.vy;
          const passedDistance = dy > SWIPE_THRESHOLD;
          const validFlick =
            vy > SWIPE_FLICK_VELOCITY &&
            dy > SWIPE_RANGE * SWIPE_FLICK_MIN_FRACTION;
          if (passedDistance || validFlick) {
            completeSwipe();
          } else {
            // No llegó: spring-back natural, haptic light como feedback.
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            Animated.spring(greenProgress, {
              toValue: 0,
              tension: 180,
              friction: 14,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (phase !== "idle") return;
          Animated.spring(greenProgress, {
            toValue: 0,
            tension: 180,
            friction: 14,
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

      {/* Overlay de ejecución — layout calibrado contra el video de
          Robinhood: logo a ~40% del top, texto a ~56%, disclaimer pinned
          al bottom con safe-area. */}
      {phase !== "idle" ? (
        <Animated.View
          pointerEvents="none"
          style={[s.execOverlay, { opacity: overlayOpacity }]}
        >
          {/* Spacer hasta el logo: empuja el logo al ~33% del top,
              centro del logo a ~40%. */}
          <View style={{ height: SCREEN_H * 0.33 }} />

          <View style={s.logoWrap}>
            <Animated.View
              style={[s.spinnerWrap, { transform: [{ rotate: spin }] }]}
            >
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

            <View style={s.logoOverlay}>
              <Image
                source={require("../../assets/brand-assets/empresa-mono/png/brand-mono-white-isotipo-1024.png")}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Gap fijo hasta el texto — logo queda a ~40%, texto a ~56%. */}
          <View style={{ height: SCREEN_H * 0.08 }} />

          <Animated.Text style={[s.execText, { opacity: statusOpacity }]}>
            {statusText}
          </Animated.Text>

          {/* Flex fill hacia el disclaimer. */}
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
    width: 58,
    height: 58,
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
