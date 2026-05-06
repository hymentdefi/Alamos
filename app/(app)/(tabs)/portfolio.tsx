import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../../../lib/theme";
import {
  assets,
  assetCurrency,
  assetIconCode,
  assetMarket,
  formatARS,
  formatMoney,
  formatPct,
  formatQty,
  type Asset,
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
