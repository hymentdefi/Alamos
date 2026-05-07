import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, useTheme } from "../../lib/theme";
import {
  assetCurrency,
  assets,
  formatMoney,
} from "../../lib/data/assets";
import { briefingFor, formatBriefingAge } from "../../lib/data/briefings";

/* Geometría del campo de puntitos.
 *
 * El grid se inset un poco de los bordes laterales (FIELD_PAD_X)
 * para que los dots no toquen el edge de la pantalla. Stride =
 * DOT_SIZE + DOT_GAP. ROWS / COLS auto-calculados.
 */
const DOT_SIZE = 5;
const DOT_GAP = 13;
const STRIDE = DOT_SIZE + DOT_GAP;
const RIPPLE_H = 320;
const FIELD_PAD_X = 26;

const SCREEN_W = Dimensions.get("window").width;
const COLS = Math.floor((SCREEN_W - FIELD_PAD_X * 2) / STRIDE);
const ROWS = Math.floor(RIPPLE_H / STRIDE);
const GRID_W = COLS * STRIDE - DOT_GAP;
const GRID_H = ROWS * STRIDE - DOT_GAP;

/**
 * Página completa del briefing AI. Header con back-arrow + ticker
 * stacked sobre precio. Hero con un campo de puntitos animado
 * tipo droplet — la onda nace en el centro-abajo y se expande en
 * círculos concéntricos hacia las esquinas.
 */
