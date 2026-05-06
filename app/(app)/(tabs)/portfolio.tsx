import { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../../../lib/theme";
import {
  assets,
  assetCurrency,
  assetIconCode,
  formatARS,
  formatMoney,
  formatPct,
  formatQty,
  formatUSD,
  type Asset,
} from "../../../lib/data/assets";
import { convertAmount } from "../../../lib/data/accounts";
import {
  MiniSparkline,
  Sparkline,
  seriesFromSeed,
} from "../../../lib/components/Sparkline";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { GlassCard } from "../../../lib/components/GlassCard";
import { FlagIcon } from "../../../lib/components/FlagIcon";
import { Tap } from "../../../lib/components/Tap";

/**
 * Tab 'Portfolio' — vista de tus tenencias.
 *
 * Estructura:
 *   1. Hero "Tu portfolio" con balance pager ARS/USD (mismo patrón
 *      del Inicio), currency dots, delta del rango actual y label
 *      temporal.
 *   2. Sparkline + range pills (mismo set 1D/1S/1M/3M/1A/MAX que el
 *      detail de activo).
 *   3. "Tus posiciones" — GlassCard con un row por cada holding
 *      (asset.held=true, qty>0, no efectivo). El row reusa el
 *      layout del market-category.tsx pero del lado derecho muestra
 *      el VALOR DE TU TENENCIA (qty × price) y el delta de hoy en
 *      lugar del precio de mercado.
 *   4. "Resultado del día" — agregado de la pérdida/ganancia del
 *      día sumada de todos tus holdings, en ARS.
 *
 * Mock layer:
 *   - Las series del chart son procedurales (seriesFromSeed) por
 *     range — coherente con la estética del resto, sin pretender ser
 *     histórica real.
 *   - El delta del DÍA es real-ish: suma de qty × price × change/100
 *     por holding, convertido a ARS. Otros rangos son escalas
 *     determinísticas multiplicadas (mismo enfoque que detail.tsx).
 */

const ranges = ["1D", "1S", "1M", "3M", "1A", "MAX"] as const;
type Range = (typeof ranges)[number];

const LENGTH_BY_RANGE: Record<Range, number> = {
  "1D": 280,
  "1S": 200,
  "1M": 240,
  "3M": 260,
  "1A": 280,
  MAX: 300,
};

/* Multiplicador del delta por rango — el "1D" se calcula real desde
 * los holdings; el resto se mockea escalando con sign matcheado al
 * día de hoy (si tu portfolio bajó hoy, el rango más largo "muestra"
 * baja también — coherente para la demo). */
const RANGE_PCT_MULT: Record<Range, number> = {
  "1D": 1,
  "1S": 2.4,
  "1M": 4.1,
  "3M": 7.2,
  "1A": 13.4,
  MAX: 28.6,
};

function rangeSubtitle(r: Range): string {
  switch (r) {
    case "1D":
      return "hoy";
    case "1S":
      return "esta semana";
    case "1M":
      return "este mes";
    case "3M":
      return "últimos 3 meses";
    case "1A":
      return "último año";
    case "MAX":
      return "histórico";
  }
}

function indexLabel(r: Range, index: number, length: number): string {
  const t = 1 - index / (length - 1);
  switch (r) {
    case "1D": {
      const h = Math.round(t * 24);
      if (h === 0) return "ahora";
      if (h === 1) return "hace 1h";
      return `hace ${h}h`;
    }
    case "1S": {
      const d = Math.round(t * 7);
      if (d === 0) return "hoy";
      if (d === 1) return "hace 1 día";
      return `hace ${d} días`;
    }
    case "1M": {
      const d = Math.round(t * 30);
      if (d === 0) return "hoy";
      return `hace ${d} días`;
    }
    case "3M": {
      const w = Math.round(t * 13);
      if (w === 0) return "hoy";
      return `hace ${w} sem`;
    }
    case "1A": {
      const m = Math.round(t * 12);
      if (m === 0) return "hoy";
      return `hace ${m} meses`;
    }
    case "MAX": {
      const y = Math.round(t * 5);
      if (y === 0) return "este año";
      return `hace ${y} años`;
    }
  }
}

/** Construye una serie procedural alrededor de un valor target con
 *  un % de variación. Misma idea que el buildPriceSeries del detail
 *  pero sin la nivel de detalle por noise scale. */
function buildSeries(
  totalCurrent: number,
  pct: number,
  range: Range,
): number[] {
  const length = LENGTH_BY_RANGE[range];
  const start = totalCurrent / (1 + pct / 100);
  const noise = seriesFromSeed(`portfolio-${range}`, length, "flat");
  const noiseScale =
    totalCurrent *
    (range === "1D"
      ? 0.004
      : range === "1S"
        ? 0.008
        : range === "1M"
          ? 0.012
          : 0.018);
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const linear = start + (totalCurrent - start) * t;
    const normalized = (noise[i] - 100) / 6;
    out.push(linear + normalized * noiseScale);
  }
  out[length - 1] = totalCurrent;
  return out;
}

