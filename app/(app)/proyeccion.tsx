import { useMemo, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, { Path, Line } from "react-native-svg";

import { fontFamily, radius, useTheme } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import {
  computeTotalArs,
  getTier1Stats,
  simulateMonteCarlo,
  type MonteCarloPoint,
} from "../../lib/data/portfolioStats";
import { formatMoney, type AssetCurrency } from "../../lib/data/assets";
import { convertAmount } from "../../lib/data/accounts";

/**
 * Proyección de tu portfolio — pantalla del Monte Carlo. Spec 5
 * pide fan chart con bandas de probabilidad (P10/P25/P50/P75/P90)
 * por mes. Acá se muestra:
 *
 *   - Hero con la mediana proyectada a horizonte (default 10 años).
 *   - Fan chart 320pt: 2 bandas (P10–P25–P50–P75–P90) en brand-tint,
 *     línea P50 (mediana) en brand sólido.
 *   - Range pills de horizonte (3A / 5A / 10A / 20A).
 *   - Resumen P10 / P50 / P90 al pie.
 *   - 3 disclaimers obligatorios de la spec sección 5.6.
 *
 * Spec 5.5: nunca decir "Monte Carlo" en la UI. El label es
 * "Proyección de tu portfolio". El nombre técnico vive como TODO
 * footnote en el info sheet (futuro).
 */

const HORIZONS = [3, 5, 10, 20] as const;
type Horizon = (typeof HORIZONS)[number];

type Currency = "ARS" | "USD";

const CHART_W = Dimensions.get("window").width - 48; // padding
const CHART_H = 240;
const PAD = { top: 12, right: 6, bottom: 8, left: 6 };

export default function ProyeccionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [horizon, setHorizon] = useState<Horizon>(10);
  const [currency] = useState<Currency>("ARS");

  const toDisplay = useMemo(
    () =>
      (ars: number) =>
        currency === "ARS" ? ars : convertAmount(ars, "ARS", currency),
    [currency],
  );

  /* Necesitamos tier1 para μ y σ — pero tier1 viene parametrizado
   * por range. Para Monte Carlo usamos el horizonte largo (MAX) que
   * tiene las mejores estimaciones anualizadas. */
  const tier1Max = useMemo(
    () => getTier1Stats("MAX", toDisplay),
    [toDisplay],
  );

  const currentValue = useMemo(
    () => toDisplay(computeTotalArs()),
    [toDisplay],
  );

  const mc = useMemo(
    () =>
      simulateMonteCarlo({
        initialValue: currentValue,
        horizonYears: horizon,
        annualReturn: tier1Max.twr.pct, // ya anualizado en MAX
        annualVol: tier1Max.volatility.pct,
        seed: `mc-h${horizon}`,
      }),
    [currentValue, horizon, tier1Max.twr.pct, tier1Max.volatility.pct],
  );

  const fmt = (n: number) => formatMoney(n, currency as AssetCurrency);

  /* Compute SVG paths for the fan chart bands + median line. */
  const chart = useMemo(
    () => buildFanChart(mc.points, CHART_W, CHART_H, PAD),
    [mc.points],
  );

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
        <Text style={[s.title, { color: c.text }]}>Proyección</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          Simulamos miles de escenarios posibles para estimar cómo
          podría crecer tu portfolio.
        </Text>

        {/* Hero: median final value at horizon */}
        <View style={s.hero}>
          <Text style={[s.heroLabel, { color: c.textMuted }]}>
            En {horizon} años, tu portfolio podría valer
          </Text>
          <Text style={[s.heroValue, { color: c.brand }]}>
            {fmt(mc.medianFinal)}
          </Text>
          <Text style={[s.heroSub, { color: c.textMuted }]}>
            mediana de la proyección. Hoy vale{" "}
            <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
              {fmt(currentValue)}
            </Text>
            .
          </Text>
        </View>

        {/* Fan chart */}
        <View style={s.chartWrap}>
          <Svg width={CHART_W} height={CHART_H}>
            {/* Outer band P10–P25 */}
            <Path d={chart.outerLowerBand} fill={c.brand} fillOpacity={0.1} />
            {/* Inner band P25–P50 */}
            <Path
              d={chart.innerLowerBand}
              fill={c.brand}
              fillOpacity={0.22}
            />
            {/* Inner band P50–P75 */}
            <Path
              d={chart.innerUpperBand}
              fill={c.brand}
              fillOpacity={0.22}
            />
            {/* Outer band P75–P90 */}
            <Path d={chart.outerUpperBand} fill={c.brand} fillOpacity={0.1} />
            {/* Median line P50 */}
            <Path
              d={chart.medianLine}
              stroke={c.brand}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            {/* Baseline (initial value) */}
            <Line
              x1={PAD.left}
              y1={chart.baselineY}
              x2={CHART_W - PAD.right}
              y2={chart.baselineY}
              stroke={c.border}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          </Svg>
        </View>

        {/* Horizon pills */}
        <View style={s.horizonRow}>
          {HORIZONS.map((h) => {
            const active = h === horizon;
            return (
              <Tap
                key={h}
                onPress={() => setHorizon(h)}
                haptic="selection"
                pressScale={0.92}
                style={[
                  s.horizonPill,
                  active && { backgroundColor: c.brand },
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    s.horizonText,
                    { color: active ? c.onColor : c.textMuted },
                  ]}
                >
                  {h}A
                </Text>
              </Tap>
            );
          })}
        </View>

        {/* P10 / P50 / P90 summary */}
        <View style={s.summary}>
          <Text style={[s.summaryTitle, { color: c.text }]}>
            Escenarios proyectados
          </Text>
          <ScenarioRow
            label="Pesimista"
            sub="solo 10% de los escenarios fue peor"
            value={fmt(mc.pessimisticFinal)}
            color={c.text}
            c={c}
            isLast={false}
          />
          <ScenarioRow
            label="Mediana"
            sub="el resultado más probable"
            value={fmt(mc.medianFinal)}
            color={c.brand}
            c={c}
            isLast={false}
          />
          <ScenarioRow
            label="Optimista"
            sub="solo 10% de los escenarios fue mejor"
            value={fmt(mc.optimisticFinal)}
            color={c.text}
            c={c}
            isLast={true}
          />
        </View>

        {/* Disclaimers obligatorios spec 5.6 */}
        <View style={s.disclaimerWrap}>
          <Text style={[s.disclaimer, { color: c.textFaint }]}>
            Esta proyección se basa en datos históricos y no garantiza
            resultados futuros. Los escenarios simulados asumen que la
            distribución de retornos pasados se repite, lo cual puede
            no ocurrir. Cambios en tu portfolio, en el mercado o en la
            economía pueden alterar significativamente los resultados.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── ScenarioRow: pesimista / mediana / optimista ─────────────── */
function ScenarioRow({
  label,
  sub,
  value,
  color,
  c,
  isLast,
}: {
  label: string;
  sub: string;
  value: string;
  color: string;
  c: ReturnType<typeof useTheme>["c"];
  isLast: boolean;
}) {
  return (
    <View
      style={[
        s.scenarioRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={s.scenarioLeft}>
        <Text style={[s.scenarioLabel, { color: c.text }]}>{label}</Text>
        <Text style={[s.scenarioSub, { color: c.textMuted }]}>{sub}</Text>
      </View>
      <Text style={[s.scenarioValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ─── Fan chart builder ───────────────────────────────────────── */
function buildFanChart(
  points: MonteCarloPoint[],
  w: number,
  h: number,
  pad: { top: number; right: number; bottom: number; left: number },
) {
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const n = points.length;

  /* Min/max para el viewport: usamos P10 y P90 como bounds + un
   * pequeño margen para que las líneas no toquen los bordes. */
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of points) {
    if (p.p10 < yMin) yMin = p.p10;
    if (p.p90 > yMax) yMax = p.p90;
  }
  const yRange = yMax - yMin || 1;
  const yMinPad = yMin - yRange * 0.05;
  const yMaxPad = yMax + yRange * 0.05;
  const yRangePad = yMaxPad - yMinPad;

  const xAt = (i: number) => pad.left + (i / (n - 1)) * innerW;
  const yAt = (v: number) =>
    pad.top + innerH - ((v - yMinPad) / yRangePad) * innerH;

  /* Build path connecting (i, value) for each point. */
  const linePath = (values: number[]): string =>
    values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`)
      .join(" ");

  /* Build a closed band between upper and lower percentile arrays. */
  const bandPath = (upper: number[], lower: number[]): string => {
    const fwd = upper
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`)
      .join(" ");
    const back = lower
      .slice()
      .reverse()
      .map((v, idx) => `L ${xAt(n - 1 - idx)} ${yAt(v)}`)
      .join(" ");
    return `${fwd} ${back} Z`;
  };

  const p10 = points.map((p) => p.p10);
  const p25 = points.map((p) => p.p25);
  const p50 = points.map((p) => p.p50);
  const p75 = points.map((p) => p.p75);
  const p90 = points.map((p) => p.p90);

  return {
    outerLowerBand: bandPath(p25, p10),
    innerLowerBand: bandPath(p50, p25),
    innerUpperBand: bandPath(p75, p50),
    outerUpperBand: bandPath(p90, p75),
    medianLine: linePath(p50),
    baselineY: yAt(points[0].p50), // initial value baseline
  };
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
    marginBottom: 24,
  },

  hero: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  heroLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.05,
  },
  heroValue: {
    fontFamily: fontFamily[800],
    fontSize: 38,
    letterSpacing: -1.4,
    marginTop: 6,
  },
  heroSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.05,
    marginTop: 6,
  },

  chartWrap: {
    paddingHorizontal: 24,
    marginBottom: 10,
  },

  horizonRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  horizonPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderCurve: "continuous",
    borderRadius: radius.md,
  },
  horizonText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: 0.4,
  },

  summary: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 8,
  },
  summaryTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  scenarioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 16,
  },
  scenarioLeft: {
    flex: 1,
    minWidth: 0,
  },
  scenarioLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  scenarioSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  scenarioValue: {
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.3,
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