export default function BriefingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { ticker } = useLocalSearchParams<{ ticker: string }>();

  const asset = useMemo(
    () => assets.find((a) => a.ticker === ticker),
    [ticker],
  );

  if (!asset) {
    return (
      <View style={[s.root, { backgroundColor: c.bg }]}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={s.backBtn}
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Feather name="arrow-left" size={24} color={c.text} />
          </Pressable>
        </View>
        <View style={s.fallback}>
          <Text style={{ color: c.textMuted }}>Activo no encontrado.</Text>
        </View>
      </View>
    );
  }

  const briefing = briefingFor(asset.ticker);
  const isUp = asset.change >= 0;
  const tone = isUp ? c.greenDark : c.red;
  const cur = assetCurrency(asset);

  // Feedback del usuario sobre el briefing — null = no votó
  // todavía, "up" = thumbs up, "down" = thumbs down. Por ahora
  // es state local; cuando llegue el backend, lo persistimos.
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const handleVote = (next: "up" | "down") => {
    Haptics.selectionAsync().catch(() => {});
    setVote((prev) => (prev === next ? null : next));
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header: back-arrow a la izquierda + ticker stacked sobre
          precio. Sin variación. Mismo layout que la screenshot
          de referencia. */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={s.backBtn}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={24} color={c.text} />
        </Pressable>
        <View style={s.headStack}>
          <Text style={[s.headTicker, { color: c.text }]}>
            {asset.ticker}
          </Text>
          <Text style={[s.headPrice, { color: c.textMuted }]}>
            {formatMoney(asset.price, cur)}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <RippleField color={tone} />

        <View style={s.body}>
          <Text style={[s.bodyMeta, { color: c.textMuted }]}>
            Actualizado {formatBriefingAge(briefing.updatedAt)} · AI-powered
          </Text>

          <Text style={[s.bodyTitle, { color: tone }]}>
            {briefing.title}
          </Text>

          {briefing.sections.map((section, i) => (
            <View
              key={i}
              style={[
                s.section,
                { borderLeftColor: tone, marginTop: i === 0 ? 24 : 22 },
              ]}
            >
              <Text style={[s.sectionTitle, { color: tone }]}>
                {section.title}
              </Text>
              <Text
                style={[s.sectionBody, { color: c.textSecondary }]}
              >
                {section.body}
              </Text>
            </View>
          ))}

          {/* Feedback — dos botones circulares grandes con
              thumbs filled en el color del activo. Tap →
              set/toggle vote. Cuando alguno está activo, se
              rellena con el tone y el icono pasa a c.bg para
              contraste. Iconos de Ionicons (filled, no outline)
              porque Feather sólo tiene la versión line. */}
          <View style={s.feedbackRow}>
            <Pressable
              onPress={() => handleVote("up")}
              hitSlop={10}
              style={[
                s.feedbackBtn,
                {
                  borderColor: tone,
                  backgroundColor:
                    vote === "up" ? tone : "transparent",
                },
              ]}
            >
              <Ionicons
                name="thumbs-up"
                size={28}
                color={vote === "up" ? c.bg : tone}
              />
            </Pressable>
            <Pressable
              onPress={() => handleVote("down")}
              hitSlop={10}
              style={[
                s.feedbackBtn,
                {
                  borderColor: tone,
                  backgroundColor:
                    vote === "down" ? tone : "transparent",
                },
              ]}
            >
              <Ionicons
                name="thumbs-down"
                size={28}
                color={vote === "down" ? c.bg : tone}
              />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Campo de puntitos: droplet wave ─────────────────────────
 *
 * El field de dots es SIEMPRE visible — los dots existen como
 * un fondo gris constante (c.textFaint del theme). La onda lo
 * único que hace es prender un overlay del color del activo
 * encima de cada dot mientras lo cruza, y después de que pasó
 * un trail residual que decae a 0. El gris base permanece.
 *
 * Implementación performante: UN solo SharedValue (wavePos)
 * controla el ciclo en el thread UI. Cada Dot tiene su propio
 * useAnimatedStyle SOLO para el overlay coloreado — el base
 * gris no se anima, va con backgroundColor estático.
 */
function RippleField({ color }: { color: string }) {
  const { c } = useTheme();

  // Precomputo: distancia al origen (centro-abajo) para cada
  // dot. Las esquinas superiores tardan más en ser alcanzadas.
  const items = useMemo(() => {
    const arr: { row: number; col: number; distance: number }[] = [];
    const cx = (COLS - 1) / 2;
    const cy = ROWS - 1;
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const dx = col - cx;
        const dy = r - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        arr.push({ row: r, col, distance });
      }
    }
    return arr;
  }, []);

  const maxDist = useMemo(() => {
    const cx = (COLS - 1) / 2;
    const cy = ROWS - 1;
    return Math.sqrt(cx * cx + cy * cy);
  }, []);

  const wavePos = useSharedValue(-1);

  useEffect(() => {
    // Loop infinito. wavePos arranca en -2 (todos los dots
    // antes del pre-lead) y sube hasta maxDist + 6.5 (todos
    // pasaron por el trail completo y volvieron a 0). El reset
    // al -2 es seamless. Bumpeé el duration a 2800ms porque la
    // onda ahora cubre más rango.
    wavePos.value = -2;
    wavePos.value = withRepeat(
      withTiming(maxDist + 6.5, {
        duration: 2800,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [maxDist, wavePos]);

  return (
    <View
      style={[
        s.ripple,
        { backgroundColor: c.bg, height: RIPPLE_H },
      ]}
    >
      <View style={{ width: GRID_W, height: GRID_H }}>
        {items.map((it, i) => (
          <Dot
            key={i}
            row={it.row}
            col={it.col}
            distance={it.distance}
            color={color}
            dim={c.textFaint}
            wavePos={wavePos}
          />
        ))}
      </View>
    </View>
  );
}

interface DotProps {
  row: number;
  col: number;
  distance: number;
  color: string;
  dim: string;
  wavePos: Animated.SharedValue<number>;
}

function Dot({ row, col, distance, color, dim, wavePos }: DotProps) {
  // Worklet del overlay coloreado. Cinco fases para un feel
  // "rainbow / glow" — muchos dots lit a la vez con falloff
  // smooth alrededor del frente de onda:
  //
  //   1. delta < -LEAD                 → overlay 0 (no light)
  //   2. -LEAD ≤ delta < -BAND/2       → pre-lead: dots adelante
  //      del frente lighting up gradually (0 → 0.6)
  //   3. -BAND/2 ≤ delta ≤ BAND/2      → peak: 0.6 → 1 → 0.6 con
  //      forma de bell (parabólica)
  //   4. BAND/2 < delta ≤ BAND/2+TRAIL → trail largo: dots atrás
  //      del frente decaying smooth (0.6 → 0)
  //   5. delta > BAND/2 + TRAIL        → overlay 0
  //
  // LEAD + BAND + TRAIL ≈ 8.5 unidades de grilla = ~9 filas
  // de dots lit simultáneamente. El loop es seamless porque
  // todos los dots terminan en fase 5 antes del reset.
  const overlayStyle = useAnimatedStyle(() => {
    const LEAD = 1.6;
    const BAND = 2.2;
    const TRAIL = 5;
    const w = wavePos.value;
    const delta = w - distance;

    if (delta < -LEAD) {
      return { opacity: 0 };
    }
    if (delta < -BAND / 2) {
      // Pre-lead: 0 → 0.6 lineal
      const t = (delta + LEAD) / (LEAD - BAND / 2);
      return { opacity: 0.6 * t };
    }
    if (delta <= BAND / 2) {
      // Peak: 0.6 + 0.4 * (1 - (delta/(BAND/2))²) — parabólico
      const x = delta / (BAND / 2);
      const peakBoost = 1 - x * x;
      return { opacity: 0.6 + 0.4 * peakBoost };
    }
    const past = delta - BAND / 2;
    if (past < TRAIL) {
      // Trail: 0.6 → 0 lineal (un poco más rápido al principio)
      const t = 1 - past / TRAIL;
      return { opacity: 0.6 * t };
    }
    return { opacity: 0 };
  });

  return (
    <View
      pointerEvents="none"
      style={[
        s.dot,
        {
          left: col * STRIDE,
          top: row * STRIDE,
        },
      ]}
    >
      {/* Base gris siempre visible. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: dim, borderRadius: DOT_SIZE / 2 },
        ]}
      />
      {/* Overlay del color del activo — opacity controlada por
          el wave. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: color, borderRadius: DOT_SIZE / 2 },
          overlayStyle,
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Ticker stacked: nombre arriba grande, precio abajo gris.
   * Sin variación — limpio, mismo layout que la referencia. */
  headStack: {
    flexDirection: "column",
  },
  headTicker: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  headPrice: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  /* Bloque del campo de puntitos. Centramos el grid horizontal-
   * mente, la altura la fija RIPPLE_H. Sin paddings adentro —
   * el grid ocupa todo el ancho disponible. */
  ripple: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },

  body: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  bodyMeta: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.05,
    marginBottom: 14,
  },
  bodyTitle: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.7,
  },
  section: {
    borderLeftWidth: 3,
    paddingLeft: 14,
  },
  sectionTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  sectionBody: {
    fontFamily: fontFamily[500],
    fontSize: 14.5,
    lineHeight: 22,
    letterSpacing: -0.15,
  },

  /* Feedback row al final del briefing — dos circulares en el
   * tono del activo. Outline 1.5px. Cuando uno se vota se llena
   * con el tone y el icono va en c.bg para contraste. */
  feedbackRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 32,
  },
  feedbackBtn: {
    width: 56,
    height: 56,
    borderCurve: "continuous",
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
