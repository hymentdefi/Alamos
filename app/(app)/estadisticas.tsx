import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { fontFamily, radius, useTheme } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import { StatInfoSheet } from "../../lib/components/StatInfoSheet";
import {
  computeTier2Stats,
  type Semaforo,
  type StatKey,
  type StatsRange,
} from "../../lib/data/portfolioStats";
import {
  formatMoney,
  formatPct,
  type AssetCurrency,
} from "../../lib/data/assets";
import { convertAmount } from "../../lib/data/accounts";

/**
 * Estadísticas — sub-pantalla del Rendimiento. Acá vive el Tier 2 de
 * la Portfolio Statistics Engine: las métricas que un retail premium
 * quiere mirar cuando entra a profundizar. Accesible vía el "Ver más
 * estadísticas →" del Tier1StatsBento.
 *
 * Estructura:
 *   - Top bar (back arrow)
 *   - Title "Estadísticas" h1
 *   - Period pills globales (sync con el range que viene del caller)
 *   - 5 sub-secciones:
 *       1. Rendimiento por período (tabla TWR + MWR)
 *       2. Riesgo ajustado (Sortino + Calmar + Beta)
 *       3. vs Mercado (Up-Capture + Down-Capture)
 *       4. Composición (Posiciones efectivas + Top-5 concentración)
 *       5. Income breakdown (cupones / dividendos / amortizaciones /
 *          forward 12M)
 *
 * Cada métrica tappable abre el StatInfoSheet genérico con la entrada
 * correspondiente de STAT_INFO.
 */

type RangePill = StatsRange;

const RANGES: RangePill[] = ["1D", "1W", "1M", "3M", "YTD", "1A", "MAX"];

type Currency = "ARS" | "USD";

function semaforoColor(s: Semaforo, c: ReturnType<typeof useTheme>["c"]) {
  if (s === "verde") return c.brand;
  if (s === "rojo") return c.red;
  return "#E8B900";
}

