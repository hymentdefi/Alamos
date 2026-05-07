import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  InteractionManager,
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
  formatPct,
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
  const { ticker, up: upParam, pct: pctParam } = useLocalSearchParams<{
    ticker: string;
    up?: string;
    pct?: string;
  }>();

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
  // El tone + pct siguen el rango que el usuario tenía
  // seleccionado en el detail (pasados vía URL params) — no el
  // delta diario que sería sólo 1D. Así si estaba mirando 1M
  // en pérdidas, el briefing se ve rojo y muestra el % del 1M.
  const isUp =
    upParam !== undefined ? upParam === "1" : asset.change >= 0;
  const headerPct =
    pctParam !== undefined ? parseFloat(pctParam) : asset.change;
  const tone = isUp ? c.brand : c.red;
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
          <View style={s.headRow}>
            <Text style={[s.headPrice, { color: c.textMuted }]}>
              {formatMoney(asset.price, cur)}
            </Text>
            <Text style={[s.headChange, { color: tone }]}>
              {isUp ? "▲ " : "▼ "}
              {formatPct(headerPct, false)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <DeferredRippleField color={tone} />

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
                {
                  // Línea izquierda en gris neutro (c.border) para
                  // no robar protagonismo cromático al título — el
                  // tone del activo vive sólo en el título de la
                  // sección, no en el accent line.
                  borderLeftColor: c.border,
                  marginTop: i === 0 ? 24 : 22,
                },
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

/* ─── Wrapper que difiere el mount del RippleField ─────────────
 *
 * El field instancia 360 dots, cada uno con un useAnimatedStyle
 * subscribiendo a 2 shared values — eso son ~720 worklet
 * registrations al mount. Si lo renderizamos durante la
 * transición de Stack (slide_from_right), el JS thread queda
 * bloqueado ~100-200ms y la animación se siente lagueada antes
 * de aparecer la pantalla.
 *
 * InteractionManager.runAfterInteractions espera a que terminen
 * las "interacciones" en curso (que incluye animaciones de
 * navigation) y entonces dispara el callback. Con eso renderea
 * primero el header + body (livianos), después la pantalla
 * "termina de entrar", y recién ahí se montan los dots.
 *
 * Mientras los dots no están montados, dejamos un View placeholder
 * con la misma altura para que el layout no salte cuando
 * aparezcan. */
function DeferredRippleField({ color }: { color: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });
    return () => handle.cancel();
  }, []);
  if (!ready) {
    return <View style={{ height: RIPPLE_H }} />;
  }
  return <RippleField color={color} />;
}

/* ─── Campo de puntitos: droplet wave ─────────────────────────
 *
 * El field es SIEMPRE visible — los dots viven como un gris
 * constante (c.textFaint). Encima corre UNA onda que emerge
 * de centro-abajo y se expande en círculos concéntricos hacia
 * las esquinas (feel "droplet" de agua). El overlay coloreado
 * de cada dot se prende cuando la onda lo cruza, y los dots
 * lit GROW physicamente (scale hasta 1.7x) además de iluminarse
 * — eso es lo que da el feel premium vs un brillo binary.
 *
 * Per-dot jitter: cada dot le suma a su `distance` un offset
 * deterministic (basado en hash row*7+col*13) de hasta ±0.2
 * unidades. El frente de onda no es un círculo perfecto, dots
 * vecinos se prenden con micro-desfasajes → feel orgánico.
 *
 * Performance: un shared value + un useAnimatedStyle por dot
 * con math liviana. Reanimated propaga la animación en el
 * thread UI sin tocar JS.
 */
function RippleField({ color }: { color: string }) {
  const { c } = useTheme();

  const items = useMemo(() => {
    const arr: { row: number; col: number; distance: number }[] = [];
    const cx = (COLS - 1) / 2;
    const cy = ROWS - 1; // origen: centro-abajo
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const dx = col - cx;
        const dy = r - cy;
        // Jitter deterministic ±0.2 unidades.
        const seed = (r * 7 + col * 13) % 19;
        const jitter = (seed / 19 - 0.5) * 0.4;
        arr.push({
          row: r,
          col,
          distance: Math.sqrt(dx * dx + dy * dy) + jitter,
        });
      }
    }
    return arr;
  }, []);

  const maxDist = useMemo(() => {
    const cx = (COLS - 1) / 2;
    const cy = ROWS - 1;
    return Math.sqrt(cx * cx + cy * cy);
  }, []);

  const wavePos = useSharedValue(-3);

  useEffect(() => {
    // Loop infinito. wavePos arranca en -3 (todos los dots
    // antes del pre-lead) y sube hasta maxDist + 10 (cubre el
    // TRAIL completo, todos vuelven a 0 antes del reset).
    wavePos.value = -3;
    wavePos.value = withRepeat(
      withTiming(maxDist + 10, {
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
  // Worklet del overlay. La OPACITY usa una curva amplia
  // (LEAD + peak + TRAIL = ~15 grid units lit) que prende los
  // dots como halo. El SCALE usa una curva separada y más
  // angosta — sólo los dots MUY cerca del frente de onda crecen
  // hasta el max. Con falloff cuartico (1-x²)² para que el
  // peak sea afilado: pocos dots a tamaño grande, muchos al
  // tamaño normal aunque estén lit.
  //
  // Resultado: una "línea de wave" donde el frente tiene 1-2
  // dots grandes, halos alrededor con dots normales pero
  // brillando, y trail con dots fading sin crecer. Mismo feel
  // del ejemplo premium.
  const overlayStyle = useAnimatedStyle(() => {
    "worklet";
    const LEAD = 3;
    const BAND = 4;
    const TRAIL = 8;
    const SCALE_BAND = 1.2; // banda angosta para el scale
    const w = wavePos.value;
    const delta = w - distance;
    const absDelta = delta < 0 ? -delta : delta;

    // Opacity (halo amplio).
    let opacity = 0;
    if (delta < -LEAD) {
      opacity = 0;
    } else if (delta < -BAND / 2) {
      const t = (delta + LEAD) / (LEAD - BAND / 2);
      opacity = 0.55 * t;
    } else if (delta <= BAND / 2) {
      const x = delta / (BAND / 2);
      opacity = 0.55 + 0.45 * (1 - x * x);
    } else {
      const past = delta - BAND / 2;
      if (past < TRAIL) opacity = 0.55 * (1 - past / TRAIL);
    }

    // Scale (banda angosta, peak afilado).
    let peakBoost = 0;
    if (absDelta < SCALE_BAND) {
      const x = absDelta / SCALE_BAND;
      const q = 1 - x * x;
      peakBoost = q * q; // cuartico: cae rápido fuera del centro
    }
    // Crecimiento sutil para los dots con opacity alta (los del
    // halo no quedan totalmente planos), más el peak afilado
    // del wave-front.
    const scale = 1 + opacity * 0.12 + peakBoost * 0.55;

    return {
      opacity,
      transform: [{ scale }],
    };
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
  /* Row con price + variación inline. marginTop separa el ticker
   * de arriba; gap entre price y change. */
  headRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 2,
  },
  headPrice: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  headChange: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
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
