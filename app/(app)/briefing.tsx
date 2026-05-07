import { useEffect, useMemo } from "react";
import {
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
  withDelay,
  withSequence,
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
  formatPct,
} from "../../lib/data/assets";
import { briefingFor, formatBriefingAge } from "../../lib/data/briefings";

/* Geometría del campo de puntitos del briefing.
 *   COLS / ROWS = densidad de la grilla.
 *   DOT_SIZE = tamaño del círculo en px.
 *   DOT_GAP = separación entre dots (margin layout, no padding).
 * Los valores quedaron tuned a un campo lleno-ancho que se siente
 * cinemático sin cargar al device con miles de Animated.Views. */
const COLS = 18;
const ROWS = 9;
const DOT_SIZE = 6;
const DOT_GAP = 14;

/**
 * Página completa del briefing AI. Header con close + ticker /
 * precio / variación, el campo de puntitos animado abriéndose
 * desde el centro al color del activo, y debajo el title del
 * briefing + secciones temáticas con accent-line a la izquierda.
 *
 * Stack animation: slide_from_bottom (definido en (app)/_layout).
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
            style={[s.closeBtn, { backgroundColor: c.surfaceHover }]}
            onPress={() => router.back()}
            hitSlop={10}
          >
            <Feather name="x" size={20} color={c.text} />
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
      {/* Header sticky con close a la izquierda + ticker / precio /
          variación a la derecha. Mismo gesto que mercado-cerrado:
          sin border, paddingTop con safe-area inset. */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={[s.closeBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={10}
        >
          <Feather name="x" size={20} color={c.text} />
        </Pressable>
        <View style={s.headRight}>
          <Text style={[s.headTicker, { color: c.text }]}>
            {asset.ticker}
          </Text>
          <Text style={[s.headPrice, { color: c.text }]}>
            {formatMoney(asset.price, cur)}
          </Text>
          <Text style={[s.headChange, { color: tone }]}>
            {isUp ? "▲ " : "▼ "}
            {formatPct(asset.change, false)}
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

/* ─── Campo de puntitos animado ───────────────────────────────
 *
 * Cada dot precomputa su distancia al centro y la usa como delay
 * de stagger para una entrada en olas concéntricas. Cada dot
 * vive en su propio sub-componente — los hooks de Reanimated
 * necesitan ese aislamiento (no podés iterar useSharedValue en un
 * loop). 162 instancias (18×9) corren bien en Reanimated 3 porque
 * el thread UI maneja todas las animaciones sin tocar el JS
 * thread una vez disparadas. */
function RippleField({ color }: { color: string }) {
  const { c } = useTheme();

  const items = useMemo(() => {
    const arr: { row: number; col: number; delay: number }[] = [];
    const cx = (COLS - 1) / 2;
    const cy = (ROWS - 1) / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const dx = col - cx;
        const dy = r - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / maxDist; // 0..1
        // Delay base 60ms + ramp por distancia. La onda tarda
        // ~700ms en llegar a las esquinas, después decae.
        arr.push({ row: r, col, delay: 60 + d * 700 });
      }
    }
    return arr;
  }, []);

  return (
    <View style={[s.ripple, { backgroundColor: c.bg }]}>
      <View
        style={{
          width: COLS * (DOT_SIZE + DOT_GAP) - DOT_GAP,
          height: ROWS * (DOT_SIZE + DOT_GAP) - DOT_GAP,
        }}
      >
        {items.map((it, i) => (
          <Dot
            key={i}
            row={it.row}
            col={it.col}
            delay={it.delay}
            color={color}
            dim={c.textFaint}
          />
        ))}
      </View>
    </View>
  );
}

function Dot({
  row,
  col,
  delay,
  color,
  dim,
}: {
  row: number;
  col: number;
  delay: number;
  color: string;
  dim: string;
}) {
  // Opacidad arranca en 0 (invisible). Sube a un peak (la "ola"
  // pasa por este dot) y después se asienta en un valor dim
  // residual para que el campo quede visible como background sutil.
  const opacity = useSharedValue(0);
  const colorMix = useSharedValue(0); // 0 = dim, 1 = full color

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(0.95, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0.18, {
          duration: 700,
          easing: Easing.in(Easing.quad),
        }),
      ),
    );
    colorMix.value = withDelay(
      delay,
      withSequence(
        withTiming(1, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0.6, {
          duration: 700,
          easing: Easing.in(Easing.quad),
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay]);

  // El fondo del dot se interpola entre el dim color (gris faint
  // del theme) y el color del activo según colorMix. Evitamos
  // interpolateColor para no agregar otra dependencia — usamos
  // dos Views apiladas con opacities cruzadas en su lugar.
  const animDim = useAnimatedStyle(() => ({
    opacity: opacity.value * (1 - colorMix.value),
  }));
  const animTone = useAnimatedStyle(() => ({
    opacity: opacity.value * colorMix.value,
  }));

  return (
    <View
      pointerEvents="none"
      style={[
        s.dot,
        {
          left: col * (DOT_SIZE + DOT_GAP),
          top: row * (DOT_SIZE + DOT_GAP),
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: dim, borderRadius: DOT_SIZE / 2 },
          animDim,
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: color, borderRadius: DOT_SIZE / 2 },
          animTone,
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  headTicker: {
    fontFamily: fontFamily[800],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  headPrice: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
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
   * mente y le damos padding vertical generoso para que tenga
   * presencia "cinemática" arriba del texto. */
  ripple: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    marginHorizontal: 4,
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
  /* Cada section va con una línea izquierda en el color del
   * activo + título en el mismo color + body en textSecondary.
   * Padding horizontal da el offset de la línea al texto. */
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
