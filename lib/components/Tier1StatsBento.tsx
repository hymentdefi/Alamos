import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { fontFamily, radius, useTheme } from "../theme";
import { Tap } from "./Tap";
import { StatInfoSheet } from "./StatInfoSheet";
import {
  computeTier1Stats,
  type Semaforo,
  type StatKey,
  type StatsRange,
  type Tier1Stats,
} from "../data/portfolioStats";
import { formatMoney, formatPct, type AssetCurrency } from "../data/assets";

interface Props {
  range: StatsRange;
  currency: "ARS" | "USD";
  /** Total invertido en moneda de display. */
  totalInvertido: number;
  /** Ganancia absoluta del período en moneda de display. */
  gananciaAbs: number;
  /** TWR pct del período (real, viene de rendimiento.tsx). */
  twrPct: number;
  /** Total ARS del portfolio (para yield TTM real). */
  totalArs: number;
  /** Convertidor ARS → display currency. */
  toDisplay: (ars: number) => number;
}

/* Color del semáforo. Verde es brand, amarillo es brand-amber custom
 * (no tenemos un token amarillo, usamos hex inline), rojo es c.red. */
function semaforoColor(s: Semaforo, c: ReturnType<typeof useTheme>["c"]) {
  if (s === "verde") return c.brand;
  if (s === "rojo") return c.red;
  return "#E8B900"; // amarillo / ámbar
}

/**
 * Tier 1 stats bento — 2×4 grid de 8 cards con las métricas principales
 * del portfolio según la spec interna (Portfolio Statistics Engine v1.0).
 *
 * Cards:
 *   1. Total invertido (Cost basis)
 *   2. Tu ganancia (MWR)
 *   3. Performance de tus activos (TWR)
 *   4. Riesgo (Volatilidad anualizada) — semáforo
 *   5. Peor caída (Max Drawdown) — semáforo
 *   6. Relación riesgo/ganancia (Sharpe) — semáforo
 *   7. vs Mercado (Alpha vs S&P 500) — semáforo
 *   8. Dividendos (Yield TTM)
 *
 * Cada card tappable abre el StatInfoSheet con la explicación retail
 * + nombre técnico. Las cards de riesgo (Vol/DD/Sharpe/Alpha) tienen
 * dot semáforo verde/amarillo/rojo. Si el range es corto (<6m), se
 * muestra badge "Datos limitados" en esas mismas.
 */