const BALANCE_PAGE_W = Dimensions.get("window").width;

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c } = useTheme();
  const [range, setRange] = useState<Range>("1D");
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const balancePagerRef = useRef<ScrollView | null>(null);

  /* ─── Data ───────────────────────────────────────────────────── */

  // Holdings = activos que tenés con qty > 0, excluyendo el efectivo
  // (eso ya vive en "Tu dinero" del Inicio).
  const holdings = useMemo(
    () =>
      assets.filter(
        (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
      ),
    [],
  );

  // Valor total en ARS de los holdings — convertimos cada uno desde
  // su moneda nativa.
  const totalArs = useMemo(() => {
    let acc = 0;
    for (const a of holdings) {
      const val = a.price * (a.qty ?? 0);
      acc += convertAmount(val, assetCurrency(a), "ARS");
    }
    return acc;
  }, [holdings]);

  // Resultado del día en ARS — qty × price × change% del activo,
  // convertido a ARS y sumado.
  const todayDeltaArs = useMemo(() => {
    let acc = 0;
    for (const a of holdings) {
      const dayDelta = a.price * (a.qty ?? 0) * (a.change / 100);
      acc += convertAmount(dayDelta, assetCurrency(a), "ARS");
    }
    return acc;
  }, [holdings]);

  // % del día agregado.
  const todayPct = totalArs > 0 ? (todayDeltaArs / totalArs) * 100 : 0;

  // % del rango activo. Para 1D usamos el real; para los demás
  // escalamos con el sign del día.
  const rangePct = useMemo(() => {
    if (range === "1D") return todayPct;
    const sign = todayPct >= 0 ? 1 : -1;
    return sign * Math.abs(todayPct) * RANGE_PCT_MULT[range];
  }, [range, todayPct]);

  // Series del chart en ARS — convertimos a USD on-display si hace
  // falta, sin recalcular.
  const seriesArs = useMemo(
    () => buildSeries(totalArs, rangePct, range),
    [totalArs, rangePct, range],
  );

  /* ─── Display values ─────────────────────────────────────────── */

  const arsCurrent =
    scrubIndex != null ? seriesArs[scrubIndex] : seriesArs[seriesArs.length - 1];
  const usdCurrent = convertAmount(arsCurrent, "ARS", "USD");

  const rangeStartArs = seriesArs[0];
  const rangeStartUsd = convertAmount(rangeStartArs, "ARS", "USD");

  const arsDelta = arsCurrent - rangeStartArs;
  const usdDelta = usdCurrent - rangeStartUsd;
  const displayPct =
    rangeStartArs > 0 ? (arsDelta / rangeStartArs) * 100 : 0;
  const isUp = displayPct >= 0;

  const chartColor = isUp ? c.greenDark : c.red;
  const trendColor = chartColor;

  const timeLabel =
    scrubIndex != null
      ? indexLabel(range, scrubIndex, seriesArs.length)
      : rangeSubtitle(range);

  /* ─── Holdings ordenados por valor desc en ARS ───────────────── */

  const holdingsSorted = useMemo(() => {
    const withVal = holdings.map((a) => {
      const native = a.price * (a.qty ?? 0);
      const ars = convertAmount(native, assetCurrency(a), "ARS");
      return { asset: a, native, ars };
    });
    return withVal.sort((x, y) => y.ars - x.ars);
  }, [holdings]);

  /* ─── Handlers ──────────────────────────────────────────────── */

  const goToCurrency = useCallback(
    (next: "ARS" | "USD") => {
      Haptics.selectionAsync().catch(() => {});
      setCurrency(next);
      balancePagerRef.current?.scrollTo({
        x: next === "ARS" ? 0 : BALANCE_PAGE_W,
        y: 0,
        animated: true,
      });
    },
    [],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Mock — en MOCK_MODE no hay nada que hacer; simulamos el delay.
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  const onScrub = useCallback((idx: number) => {
    setScrubIndex(idx);
  }, []);

  const onScrubEnd = useCallback(() => {
    setScrubIndex(null);
  }, []);

  /* ─── Render ────────────────────────────────────────────────── */

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 180,
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrubIndex == null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.textMuted}
            colors={[c.textMuted]}
            progressBackgroundColor={c.surface}
          />
        }
      >
        <View style={s.heroBlock}>
          <Text
            style={[s.portfolioTitle, { color: c.text }]}
            numberOfLines={1}
          >
            Tu portfolio
          </Text>

          {/* Balance pager — 2 páginas (ARS / USD) full-width con
              swipe nativo. Mismo pattern que el Inicio. */}
          <View style={s.balancePagerWrap}>
            <ScrollView
              ref={balancePagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="normal"
              directionalLockEnabled
              alwaysBounceVertical={false}
              bounces={false}
              contentOffset={{
                x: currency === "ARS" ? 0 : BALANCE_PAGE_W,
                y: 0,
              }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(
                  e.nativeEvent.contentOffset.x / BALANCE_PAGE_W,
                );
                const next: "ARS" | "USD" = idx === 0 ? "ARS" : "USD";
                if (next !== currency) {
                  Haptics.selectionAsync().catch(() => {});
                  setCurrency(next);
                }
              }}
            >
              {(["ARS", "USD"] as const).map((cur) => (
                <Pressable
                  key={cur}
                  style={[s.balancePage, { width: BALANCE_PAGE_W }]}
                  onPress={() =>
                    goToCurrency(cur === "ARS" ? "USD" : "ARS")
                  }
                >
                  <View style={s.flagWrap} pointerEvents="none">
                    <FlagIcon code={cur === "ARS" ? "AR" : "US"} size={26} />
                    <View
                      style={[
                        s.flagSwapBadge,
                        { backgroundColor: c.ink, borderColor: c.bg },
                      ]}
                    >
                      <Feather name="repeat" size={7} color={c.bg} />
                    </View>
                  </View>
                  <AmountDisplay
                    value={cur === "ARS" ? arsCurrent : usdCurrent}
                    size={40}
                    weight={800}
                    currency={cur}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Currency dots */}
          <View style={s.currencyDots}>
            {(["ARS", "USD"] as const).map((cur) => {
              const active = currency === cur;
              return (
                <Pressable
                  key={cur}
                  hitSlop={10}
                  onPress={() => goToCurrency(cur)}
                >
                  <View
                    style={[
                      s.currencyDot,
                      {
                        backgroundColor: active ? c.text : c.textFaint,
                        width: active ? 8 : 6,
                        height: active ? 8 : 6,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Delta row */}
          <View style={s.deltaRow}>
            <Text style={[s.deltaTri, { color: trendColor }]}>
              {isUp ? "▲" : "▼"}
            </Text>
            <Text style={[s.deltaText, { color: trendColor }]}>
              {currency === "ARS"
                ? formatARS(Math.abs(arsDelta))
                : formatUSD(Math.abs(usdDelta))}
            </Text>
            <Text style={[s.deltaSep, { color: trendColor }]}>·</Text>
            <Text style={[s.deltaText, { color: trendColor }]}>
              {formatPct(displayPct)}
            </Text>
            <Text style={[s.deltaSep, { color: c.textMuted }]}>·</Text>
            <Text style={[s.timeLabel, { color: c.textMuted }]}>
              {timeLabel}
            </Text>
          </View>

          {/* Chart */}
          <View style={s.chartWrap}>
            <Sparkline
              series={seriesArs}
              color={chartColor}
              height={220}
              mode="line"
              strokeWidth={1}
              withFill={false}
              sheen
              referenceLine
              onScrub={onScrub}
              onScrubEnd={onScrubEnd}
            />
          </View>

          {/* Range pills — mismo lenguaje que el detail (pill llena
              cuando active, color matching del chart). */}
          <View style={s.rangeRow}>
            {ranges.map((r) => {
              const active = r === range;
              return (
                <Tap
                  key={r}
                  onPress={() => setRange(r)}
                  haptic="selection"
                  pressScale={0.92}
                  style={[
                    s.rangePill,
                    active && { backgroundColor: chartColor },
                  ]}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      s.rangeText,
                      { color: active ? c.bg : chartColor },
                    ]}
                  >
                    {r}
                  </Text>
                </Tap>
              );
            })}
          </View>
        </View>

        {/* Tus posiciones */}
        <View style={[s.sectionBlock, { marginTop: 28 }]}>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: c.textMuted }]}>
              Tus posiciones
            </Text>
            <Text style={[s.sectionCount, { color: c.textFaint }]}>
              {holdingsSorted.length} activo
              {holdingsSorted.length === 1 ? "" : "s"}
            </Text>
          </View>

          {holdingsSorted.length > 0 ? (
            <GlassCard padding={4}>
              {holdingsSorted.map(({ asset, native }, i) => (
                <HoldingRow
                  key={asset.ticker}
                  asset={asset}
                  marketValueNative={native}
                  withTopDivider={i > 0}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/detail",
                      params: { ticker: asset.ticker },
                    })
                  }
                />
              ))}
            </GlassCard>
          ) : (
            <GlassCard padding={16}>
              <Text style={[s.empty, { color: c.textMuted }]}>
                Todavía no tenés posiciones. Entrá a Mercado para
                empezar a invertir.
              </Text>
            </GlassCard>
          )}
        </View>

        {/* Resultado del día */}
        <View style={[s.sectionBlock, { marginTop: 28 }]}>
          <View
            style={[
              s.resultCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.resultLabel, { color: c.textMuted }]}>
              Resultado del día
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={[
                  s.resultAmount,
                  { color: todayDeltaArs >= 0 ? c.greenDark : c.red },
                ]}
              >
                {todayDeltaArs >= 0 ? "+" : "−"}
                {formatARS(Math.abs(todayDeltaArs))}
              </Text>
              <Text
                style={[
                  s.resultPct,
                  { color: todayDeltaArs >= 0 ? c.greenDark : c.red },
                ]}
              >
                {" "}
                ({formatPct(todayPct)})
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Holding row ───────────────────────────────────────────────
 *
 * Layout copiado de la fila de market-category.tsx pero con dos
 * cambios:
 *   - El precio principal es el VALOR DE TU TENENCIA (qty × price)
 *     en moneda nativa, no el precio de mercado individual.
 *   - Bajo el valor: la cantidad de unidades + delta del día en %.
 *
 * Mantenemos el square icon, MiniSparkline central y el tap → detail.
 */
