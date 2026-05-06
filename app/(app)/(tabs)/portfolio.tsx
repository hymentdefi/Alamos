import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../../../lib/theme";
import {
  assets,
  assetCurrency,
  assetIconCode,
  assetMarket,
  categoryLabels,
  formatARS,
  formatMoney,
  formatPct,
  formatQty,
  type Asset,
  type AssetCategory,
} from "../../../lib/data/assets";
import { convertAmount } from "../../../lib/data/accounts";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../../lib/components/Sparkline";
import { GlassCard } from "../../../lib/components/GlassCard";
import {
  MarketSegmented,
  type MarketSegmentedValue,
} from "../../../lib/components/MarketSegmented";

/**
 * Tab 'Portfolio' — vista enfocada en tus tenencias.
 *
 * Sin hero de balance ni chart: el usuario quiere ver directo el
 * filtro de mercado y la lista de posiciones. Layout:
 *   1. Header fijo (mismo layout que Mercado): title "Portfolio" +
 *      MarketSegmented (AR / EE.UU / Crypto + tab "Todo" extra al
 *      principio con el isotipo Alamos como flag).
 *   2. ScrollView debajo: GlassCard con un row por holding, después
 *      el card de "Resultado del día".
 *
 * El segmented filtra los holdings — "Todo" muestra todos, AR/US/CRYPTO
 * filtran por `assetMarket(asset)`. El "Resultado del día" se computa
 * sobre el subset filtrado para que sea consistente con la lista.
 */

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c } = useTheme();
  const [marketFilter, setMarketFilter] =
    useState<MarketSegmentedValue>("all");
  const [refreshing, setRefreshing] = useState(false);

  /* ─── Holdings filtrados por el segmented ───────────────────── */

  const holdings = useMemo(() => {
    const all = assets.filter(
      (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    );
    if (marketFilter === "all") return all;
    return all.filter((a) => assetMarket(a) === marketFilter);
  }, [marketFilter]);

  const holdingsSorted = useMemo(() => {
    const withVal = holdings.map((a) => {
      const native = a.price * (a.qty ?? 0);
      const ars = convertAmount(native, assetCurrency(a), "ARS");
      return { asset: a, native, ars };
    });
    return withVal.sort((x, y) => y.ars - x.ars);
  }, [holdings]);

  const totalArs = useMemo(
    () => holdingsSorted.reduce((acc, h) => acc + h.ars, 0),
    [holdingsSorted],
  );

  const todayDeltaArs = useMemo(() => {
    let acc = 0;
    for (const a of holdings) {
      const dayDelta = a.price * (a.qty ?? 0) * (a.change / 100);
      acc += convertAmount(dayDelta, assetCurrency(a), "ARS");
    }
    return acc;
  }, [holdings]);

  const todayPct = totalArs > 0 ? (todayDeltaArs / totalArs) * 100 : 0;

  /* ─── Handlers ──────────────────────────────────────────────── */

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Mock — en MOCK_MODE no hay nada que hacer; simulamos el delay.
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  /* ─── Render ────────────────────────────────────────────────── */

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header fijo — clavado a la altura del header de Mercado para
          que el MarketSegmented quede en el mismo Y de pantalla. */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: c.text }]}>Portfolio</Text>
        </View>
        <MarketSegmented
          value={marketFilter}
          onChange={setMarketFilter}
          withAll
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
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
        {holdingsSorted.length > 0 && totalArs > 0 ? (
          <View style={[s.sectionBlock, { marginBottom: 28 }]}>
            <View style={s.sectionHead}>
              <Text style={[s.sectionTitle, { color: c.textMuted }]}>
                Distribución
              </Text>
            </View>
            <AllocationChart
              holdings={holdingsSorted}
              totalArs={totalArs}
            />
          </View>
        ) : null}

        <View style={s.sectionBlock}>
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
                {marketFilter === "all"
                  ? "Todavía no tenés posiciones. Entrá a Mercado para empezar a invertir."
                  : "No tenés posiciones en este mercado."}
              </Text>
            </GlassCard>
          )}
        </View>

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
 *   - Bajo el ticker: la cantidad de unidades + unit suffix
 *     ("unidades", "VN", "cuotapartes", el ticker para crypto).
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

/* ─── Donut de distribución ─────────────────────────────────────
 *
 * Donut chart 1:1 con el ADN de Alamos: paleta monocromática
 * dominada por el verde brand, sin colores random tipo "AI dashboard".
 * El slice más grande SIEMPRE va en `c.brand` (#00C805) — pop
 * inmediato. El resto desciende por una rampa tonal: ink → action
 * → positive → grises del theme. La idea es que la distribución se
 * lea como una sola escena, no como una bolsa de skittles.
 *
 * Implementación: un único `Circle` por slice con `strokeDasharray`
 * — la técnica clásica de donuts en SVG, sin paths arc trigonometric.
 * Pequeño gap visual entre slices (sólo si hay 2+) para que el ojo
 * separe los segmentos sin necesidad de bordes.
 *
 * En el centro mostramos el total ARS compacto + el conteo de
 * categorías como label inferior. La leyenda va a la derecha,
 * limitada a los top 5 (suficiente — si la cartera tiene más
 * categorías minúsculas se agrupan visualmente igual sin saturar).
 */

