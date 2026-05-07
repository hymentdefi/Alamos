import { useEffect, useMemo } from "react";
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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, useTheme } from "../../lib/theme";
import {
  assetCurrency,
  assets,
  formatMoney,
} from "../../lib/data/assets";
import { briefingFor, formatBriefingAge } from "../../lib/data/briefings";

/* Geometría del campo de puntitos. La grilla cubre todo el ancho
 * de la pantalla (COLS auto-calculados a partir del width) y
 * tiene una altura generosa (RIPPLE_H) para que el efecto se
 * sienta cinemático.
 *
 * Stride = DOT_SIZE + DOT_GAP en cada eje.
 */
const DOT_SIZE = 5;
const DOT_GAP = 13;
const STRIDE = DOT_SIZE + DOT_GAP;
const RIPPLE_H = 320;

const SCREEN_W = Dimensions.get("window").width;
const COLS = Math.floor(SCREEN_W / STRIDE);
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
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Campo de puntitos: droplet wave ─────────────────────────
 *
 * La onda nace en (cx, cy) = centro-abajo del grid y se expande
 * en círculos concéntricos. Cada dot precomputa su distancia al
 * origen (en unidades de grilla, no px) y la usa para decidir
 * cuándo "lo cruza" la onda.
 *
 * Implementación performante: UN solo SharedValue (`wavePos`)
 * controla la animación. Cada Dot tiene su propio
 * useAnimatedStyle que lee `wavePos` y compara contra su
 * `distance` precomputada. La opacidad va:
 *   - 0  si la onda aún no llegó (wavePos < distance - BAND/2)
 *   - peak hasta 0.95 cuando la onda está cruzando el dot
 *     (band-pass: |wavePos - distance| < BAND/2)
 *   - decae a un residual (0.16) después de que la onda pasó
 * Reanimated propaga la animación en el thread UI sin tocar
 * JS — los dots responden parejo aunque el JS thread esté
 * ocupado con scroll/render.
 */
function RippleField({ color }: { color: string }) {
  const { c } = useTheme();

  // Precomputo: distancia normalizada al origen (centro-abajo)
  // para cada dot. Las diagonales de la esquina superior tardan
  // más en ser alcanzadas — ese es el feel "droplet".
  const items = useMemo(() => {
    const arr: { row: number; col: number; distance: number }[] = [];
    const cx = (COLS - 1) / 2;
    const cy = ROWS - 1; // origen abajo, centrado horizontalmente
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
    // La esquina más lejos del origen es la superior-izquierda
    // o derecha (cy hacia 0).
    return Math.sqrt(cx * cx + cy * cy);
  }, []);

  const wavePos = useSharedValue(-2);

  useEffect(() => {
    // Loop infinito.
    //
    // wavePos arranca en -1 (onda no nacida) y sube hasta
    // maxDist + 4.5 — punto en el que la onda + el trail post-
    // onda ya excedieron el grid completo, así que TODOS los
    // dots están en opacity 0. En ese momento el withRepeat
    // resetea a -1 y arranca el siguiente ciclo. Como ningún
    // dot está visible al boundary, no hay flash.
    //
    // Linear easing en lugar de out(cubic) para que el ritmo
    // del loop sea constante — un out(cubic) deceleraba al
    // final del ciclo y el loop se notaba (se sentía un
    // "stutter" antes del reset).
    wavePos.value = -1;
    wavePos.value = withRepeat(
      withTiming(maxDist + 4.5, {
        duration: 2200,
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
  wavePos: Animated.SharedValue<number>;
}

function Dot({ row, col, distance, color, wavePos }: DotProps) {
  // Worklet de UI thread — corre cada frame para cada dot. La
  // matemática es chica, escala bien aunque haya cientos de
  // dots. Cuatro fases:
  //   1. wavePos < distance - BAND/2 → onda no llegó: opacity 0
  //   2. |wavePos - distance| < BAND/2 → en la banda activa:
  //      opacity peak (con falloff lineal hacia los bordes)
  //   3. dist + BAND/2 < wavePos < dist + BAND/2 + TRAIL →
  //      trail que decae linealmente del residual a 0
  //   4. wavePos > dist + BAND/2 + TRAIL → opacity 0
  // En la fase 4 todos los dots están en 0, lo que hace el
  // boundary del loop seamless (sin flash).
  const animStyle = useAnimatedStyle(() => {
    const BAND = 1.4; // ancho de la onda en unidades de grilla
    const TRAIL = 3.5; // largo del decay post-onda
    const RESIDUAL = 0.18;
    const PEAK = 0.95;
    const w = wavePos.value;
    const delta = w - distance;
    if (delta < -BAND / 2) {
      return { opacity: 0 };
    }
    if (delta < BAND / 2) {
      // Banda activa.
      const t = 1 - Math.abs(delta) / (BAND / 2);
      return { opacity: PEAK * t + RESIDUAL * (1 - t) };
    }
    const past = delta - BAND / 2;
    if (past < TRAIL) {
      // Trail con fade lineal del residual a 0.
      return { opacity: RESIDUAL * (1 - past / TRAIL) };
    }
    return { opacity: 0 };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.dot,
        {
          left: col * STRIDE,
          top: row * STRIDE,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
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
});
