import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { fontFamily, radius, useTheme } from "../../lib/theme";
import {
  assets,
  assetCurrency,
  assetMarket,
  formatMoney,
  formatPct,
  type Asset,
} from "../../lib/data/assets";
import { convertAmount } from "../../lib/data/accounts";
import {
  Sparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";
import { AmountDisplay } from "../../lib/components/AmountDisplay";
import { Tap } from "../../lib/components/Tap";
import { AssetColorProvider } from "../../lib/asset-color/context";

/**
 * Pantalla dedicada de Rendimiento — accedida desde el arrow del
 * InfoRow del first-block del portfolio. Acá vive el detalle completo
 * de la performance histórica:
 *   - Hero metric: ganancia absoluta + % + período seleccionado.
 *   - Sparkline grande (height 180) con scrub habilitado.
 *   - Range pills 1D/1W/1M/3M/YTD/1A/MAX.
 *   - Stats grid 2×3: total invertido, YTD, mejor/peor mes, promedio
 *     mensual, días positivos.
 *
 * Mock determinístico — los rangePcts vienen de la misma tabla que
 * el portfolio (RENDIMIENTO_PCTS local). En producción vendrían del
 * server-side calc de TWR/MWR.
 */

type Currency = "ARS" | "USD";

type RendRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1A" | "MAX";

const RENDIMIENTO_RANGES: RendRange[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "YTD",
  "1A",
  "MAX",
];

const RENDIMIENTO_PCTS: Record<RendRange, number> = {
  "1D": 0.6,
  "1W": 0.6,
  "1M": 1.8,
  "3M": 4.2,
  "YTD": 8.4,
  "1A": 10.8,
  "MAX": 12.4,
};

const RENDIMIENTO_LENGTHS: Record<RendRange, number> = {
  "1D": 100,
  "1W": 70,
  "1M": 80,
  "3M": 140,
  "YTD": 220,
  "1A": 240,
  "MAX": 300,
};

function rendPeriodLabel(r: RendRange): string {
  switch (r) {
    case "1D":
      return "hoy";
    case "1W":
      return "esta semana";
    case "1M":
      return "último mes";
    case "3M":
      return "últimos 3 meses";
    case "YTD":
      return "este año";
    case "1A":
      return "último año";
    case "MAX":
      return "desde marzo 2025";
  }
}

function buildSeries(
  start: number,
  end: number,
  length: number,
  seed: string,
): number[] {
  const noise = seriesFromSeed(seed, length, "flat");
  const noiseScale = end * 0.012;
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const linear = start + (end - start) * t;
    const normalized = (noise[i] - 100) / 6;
    out.push(linear + normalized * noiseScale);
  }
  out[length - 1] = end;
  return out;
}