interface AllocationChartProps {
  holdings: { asset: Asset; native: number; ars: number }[];
  totalArs: number;
}

function AllocationChart({ holdings, totalArs }: AllocationChartProps) {
  const { c } = useTheme();

  const allocations = useMemo(() => {
    const byCategory = new Map<AssetCategory, number>();
    for (const h of holdings) {
      byCategory.set(
        h.asset.category,
        (byCategory.get(h.asset.category) ?? 0) + h.ars,
      );
    }
    return Array.from(byCategory.entries())
      .map(([cat, ars]) => ({ cat, ars, pct: ars / totalArs }))
      .sort((a, b) => b.ars - a.ars);
  }, [holdings, totalArs]);

  // Rampa tonal — el primer slice (más grande) usa brand, después
  // bajamos por tonos del theme. Repetimos la rampa si hay más de
  // 7 categorías (caso muy excepcional).
  const palette = [
    c.brand,
    c.text,
    c.action,
    c.positive,
    c.textSecondary,
    c.textMuted,
    c.textFaint,
  ];

  const SIZE = 132;
  const STROKE = 18;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  // Gap visual entre slices (en unidades de circunferencia). 2 px
  // se siente justo — separa sin abrir huecos negros.
  const GAP = 2;

  let offset = 0;
  const showGap = allocations.length > 1;

  const legend = allocations.slice(0, 5);

  return (
    <View
      style={[
        s.allocCard,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={s.allocChartWrap}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track de fondo — anillo sunken para que un slice del 99%
              no se confunda con un círculo sólido. */}
          <SvgCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={c.surfaceSunken}
            strokeWidth={STROKE}
          />
          {allocations.map((a, i) => {
            const sliceLen = a.pct * CIRC;
            // Para slices muy chicos no hace falta gap (evita
            // que el dasharray se vuelva negativo o desaparezca).
            const len =
              showGap && sliceLen > GAP * 2 ? sliceLen - GAP : sliceLen;
            const dash = `${Math.max(0, len)} ${CIRC}`;
            const slice = (
              <SvgCircle
                key={a.cat}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={palette[i % palette.length]}
                strokeWidth={STROKE}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            );
            offset += sliceLen;
            return slice;
          })}
        </Svg>
        {/* Center label — total compacto. pointerEvents none para
            que no robe taps al chart si más adelante lo hacemos
            interactivo (drill-down por slice, por ejemplo). */}
        <View style={s.allocCenter} pointerEvents="none">
          <Text style={[s.allocCenterValue, { color: c.text }]}>
            {formatArsCompact(totalArs)}
          </Text>
          <Text style={[s.allocCenterLabel, { color: c.textMuted }]}>
            Total
          </Text>
        </View>
      </View>

      <View style={s.allocLegend}>
        {legend.map((a, i) => (
          <View key={a.cat} style={s.allocLegendRow}>
            <View
              style={[
                s.allocLegendDot,
                { backgroundColor: palette[i % palette.length] },
              ]}
            />
            <Text
              style={[s.allocLegendLabel, { color: c.text }]}
              numberOfLines={1}
            >
              {categoryLabels[a.cat]}
            </Text>
            <Text style={[s.allocLegendPct, { color: c.textMuted }]}>
              {formatAllocationPct(a.pct)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "$ 12,4M" / "$ 850K" / "$ 420" — compacto para el centro del
 *  donut. Para ARS principalmente, donde los millones son moneda
 *  corriente. */
function formatArsCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000)
    return "$ " + (n / 1_000_000_000).toFixed(1).replace(".", ",") + "B";
  if (abs >= 1_000_000)
    return "$ " + (n / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (abs >= 10_000)
    return "$ " + Math.round(n / 1_000).toString() + "K";
  if (abs >= 1_000)
    return "$ " + (n / 1_000).toFixed(1).replace(".", ",") + "K";
  return formatARS(n);
}

/** Pct sin signo, máximo un decimal cuando es chico (< 10%) — en
 *  legend queremos que las cifras dominantes se vean limpias y las
 *  pequeñas no caigan a 0%. */
function formatAllocationPct(p: number): string {
  const v = p * 100;
  if (v >= 10) return Math.round(v).toString() + "%";
  return v.toFixed(1).replace(".", ",") + "%";
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

  /* Header fijo — paddings clavados al header de Mercado para que el
   * segmented quede en el mismo Y de pantalla. */
  header: {
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
  },

  /* Section block container — paddingHorizontal 20 (matchea Inicio).
   * El "sectionHead" usa el mismo lenguaje que las secciones de
   * Inicio: título tipo eyebrow + count compacto a la derecha. */
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

  /* Donut de distribución — card con donut a la izquierda + leyenda
   * a la derecha. Layout side-by-side, gap 18, alineado al centro
   * vertical para que la leyenda no se sienta despegada del chart. */
  allocCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  allocChartWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
  },
  allocCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  allocCenterValue: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.6,
  },
  allocCenterLabel: {
    fontFamily: fontFamily[600],
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 2,
  },
  allocLegend: {
    flex: 1,
    gap: 10,
  },
  allocLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  allocLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  allocLegendLabel: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  allocLegendPct: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
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