interface HoldingRowProps {
  asset: Asset;
  marketValueNative: number;
  withTopDivider: boolean;
  onPress: () => void;
}

function HoldingRow({
  asset,
  marketValueNative,
  withTopDivider,
  onPress,
}: HoldingRowProps) {
  const { c } = useTheme();
  const cur = assetCurrency(asset);
  const up = asset.change >= 0;
  const series = useMemo(
    () => seriesFromSeed(asset.ticker, 60, up ? "up" : "down"),
    [asset.ticker, up],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        withTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
        { transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <View
        style={[
          s.rowIcon,
          {
            backgroundColor:
              asset.iconTone === "dark" ? c.ink : c.surfaceSunken,
          },
        ]}
      >
        <Text
          style={[
            s.rowIconText,
            {
              color:
                asset.iconTone === "dark" ? c.bg : c.textSecondary,
            },
          ]}
        >
          {assetIconCode(asset)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTicker, { color: c.text }]}>{asset.ticker}</Text>
        <Text
          style={[s.rowSub, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {formatQty(asset.qty ?? 0)} {qtyUnit(asset)}
        </Text>
      </View>
      <View style={s.rowChart}>
        <MiniSparkline series={series} color={up ? c.greenDark : c.red} />
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.rowValue, { color: c.text }]} numberOfLines={1}>
          {formatMoney(marketValueNative, cur)}
        </Text>
        <Text
          style={[
            s.rowDelta,
            { color: up ? c.positive : c.red },
          ]}
        >
          {formatPct(asset.change)}
        </Text>
      </View>
    </Pressable>
  );
}