export default function EstadisticasScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ range?: string }>();
  /* El range viene como query param del caller (Rendimiento). Si no
   * matchea, default a 1A — el horizonte natural para Tier 2 (las
   * métricas más sensibles a histórico corto). */
  const initialRange: RangePill =
    RANGES.includes(params.range as RangePill)
      ? (params.range as RangePill)
      : "1A";
  const [range, setRange] = useState<RangePill>(initialRange);
  const [currency] = useState<Currency>("ARS");
  const [openStat, setOpenStat] = useState<StatKey | null>(null);

  const toDisplay = useMemo(
    () =>
      (ars: number) =>
        currency === "ARS" ? ars : convertAmount(ars, "ARS", currency),
    [currency],
  );

  const stats = useMemo(
    () => computeTier2Stats(range, toDisplay),
    [range, toDisplay],
  );

  const fmt = (n: number) => formatMoney(n, currency as AssetCurrency);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Top bar */}
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
        <Text style={[s.title, { color: c.text }]}>Estadísticas</Text>

        {/* Period pills — globales, recalculan todas las métricas. */}
        <View style={s.rangeRow}>
          {RANGES.map((r) => {
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
                  active && { backgroundColor: c.brand },
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    s.rangeText,
                    { color: active ? c.onColor : c.textMuted },
                  ]}
                >
                  {r}
                </Text>
              </Tap>
            );
          })}
        </View>

        {/* ─── Sub-sección 1: Rendimiento por período ───────────── */}
        <View style={s.section}>
          {/* Header tappable: solo el título + info icon abre el
              sheet, no la tabla entera (escalar 1 fila vs 7 filas
              se sentía raro). */}
          <Tap
            onPress={() => setOpenStat("returnsByPeriod")}
            haptic="selection"
            pressScale={0.97}
            hitSlop={6}
            style={s.sectionHeaderRow}
          >
            <Text style={[s.sectionTitleInline, { color: c.text }]}>
              Rendimiento por período
            </Text>
            <Feather name="info" size={15} color={c.brand} />
          </Tap>
          <View style={s.tableHeader}>
            <Text
              style={[s.tableHeaderCell, s.tableHeaderPeriod, { color: c.textMuted }]}
            >
              Período
            </Text>
            <Text
              style={[s.tableHeaderCell, { color: c.textMuted }]}
            >
              TWR
            </Text>
            <Text
              style={[s.tableHeaderCell, { color: c.textMuted }]}
            >
              MWR
            </Text>
          </View>
          {stats.returnsByPeriod.map((row, i, arr) => (
            <View
              key={row.period}
              style={[
                s.tableRow,
                i < arr.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: c.border,
                },
              ]}
            >
              <Text
                style={[s.tableCell, s.tablePeriod, { color: c.text }]}
              >
                {row.period}
              </Text>
              <Text
                style={[
                  s.tableCell,
                  { color: row.twr >= 0 ? c.brand : c.red },
                ]}
              >
                {formatPct(row.twr)}
              </Text>
              <Text
                style={[
                  s.tableCell,
                  { color: row.mwr >= 0 ? c.brand : c.red },
                ]}
              >
                {formatPct(row.mwr)}
              </Text>
            </View>
          ))}
        </View>

        {/* ─── Sub-sección 2: Riesgo ajustado ──────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            Riesgo ajustado
          </Text>
          <StatRow
            statKey="sortino"
            label="Sortino"
            value={stats.sortino.value.toFixed(2).replace(".", ",")}
            sub="ganancia por riesgo de pérdida"
            semaforo={stats.sortino.semaforo}
            onPress={() => setOpenStat("sortino")}
            c={c}
            isLast={false}
          />
          <StatRow
            statKey="calmar"
            label="Calmar"
            value={stats.calmar.value.toFixed(2).replace(".", ",")}
            sub="ganancia vs peor caída"
            semaforo={stats.calmar.semaforo}
            onPress={() => setOpenStat("calmar")}
            c={c}
            isLast={false}
          />
          <StatRow
            statKey="beta"
            label="Beta"
            value={stats.beta.value.toFixed(2).replace(".", ",")}
            sub={`sensibilidad al S&P 500`}
            semaforo={stats.beta.semaforo}
            onPress={() => setOpenStat("beta")}
            c={c}
            isLast={true}
          />
        </View>

        {/* ─── Sub-sección 3: vs Mercado ───────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            vs Mercado
          </Text>
          <StatRow
            statKey="upCapture"
            label="Captura de subas"
            value={`${stats.upCapture.pct.toFixed(0)}%`}
            sub={
              stats.upCapture.pct > 100
                ? "ganás más que el mercado en buenos momentos"
                : "ganás menos que el mercado en buenos momentos"
            }
            valueColor={stats.upCapture.pct >= 100 ? c.brand : c.text}
            onPress={() => setOpenStat("upCapture")}
            c={c}
            isLast={false}
          />
          <StatRow
            statKey="downCapture"
            label="Captura de bajas"
            value={`${stats.downCapture.pct.toFixed(0)}%`}
            sub={
              stats.downCapture.pct < 100
                ? "perdés menos que el mercado en malos momentos"
                : "perdés más que el mercado en malos momentos"
            }
            valueColor={stats.downCapture.pct < 100 ? c.brand : c.red}
            onPress={() => setOpenStat("downCapture")}
            c={c}
            isLast={true}
          />
        </View>

        {/* ─── Sub-sección 4: Composición ──────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            Composición
          </Text>
          <StatRow
            statKey="posicionesEfectivas"
            label="Posiciones efectivas"
            value={stats.posicionesEfectivas.value
              .toFixed(1)
              .replace(".", ",")}
            sub="qué tan diversificado estás"
            semaforo={stats.posicionesEfectivas.semaforo}
            onPress={() => setOpenStat("posicionesEfectivas")}
            c={c}
            isLast={false}
          />
          <StatRow
            statKey="concentracionTop5"
            label="Top 5 concentra"
            value={`${stats.concentracionTop5.pct.toFixed(0)}%`}
            sub="del portfolio en tus 5 posiciones más grandes"
            semaforo={stats.concentracionTop5.semaforo}
            onPress={() => setOpenStat("concentracionTop5")}
            c={c}
            isLast={true}
          />
        </View>

        {/* ─── Sub-sección 5: Income breakdown ─────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>
            Ingresos del año
          </Text>
          <StatRow
            statKey="cupones"
            label="Cupones"
            value={fmt(stats.income.cupones)}
            sub="intereses de bonos"
            onPress={() => setOpenStat("cupones")}
            c={c}
            isLast={false}
          />
          <StatRow
            statKey="dividendos"
            label="Dividendos"
            value={fmt(stats.income.dividendos)}
            sub="de acciones y CEDEARs"
            onPress={() => setOpenStat("dividendos")}
            c={c}
            isLast={false}
          />
          <StatRow
            statKey="amortizaciones"
            label="Amortizaciones"
            value={fmt(stats.income.amortizaciones)}
            sub="devolución de capital"
            onPress={() => setOpenStat("amortizaciones")}
            c={c}
            isLast={false}
          />
          <StatRow
            statKey="forward12M"
            label="Proyectado 12M"
            value={fmt(stats.income.forward12M)}
            sub="estimación de cobros próximo año"
            valueColor={c.brand}
            onPress={() => setOpenStat("forward12M")}
            c={c}
            isLast={true}
          />
        </View>
      </ScrollView>

      <StatInfoSheet
        statKey={openStat}
        onClose={() => setOpenStat(null)}
      />
    </View>
  );
}

/* ─── StatRow: fila genérica para Tier 2 ─────────────────────────
 * Label izquierda + valor a la derecha + sub-texto debajo del label +
 * dot semáforo opcional al lado del valor. Hairline divider salvo en
 * la última. Tap a la fila abre el StatInfoSheet correspondiente. */
function StatRow({
  label,
  value,
  sub,
  semaforo,
  valueColor,
  onPress,
  c,
  isLast,
}: {
  statKey: StatKey;
  label: string;
  value: string;
  sub?: string;
  semaforo?: Semaforo;
  valueColor?: string;
  onPress: () => void;
  c: ReturnType<typeof useTheme>["c"];
  isLast: boolean;
}) {
  const dotColor = semaforo ? semaforoColor(semaforo, c) : null;
  return (
    <Tap
      onPress={onPress}
      haptic="selection"
      pressScale={0.98}
      style={[
        s.statRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={s.statRowLeft}>
        <Text style={[s.statLabel, { color: c.text }]}>{label}</Text>
        {sub ? (
          <Text style={[s.statSub, { color: c.textMuted }]} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={s.statRowRight}>
        <Text
          style={[s.statValue, { color: valueColor ?? c.text }]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {dotColor ? (
          <View style={[s.statDot, { backgroundColor: dotColor }]} />
        ) : null}
      </View>
    </Tap>
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
    marginBottom: 18,
  },

  /* Range pills — mismo lenguaje que el resto de la app. */
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    marginBottom: 8,
  },
  rangePill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderCurve: "continuous",
    borderRadius: radius.md,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
  },

  /* Sub-section card. Padding/margin iguales al lenguaje de
   * rendimiento.tsx y los otros cards. */
  section: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  /* Title cuando vive standalone (sin info icon a la derecha). */
  sectionTitle: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  /* Title cuando vive dentro de sectionHeaderRow (con info icon).
   * Sin marginBottom porque el padre se encarga del spacing. */
  sectionTitleInline: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    letterSpacing: -0.4,
  },

  /* Tabla rendimiento por período. */
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
    marginBottom: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    textAlign: "right",
  },
  tableHeaderPeriod: {
    textAlign: "left",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  tableCell: {
    flex: 1,
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
    textAlign: "right",
  },
  tablePeriod: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    textAlign: "left",
    letterSpacing: 0.3,
  },

  /* StatRow genérico. */
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  statRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  statSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  statRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statValue: {
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.3,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