export function Tier1StatsBento({
  range,
  currency,
  totalInvertido,
  gananciaAbs,
  twrPct,
  totalArs,
  toDisplay,
}: Props) {
  const { c } = useTheme();
  const router = useRouter();
  const [openStat, setOpenStat] = useState<StatKey | null>(null);

  const stats: Tier1Stats = useMemo(
    () =>
      computeTier1Stats({
        range,
        totalInvertido,
        twrPct,
        gananciaAbs,
        totalArs,
        toDisplay,
      }),
    [range, totalInvertido, twrPct, gananciaAbs, totalArs, toDisplay],
  );

  const fmt = (n: number) => formatMoney(n, currency as AssetCurrency);

  /* Builder de cards. Cada uno declara su key, label, value primario,
   * subtexto opcional, semáforo opcional, y badge "limitado" opcional.
   * Mantener el orden acá define el orden visual del grid. */
  const cards: Array<{
    key: StatKey;
    label: string;
    primary: string;
    primaryColor?: string;
    sub?: string;
    semaforo?: Semaforo;
    limited?: boolean;
  }> = [
    {
      key: "totalInvertido",
      label: "Total invertido",
      primary: fmt(stats.totalInvertido),
    },
    {
      key: "mwr",
      label: "Tu ganancia",
      primary: `${stats.mwr.amount >= 0 ? "+" : "−"}${fmt(Math.abs(stats.mwr.amount))}`,
      primaryColor: stats.mwr.pct >= 0 ? c.brand : c.red,
      sub: formatPct(stats.mwr.pct),
    },
    {
      key: "twr",
      label: "Performance de tus activos",
      primary: formatPct(stats.twr.pct),
      primaryColor: stats.twr.pct >= 0 ? c.brand : c.red,
    },
    {
      key: "volatility",
      label: "Riesgo",
      primary: `${stats.volatility.pct.toFixed(1).replace(".", ",")}%`,
      sub:
        stats.volatility.semaforo === "verde"
          ? "bajo"
          : stats.volatility.semaforo === "amarillo"
            ? "moderado"
            : "alto",
      semaforo: stats.volatility.semaforo,
      limited: stats.limitedData,
    },
    {
      key: "maxDrawdown",
      label: "Peor caída",
      primary: `−${stats.maxDrawdown.pct.toFixed(1).replace(".", ",")}%`,
      primaryColor: c.red,
      sub:
        stats.maxDrawdown.recoveryDays > 0
          ? `${stats.maxDrawdown.date} · ${stats.maxDrawdown.recoveryDays}d`
          : stats.maxDrawdown.date,
      semaforo: stats.maxDrawdown.semaforo,
    },
    {
      key: "sharpe",
      label: "Riesgo/ganancia",
      primary: stats.sharpe.value.toFixed(2).replace(".", ","),
      sub:
        stats.sharpe.semaforo === "verde"
          ? "bueno"
          : stats.sharpe.semaforo === "amarillo"
            ? "regular"
            : "bajo",
      semaforo: stats.sharpe.semaforo,
      limited: stats.limitedData,
    },
    {
      key: "alpha",
      label: "vs Mercado",
      primary: formatPct(stats.alpha.pct),
      primaryColor: stats.alpha.pct >= 0 ? c.brand : c.red,
      sub: `S&P 500 · ${formatPct(stats.alpha.benchmarkPct)}`,
      semaforo: stats.alpha.semaforo,
      limited: stats.limitedData,
    },
    {
      key: "dividendYield",
      label: "Dividendos",
      primary: `${stats.dividendYield.pct.toFixed(2).replace(".", ",")}%`,
      sub: stats.dividendYield.cobradoYtd > 0
        ? `${fmt(stats.dividendYield.cobradoYtd)} cobrado`
        : "anual",
    },
  ];

  return (
    <View style={s.bentoCard}>
      <Text style={[s.bentoTitle, { color: c.text }]}>Estadísticas</Text>
      <View style={s.grid}>
        {cards.map((card) => {
          const dotColor = card.semaforo
            ? semaforoColor(card.semaforo, c)
            : null;
          return (
            <Tap
              key={card.key}
              onPress={() => setOpenStat(card.key)}
              haptic="selection"
              pressScale={0.97}
              style={s.card}
            >
              <View style={s.cardHeader}>
                <Text
                  style={[s.cardLabel, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {card.label}
                </Text>
                {dotColor ? (
                  <View
                    style={[s.semaforoDot, { backgroundColor: dotColor }]}
                  />
                ) : null}
              </View>
              <Text
                style={[
                  s.cardValue,
                  { color: card.primaryColor ?? c.text },
                ]}
                numberOfLines={1}
              >
                {card.primary}
              </Text>
              {card.sub ? (
                <Text
                  style={[s.cardSub, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {card.sub}
                </Text>
              ) : null}
              {card.limited ? (
                <Text style={[s.limitedBadge, { color: c.textFaint }]}>
                  Datos limitados
                </Text>
              ) : null}
            </Tap>
          );
        })}
      </View>

      {/* "Ver más estadísticas →" — link al pie del bento que abre
          la sub-pantalla de Tier 2 (/estadisticas). Pasamos el range
          actual como query param para mantener el contexto del
          usuario entre pantallas. */}
      <Tap
        onPress={() => router.push(`/estadisticas?range=${range}` as never)}
        haptic="selection"
        pressScale={0.97}
        style={[s.seeMore, { borderTopColor: c.border }]}
      >
        <Text style={[s.seeMoreText, { color: c.brand }]}>
          Ver más estadísticas
        </Text>
        <Feather name="chevron-right" size={16} color={c.brand} />
      </Tap>

      <StatInfoSheet
        statKey={openStat}
        onClose={() => setOpenStat(null)}
      />
    </View>
  );
}

const CARD_GAP = 10;

const s = StyleSheet.create({
  /* Bento card container — wrap del grid, paddings al estilo de los
   * otros cards de rendimiento.tsx pero sin background (el grid
   * tiene background interno por card). */
  bentoCard: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginTop: 16,
  },
  bentoTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
  },
  /* Card individual — 2 cols con gap, height fija para uniformidad
   * (la spec lo pide "uniforme"). Width: 48% para dejar margen del
   * gap. */
  card: {
    width: `48.5%`,
    height: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  cardLabel: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.05,
    flex: 1,
  },
  semaforoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardValue: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  cardSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },
  limitedBadge: {
    fontFamily: fontFamily[600],
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  /* CTA al pie del bento para navegar al Tier 2. */
  seeMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  seeMoreText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
