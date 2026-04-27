import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useTheme,
  fontFamily,
  radius,
  type ThemeColors,
} from "../../lib/theme";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";
import {
  assets,
  assetIconCode,
  categoryLabels,
  formatARS,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../lib/data/assets";

/**
 * Detalle de la sección Tus inversiones desde Inicio.
 *
 * Muestra:
 *   - Rendimiento agregado del día (% + monto $)
 *   - Métricas (total invertido, ganancia, # de activos, mejor performer)
 *   - Distribución por categoría (barra horizontal + leyenda)
 *   - Lista de activos agrupados por categoría con totales
 *
 * Cada activo es tappable y abre el detalle del ticker.
 */
export default function InvestmentsDetailScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Activos held no-cash, agrupados por categoría.
  const groups = useMemo(() => {
    const heldNonCash = assets.filter(
      (a) => a.held && a.category !== "efectivo",
    );
    const map = new Map<AssetCategory, { total: number; items: Asset[] }>();
    for (const a of heldNonCash) {
      const v = a.price * (a.qty ?? 1);
      const entry = map.get(a.category) ?? { total: 0, items: [] };
      entry.total += v;
      entry.items.push(a);
      map.set(a.category, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, []);

  const totalInvested = useMemo(
    () => groups.reduce((sum, [, data]) => sum + data.total, 0),
    [groups],
  );

  // Día: cambio $ y % agregado, ponderado por tenencia.
  const { dayReturn, dayPct } = useMemo(() => {
    const all = groups.flatMap(([, d]) => d.items);
    const ret = all.reduce(
      (sum, a) => sum + a.price * (a.qty ?? 1) * (a.change / 100),
      0,
    );
    const startValue = totalInvested - ret;
    const pct = startValue > 0 ? (ret / startValue) * 100 : 0;
    return { dayReturn: ret, dayPct: pct };
  }, [groups, totalInvested]);
  const dayUp = dayReturn >= 0;

  const top = useMemo(() => {
    const all = groups.flatMap(([, d]) => d.items);
    if (all.length === 0) return null;
    return [...all].sort((a, b) => b.change - a.change)[0];
  }, [groups]);

  const totalAssets = useMemo(
    () => groups.reduce((sum, [, d]) => sum + d.items.length, 0),
    [groups],
  );

  const openDetail = (asset: Asset) => {
    router.push({
      pathname: "/(app)/detail",
      params: { ticker: asset.ticker },
    });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Tus inversiones</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: rendimiento del día */}
        <View style={s.hero}>
          <Text style={[s.heroEyebrow, { color: c.textMuted }]}>
            RENDIMIENTO DEL DÍA
          </Text>
          <View style={s.heroPctRow}>
            <Text
              style={[
                s.heroPctTri,
                { color: dayUp ? c.greenDark : c.red },
              ]}
            >
              {dayUp ? "▲" : "▼"}
            </Text>
            <Text
              style={[s.heroPct, { color: dayUp ? c.greenDark : c.red }]}
            >
              {formatPct(dayPct)}
            </Text>
            <Text style={[s.heroPctSub, { color: c.textMuted }]}>
              {dayUp ? "+" : "−"}
              {formatARS(Math.abs(dayReturn))}
            </Text>
          </View>
        </View>

        {/* Métricas */}
        <Text style={[s.eyebrow, { color: c.textMuted }]}>MÉTRICAS</Text>
        <View
          style={[
            s.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <MetricRow label="Total invertido" value={formatARS(totalInvested)} />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetricRow label="Activos" value={`${totalAssets}`} />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetricRow label="Categorías" value={`${groups.length}`} />
          {top ? (
            <>
              <View style={[s.rowDivider, { backgroundColor: c.border }]} />
              <MetricRow
                label="Mejor performer"
                value={`${top.ticker}  ${formatPct(top.change)}`}
                valueColor={top.change >= 0 ? c.greenDark : c.red}
              />
            </>
          ) : null}
        </View>

        {/* Distribución por categoría */}
        {groups.length > 0 ? (
          <>
            <Text
              style={[s.eyebrow, { color: c.textMuted, marginTop: 28 }]}
            >
              DISTRIBUCIÓN
            </Text>
            <View style={s.distBlock}>
              <View
                style={[s.barTrack, { backgroundColor: c.surfaceSunken }]}
              >
                {groups.map(([cat, data], i) => {
                  const pct = (data.total / totalInvested) * 100;
                  return (
                    <View
                      key={cat}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: allocationColor(cat, c),
                        borderTopLeftRadius: i === 0 ? radius.pill : 0,
                        borderBottomLeftRadius: i === 0 ? radius.pill : 0,
                        borderTopRightRadius:
                          i === groups.length - 1 ? radius.pill : 0,
                        borderBottomRightRadius:
                          i === groups.length - 1 ? radius.pill : 0,
                      }}
                    />
                  );
                })}
              </View>

              <View style={s.legendCol}>
                {groups.map(([cat, data]) => {
                  const pct = (data.total / totalInvested) * 100;
                  return (
                    <View key={cat} style={s.legendRow}>
                      <View
                        style={[
                          s.legendDot,
                          { backgroundColor: allocationColor(cat, c) },
                        ]}
                      />
                      <Text style={[s.legendLabel, { color: c.text }]}>
                        {categoryLabels[cat]}
                      </Text>
                      <Text style={[s.legendPct, { color: c.textMuted }]}>
                        {pct.toFixed(1)}%
                      </Text>
                      <Text style={[s.legendValue, { color: c.text }]}>
                        {formatARS(data.total)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {/* Holdings agrupados por categoría */}
        <Text style={[s.eyebrow, { color: c.textMuted, marginTop: 28 }]}>
          HOLDINGS
        </Text>
        {groups.map(([cat, data]) => (
          <View key={cat} style={s.groupBlock}>
            <View style={s.groupHead}>
              <Text style={[s.groupTitle, { color: c.text }]}>
                {categoryLabels[cat]}
              </Text>
              <Text style={[s.groupValue, { color: c.textMuted }]}>
                {formatARS(data.total)}
              </Text>
            </View>
            <View
              style={[
                s.card,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {data.items.map((asset, i) => (
                <View key={asset.ticker}>
                  {i > 0 ? (
                    <View
                      style={[s.rowDivider, { backgroundColor: c.border }]}
                    />
                  ) : null}
                  <AssetDetailRow asset={asset} onPress={() => openDetail(asset)} />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function AssetDetailRow({
  asset,
  onPress,
}: {
  asset: Asset;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const up = asset.change >= 0;
  const bg =
    asset.iconTone === "dark"
      ? c.ink
      : asset.iconTone === "accent"
      ? c.green
      : c.surfaceSunken;
  const fg =
    asset.iconTone === "dark"
      ? c.bg
      : asset.iconTone === "accent"
      ? c.ink
      : c.textSecondary;

  return (
    <Pressable onPress={onPress} style={s.holdingRow}>
      <View style={[s.assetIcon, { backgroundColor: bg }]}>
        <Text style={[s.assetIconText, { color: fg }]}>
          {assetIconCode(asset)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.ticker, { color: c.text }]}>{asset.ticker}</Text>
        <Text style={[s.tickerSub, { color: c.textMuted }]} numberOfLines={1}>
          {asset.qty} {asset.qty === 1 ? "unidad" : "unidades"} ·{" "}
          {formatARS(asset.price)}
        </Text>
      </View>
      <View style={s.chartCol}>
        <MiniSparkline
          series={seriesFromSeed(asset.ticker, 28, up ? "up" : "down")}
          color={up ? c.greenDark : c.red}
        />
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.balance, { color: c.text }]}>
          {formatARS(asset.price * (asset.qty ?? 1))}
        </Text>
        <Text style={[s.balanceSub, { color: up ? c.greenDark : c.red }]}>
          {formatPct(asset.change)}
        </Text>
      </View>
    </Pressable>
  );
}

function MetricRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={s.metricRow}>
      <Text style={[s.metricLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[s.metricValue, { color: valueColor ?? c.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function allocationColor(cat: AssetCategory, c: ThemeColors): string {
  switch (cat) {
    case "cedears":
      return c.ink;
    case "bonos":
      return c.greenDark;
    case "fci":
      return c.textSecondary;
    case "acciones":
      return c.textMuted;
    case "obligaciones":
      return c.borderStrong;
    default:
      return c.textFaint;
  }
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },

  /* Hero */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroPctRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  heroPctTri: {
    fontFamily: fontFamily[700],
    fontSize: 18,
  },
  heroPct: {
    fontFamily: fontFamily[800],
    fontSize: 36,
    letterSpacing: -1.3,
  },
  heroPctSub: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* Sections */
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
  },

  /* Métricas */
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  metricLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  metricValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
    flexShrink: 1,
    textAlign: "right",
  },

  /* Distribución */
  distBlock: {
    paddingHorizontal: 20,
  },
  barTrack: {
    height: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    overflow: "hidden",
  },
  legendCol: {
    gap: 10,
    marginTop: 16,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  legendPct: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    minWidth: 46,
    textAlign: "right",
  },
  legendValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    minWidth: 96,
    textAlign: "right",
    letterSpacing: -0.15,
  },

  /* Group block */
  groupBlock: {
    marginBottom: 18,
  },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  groupTitle: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  groupValue: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },

  /* Holding row */
  holdingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  assetIconText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.3,
  },
  ticker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  tickerSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  chartCol: {
    width: 56,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  balanceSub: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
});
