import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { fontFamily, useTheme } from "../theme";
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
  /** Color tonal — c.brand cuando el rendimiento del rango es
   *  positivo, c.red cuando es negativo. Pinta el título y los
   *  links de identidad del bento. */
  tone: string;
}

/* Color del semáforo. Verde es brand, amarillo es brand-amber custom
 * (no tenemos un token amarillo, usamos hex inline), rojo es c.red. */
function semaforoColor(s: Semaforo, c: ReturnType<typeof useTheme>["c"]) {
  if (s === "verde") return c.brand;
  if (s === "rojo") return c.red;
  return "#E8B900"; // amarillo / ámbar
}

/**
 * Tier 1 stats bento — grid 2-col con las métricas principales del
 * portfolio según la spec interna (Portfolio Statistics Engine v1.0).
 *
 * Stats (4, en 2 filas × 2 columnas):
 *   1. Total invertido (Cost basis)
 *   2. Retorno (TWR) — porcentaje
 *   3. Riesgo (Volatilidad anualizada) — semáforo
 *   4. Dividendos (Yield TTM)
 *
 * Cada celda tappable abre el StatInfoSheet con la explicación retail
 * + nombre técnico. La celda de Riesgo tiene dot semáforo
 * verde/amarillo/rojo. Si el range es corto (<6m), se
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
  tone,
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
      key: "twr",
      label: "Retorno",
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
      <Text style={[s.bentoTitle, { color: tone }]}>Estadísticas</Text>
      {/* Grid Apple/Robinhood: 4 stats en 2 filas × 2 columnas, sin
          card chrome — sólo hairlines dividiendo celdas. Vertical
          entre columnas, horizontal entre filas. Filas computadas
          a partir de cards.length para sobrevivir a stats add/remove. */}
      <View style={s.grid}>
        {Array.from(
          { length: Math.ceil(cards.length / 2) },
          (_, i) => i * 2,
        ).map((startIdx) => {
          const row = cards.slice(startIdx, startIdx + 2);
          const isLastRow = startIdx + 2 >= cards.length;
          return (
            <View
              key={startIdx}
              style={[
                s.gridRow,
                !isLastRow && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: c.border,
                },
              ]}
            >
              {row.map((card, colIdx) => {
                const dotColor = card.semaforo
                  ? semaforoColor(card.semaforo, c)
                  : null;
                return (
                  <Tap
                    key={card.key}
                    onPress={() => setOpenStat(card.key)}
                    haptic="selection"
                    pressScale={0.97}
                    style={[
                      s.gridCell,
                      colIdx === 0 ? s.gridCellLeft : s.gridCellRight,
                      colIdx === 1 && {
                        borderLeftWidth: StyleSheet.hairlineWidth,
                        borderLeftColor: c.border,
                      },
                    ]}
                  >
                    <View style={s.cellHeader}>
                      <Text
                        style={[s.cellLabel, { color: c.textMuted }]}
                        numberOfLines={1}
                      >
                        {card.label}
                      </Text>
                      {dotColor ? (
                        <View
                          style={[
                            s.semaforoDot,
                            { backgroundColor: dotColor },
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        s.cellValue,
                        { color: card.primaryColor ?? c.text },
                      ]}
                      numberOfLines={1}
                    >
                      {card.primary}
                    </Text>
                    {card.sub ? (
                      <Text
                        style={[s.cellSub, { color: c.textMuted }]}
                        numberOfLines={1}
                      >
                        {card.sub}
                      </Text>
                    ) : null}
                    {card.limited ? (
                      <Text
                        style={[s.limitedBadge, { color: c.textFaint }]}
                      >
                        Datos limitados
                      </Text>
                    ) : null}
                  </Tap>
                );
              })}
            </View>
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
        <Text style={[s.seeMoreText, { color: tone }]}>
          Ver más estadísticas
        </Text>
        <Feather name="chevron-right" size={16} color={tone} />
      </Tap>

      <StatInfoSheet
        statKey={openStat}
        onClose={() => setOpenStat(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  bentoCard: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
    marginTop: 28,
  },
  bentoTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  /* Grid Apple/Robinhood-style: 3 filas × 2 columnas, sin card
   * chrome — sólo hairlines dividiendo celdas. Cells flex 1 con
   * paddingVertical 14, paddingHorizontal asimétrico (0 hacia el
   * borde del bento, 14 hacia el divider central) para que el texto
   * de cada columna alinee con los bordes externos del bento. */
  grid: {},
  gridRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  gridCell: {
    flex: 1,
    paddingVertical: 14,
  },
  gridCellLeft: {
    paddingRight: 14,
  },
  gridCellRight: {
    paddingLeft: 14,
  },
  cellHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 6,
  },
  cellLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.15,
    flex: 1,
  },
  semaforoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cellValue: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  cellSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 3,
  },
  limitedBadge: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 4,
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
