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
import { Feather, FontAwesome } from "@expo/vector-icons";
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
 * Grid fijo de 24 columnas × 15 filas. STRIDE se computa para
 * que el grid llene exactamente el ancho útil de la pantalla
 * (descontando FIELD_PAD_X de cada lado). DOT_SIZE escala con
 * STRIDE para mantener la proporción visual.
 *
 * El padding lateral (24) matchea el del body — los dots se
 * extienden hasta donde llega el texto debajo, dando feel
 * "el field cubre todo el contenido".
 */
const FIELD_PAD_X = 24;
const COLS = 24;
const ROWS = 15;
const SCREEN_W = Dimensions.get("window").width;
const STRIDE = (SCREEN_W - FIELD_PAD_X * 2) / COLS;
const DOT_SIZE = Math.max(3, Math.round(STRIDE * 0.42));
const DOT_GAP = STRIDE - DOT_SIZE;
const GRID_W = COLS * STRIDE - DOT_GAP;
const GRID_H = ROWS * STRIDE - DOT_GAP;
const RIPPLE_H = ROWS * STRIDE + 24;

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
              <FontAwesome
                name="thumbs-up"
                size={24}
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
              <FontAwesome
                name="thumbs-down"
                size={24}
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
    // Loop infinito. wavePos arranca en -3 (todos los dots
    // antes del pre-lead, overlay 0) y sube hasta maxDist + 10
    // — donde el último dot pasó por todo el trail (BAND/2 +
    // TRAIL = 2 + 8 = 10). En ese punto todos los overlays
    // están en 0 y el reset es seamless. Duration 3200ms para
    // mantener un pace razonable con el rango ampliado.
    wavePos.value = -3;
    wavePos.value = withRepeat(
      withTiming(maxDist + 10, {
        duration: 3200,
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
  // smooth alrededor del frente de onda. Rangos amplios
  // (LEAD 3 + BAND 4 + TRAIL 8 = 15 unidades de grilla
  // simultáneamente lit) para que la onda se sienta viva,
  // arrastrando luz adelante y atrás como en la referencia.
  const overlayStyle = useAnimatedStyle(() => {
    const LEAD = 3;
    const BAND = 4;
    const TRAIL = 8;
    const w = wavePos.value;
    const delta = w - distance;

    if (delta < -LEAD) {
      return { opacity: 0 };
    }
    if (delta < -BAND / 2) {
      // Pre-lead: 0 → 0.55 lineal — dots adelante del frente
      // empiezan a prenderse muy de a poco
      const t = (delta + LEAD) / (LEAD - BAND / 2);
      return { opacity: 0.55 * t };
    }
    if (delta <= BAND / 2) {
      // Peak: 0.55 + 0.45 * (1 - (delta/(BAND/2))²) — falloff
      // parabólico suave; el centro alcanza 1.0
      const x = delta / (BAND / 2);
      const peakBoost = 1 - x * x;
      return { opacity: 0.55 + 0.45 * peakBoost };
    }
    const past = delta - BAND / 2;
    if (past < TRAIL) {
      // Trail largo: 0.55 → 0 lineal
      const t = 1 - past / TRAIL;
      return { opacity: 0.55 * t };
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