export default function RendimientoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [range, setRange] = useState<RendRange>("MAX");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [currency] = useState<Currency>("ARS");

  // Total ARS de los holdings (replica el cómputo del portfolio).
  const totalArs = useMemo(() => {
    const holdings = assets.filter(
      (a: Asset) =>
        a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    );
    let acc = 0;
    for (const a of holdings) {
      const native = a.price * (a.qty ?? 0);
      acc += convertAmount(native, assetCurrency(a), "ARS");
    }
    return acc;
  }, []);

  const totalDisplay =
    currency === "ARS" ? totalArs : convertAmount(totalArs, "ARS", currency);
  const rangePct = RENDIMIENTO_PCTS[range];
  const invertido = totalDisplay / (1 + rangePct / 100);

  const series = useMemo(
    () =>
      buildSeries(
        invertido,
        totalDisplay,
        RENDIMIENTO_LENGTHS[range],
        `rend-${range}-${currency}`,
      ),
    [invertido, totalDisplay, range, currency],
  );

  const current =
    scrubIndex != null ? series[scrubIndex] : series[series.length - 1];
  const startVal = series[0];
  const ganancia = current - startVal;
  const gananciaPct = startVal > 0 ? (ganancia / startVal) * 100 : 0;
  const up = ganancia >= 0;
  const color = up ? c.dataGreen : c.red;
  const fmt = (n: number) => formatMoney(n, currency);

  // Stats fijas (independientes del range).
  const stats: Array<[string, string]> = [
    ["Total invertido", fmt(invertido)],
    ["YTD", "+8,4%"],
    ["Mejor mes", "Marzo · +5,2%"],
    ["Peor mes", "Octubre · −2,1%"],
    ["Promedio mensual", "+1,3%"],
    ["Días positivos", "62%"],
  ];
  const pairs: Array<
    [(typeof stats)[number], (typeof stats)[number] | null]
  > = [];
  for (let i = 0; i < stats.length; i += 2) {
    pairs.push([stats[i], stats[i + 1] ?? null]);
  }

  // Performance attribution mock — del doc, "+18% vino de los activos,
  // +10% vino de la devaluación del peso". Educativo en AR.
  const fxAttribution = useMemo(() => {
    if (currency !== "ARS" || range === "1D") return null;
    const fxPct = rangePct * 0.4;
    const assetPct = rangePct - fxPct;
    return { fxPct, assetPct };
  }, [currency, rangePct, range]);

  return (
    <AssetColorProvider up={up}>
      <View style={[s.root, { backgroundColor: c.bg }]}>
        {/* Header — back arrow + title. Mismo lenguaje que detail.tsx */}
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
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.heroBlock}>
            <Text style={[s.eyebrow, { color: c.textMuted }]}>
              RENDIMIENTO
            </Text>

            <View style={s.heroAmountRow}>
              <Text style={[s.tri, { color }]}>{up ? "▲" : "▼"}</Text>
              <AmountDisplay
                value={Math.abs(ganancia)}
                size={42}
                color={color}
                decimalsColor={color}
                currency={currency}
              />
            </View>
            <View style={s.subRow}>
              <Text style={[s.subPct, { color }]}>
                {formatPct(gananciaPct)}
              </Text>
              <Text style={[s.subPeriod, { color: c.textMuted }]}>
                · {rendPeriodLabel(range)}
              </Text>
            </View>
          </View>

          <Sparkline
            series={series}
            color={color}
            height={200}
            mode="line"
            strokeWidth={1.6}
            sheen
            referenceLine
            style={{ marginTop: 18, marginHorizontal: 0 }}
            onScrub={(idx) => setScrubIndex(idx)}
            onScrubEnd={() => setScrubIndex(null)}
          />

          <View style={s.rangeRow}>
            {RENDIMIENTO_RANGES.map((r) => {
              const active = r === range;
              return (
                <Tap
                  key={r}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setRange(r);
                  }}
                  haptic="none"
                  pressScale={0.92}
                  style={[
                    s.rangePill,
                    active && { backgroundColor: color },
                  ]}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      s.rangeText,
                      { color: active ? c.bg : color },
                    ]}
                  >
                    {r}
                  </Text>
                </Tap>
              );
            })}
          </View>

          {/* Stats grid */}
          <View style={s.card}>
            <Text style={[s.cardEyebrow, { color: c.text }]}>
              Estadísticas
            </Text>
            {pairs.map(([left, right], i) => (
              <View
                key={i}
                style={[
                  s.statsGridRow,
                  i < pairs.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                  },
                ]}
              >
                <View style={s.statsCell}>
                  <Text
                    style={[s.statsLabel, { color: c.textMuted }]}
                  >
                    {left[0]}
                  </Text>
                  <Text
                    style={[s.statsValue, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {left[1]}
                  </Text>
                </View>
                <View style={s.statsCell}>
                  {right ? (
                    <>
                      <Text
                        style={[
                          s.statsLabel,
                          { color: c.textMuted },
                        ]}
                      >
                        {right[0]}
                      </Text>
                      <Text
                        style={[s.statsValue, { color: c.text }]}
                        numberOfLines={1}
                      >
                        {right[1]}
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {/* Performance attribution FX vs activos — el insight más
              valioso en AR según el doc. Solo aplica en ARS y en
              rangos > 1D. */}
          {fxAttribution ? (
            <View style={s.card}>
              <Text style={[s.cardEyebrow, { color: c.text }]}>
                De dónde viene
              </Text>
              <Text
                style={[s.attribBody, { color: c.textSecondary }]}
              >
                De tu rendimiento total de{" "}
                <Text style={{ color: c.dataGreen }}>
                  {formatPct(rangePct)}
                </Text>
                ,{" "}
                <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
                  {formatPct(fxAttribution.assetPct)}
                </Text>{" "}
                vino de la apreciación de tus activos y{" "}
                <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
                  {formatPct(fxAttribution.fxPct)}
                </Text>{" "}
                vino de la devaluación del peso.
              </Text>
            </View>
          ) : null}

          <Text style={[s.disclaimer, { color: c.textFaint }]}>
            Cálculo time-weighted (TWR) sobre la valuación diaria del
            portfolio. Los datos históricos son referenciales y se
            actualizan al cierre de cada rueda.
          </Text>
        </ScrollView>
      </View>
    </AssetColorProvider>
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

  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  heroAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tri: {
    fontFamily: fontFamily[700],
    fontSize: 20,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 8,
  },
  subPct: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.2,
  },
  subPeriod: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* Range pills — same que el detail.tsx */
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    paddingHorizontal: 20,
  },
  rangePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: 0.3,
  },

  /* Cards */
  card: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginTop: 16,
  },
  cardEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  statsGridRow: {
    flexDirection: "row",
    paddingVertical: 15,
    gap: 32,
  },
  statsCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statsLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  statsValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  attribBody: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
  },

  disclaimer: {
    marginTop: 24,
    marginHorizontal: 20,
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
});