/* Unidad de tenencia según categoría — coincide con el qtyLabel del
 * detail.tsx pero plural simple para la subline. */
function qtyUnit(asset: Asset): string {
  switch (asset.category) {
    case "cedears":
    case "acciones":
      return "unidades";
    case "bonos":
    case "obligaciones":
    case "letras":
      return "VN";
    case "fci":
      return "cuotapartes";
    case "crypto":
      return asset.ticker;
    default:
      return "unidades";
  }
}

const s = StyleSheet.create({
  root: { flex: 1 },

  /* Hero — paddings y typography clavados al Inicio. */
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 12,
  },
  portfolioTitle: {
    fontFamily: fontFamily[800],
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -2.2,
    marginBottom: 6,
  },
  balancePagerWrap: {
    marginHorizontal: -24,
    marginBottom: 8,
  },
  balancePage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
  },
  flagWrap: {
    position: "relative",
  },
  flagSwapBadge: {
    position: "absolute",
    bottom: -3,
    right: -4,
    width: 13,
    height: 13,
    borderCurve: "continuous",
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
    paddingVertical: 4,
  },
  currencyDot: {
    borderCurve: "continuous",
    borderRadius: 999,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  deltaTri: {
    fontFamily: fontFamily[800],
    fontSize: 12,
  },
  deltaText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  deltaSep: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    opacity: 0.6,
  },
  timeLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  chartWrap: {
    marginTop: 16,
    marginHorizontal: -24,
  },

  /* Range pills — mismo look que el detail.tsx (radius pill, fill
   * cuando active, color matcheado al chart). */
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingHorizontal: 4,
  },
  rangePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: 0.3,
  },

  /* Section block container — paddingHorizontal 20 (matchea Inicio).
   * El "sectionHead" usa el mismo lenguaje que las secciones de
   * Inicio: titulo grande tipo eyebrow + count compacto a la derecha. */
  sectionBlock: {
    paddingHorizontal: 20,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontFamily[800],
    fontSize: 21,
    letterSpacing: -0.7,
    lineHeight: 24,
  },
  sectionCount: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  empty: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 8,
  },

  /* Holding row — copia del market-category.tsx con price→valor. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderCurve: "continuous",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: {
    fontFamily: fontFamily[800],
    fontSize: 13,
    letterSpacing: 0.4,
  },
  rowTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  rowChart: {
    width: 60,
    height: 28,
    marginRight: 4,
  },
  rowValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  rowDelta: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },

  /* Resultado del día — card simple, mismos paddings que las cards
   * del detail. */
  resultCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  resultAmount: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  resultPct: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.1,
  },
});
