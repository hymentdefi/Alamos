import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { fontFamily, radius, useTheme } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import {
  computeFactorExposure,
  factorTiltLabel,
  FACTOR_EXPLANATIONS,
  FACTOR_LABELS,
  FACTOR_TECHNICAL,
  type FactorKey,
} from "../../lib/data/portfolioStats";

/**
 * ADN de tu portfolio — pantalla del Factor Exposure Analysis
 * (spec sección 6). Descompone el portfolio en 6 factores
 * académicos: Value, Momentum, Quality, Size, Low Volatility,
 * Yield.
 *
 * Visual: barras horizontales (alternativa mobile per spec 6.3)
 * en vez de radar chart spider. Cada barra:
 *   - Label retail ("Empresas baratas") + nombre técnico ("Value")
 *   - Score 0-100 destacado a la derecha
 *   - Bar track 0-100 con marker de benchmark en 50 (línea
 *     vertical) + portfolio score como fill brand
 *   - Qualifier retail abajo ("Exposición alta", "Cerca del
 *     benchmark", etc.) + frase explicativa del factor
 *
 * Spec 6.4: nunca decir "Factor Exposure" en la UI. El label es
 * "ADN de tu portfolio".
 */

const FACTORS_ORDER: FactorKey[] = [
  "momentum",
  "quality",
  "value",
  "yield",
  "lowVol",
  "size",
];

export default function AdnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const scores = useMemo(() => computeFactorExposure(), []);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Tap
          onPress={() => router.back()}
          haptic="selection"
          hitSlop={12}
          style={s.iconBtn}
        >
          <Feather name="arrow-left" size={24} color={c.text} />
        </Tap>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.title, { color: c.brand }]}>ADN</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          Analizamos las características principales de tus
          inversiones según distintos factores.
        </Text>

        <View style={s.factorsWrap}>
          {FACTORS_ORDER.map((key, i) => (
            <FactorRow
              key={key}
              factorKey={key}
              score={scores[key]}
              isLast={i === FACTORS_ORDER.length - 1}
              c={c}
            />
          ))}
        </View>

        <View style={s.disclaimerWrap}>
          <Text style={[s.disclaimer, { color: c.textFaint }]}>
            Los scores se computan como promedio ponderado de los
            atributos de cada activo del portfolio. El benchmark es
            el universo de referencia (S&P 500 para US, S&P MERVAL
            para AR). Score 50 = neutral.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── FactorRow ──────────────────────────────────────────────── */
function FactorRow({
  factorKey,
  score,
  isLast,
  c,
}: {
  factorKey: FactorKey;
  score: number;
  isLast: boolean;
  c: ReturnType<typeof useTheme>["c"];
}) {
  const { qualifier, direction } = factorTiltLabel(score);
  const scoreInt = Math.round(score);

  /* Score color: brand para tilt positivo (= 70+), text para
   * neutral, c.red para tilt fuerte negativo. */
  const scoreColor =
    direction === "positivo"
      ? c.brand
      : direction === "negativo" && score < 30
        ? c.red
        : c.text;

  return (
    <View
      style={[
        s.factorRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={s.factorHeader}>
        <View style={s.factorLabelWrap}>
          <Text style={[s.factorLabel, { color: c.text }]}>
            {FACTOR_LABELS[factorKey]}
          </Text>
          <Text style={[s.factorTech, { color: c.textMuted }]}>
            {FACTOR_TECHNICAL[factorKey]}
          </Text>
        </View>
        <Text
          style={[s.factorScore, { color: scoreColor }]}
          numberOfLines={1}
        >
          {scoreInt}
        </Text>
      </View>

      {/* Bar track 0-100 con marker en 50 (benchmark) y fill
          brand desde 0 hasta el score. */}
      <View style={[s.barTrack, { backgroundColor: c.surfaceHover }]}>
        <View
          style={[
            s.barFill,
            {
              width: `${Math.max(0, Math.min(100, score))}%`,
              backgroundColor: c.brand,
            },
          ]}
        />
        <View
          style={[
            s.benchmarkMarker,
            { backgroundColor: c.textMuted },
          ]}
        />
      </View>

      <Text
        style={[s.factorQualifier, { color: c.textSecondary }]}
        numberOfLines={1}
      >
        {qualifier}
      </Text>
      <Text style={[s.factorExplanation, { color: c.textMuted }]}>
        {FACTOR_EXPLANATIONS[factorKey]}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    paddingHorizontal: 24,
    marginTop: 6,
    marginBottom: 16,
  },

  factorsWrap: {
    paddingHorizontal: 24,
  },
  factorRow: {
    paddingVertical: 18,
  },
  factorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  factorLabelWrap: {
    flex: 1,
    minWidth: 0,
  },
  factorLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  factorTech: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  factorScore: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
  },

  barTrack: {
    height: 8,
    borderCurve: "continuous",
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
    marginBottom: 10,
  },
  barFill: {
    height: "100%",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  /* Línea vertical en 50% del track — marca el benchmark. */
  benchmarkMarker: {
    position: "absolute",
    left: "50%",
    top: -2,
    bottom: -2,
    width: 1.5,
    opacity: 0.6,
  },

  factorQualifier: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  factorExplanation: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.05,
  },

  disclaimerWrap: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  disclaimer: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: -0.05,
  },
});
