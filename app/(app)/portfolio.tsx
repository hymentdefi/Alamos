import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing, type ThemeColors } from "../../lib/theme";
import {
  assets,
  assetIconCode,
  formatARS,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../lib/data/assets";
import { Sparkline } from "../../lib/components/Sparkline";

const CASH = 342180;

const categoryLabels: Record<AssetCategory, string> = {
  cedears: "CEDEARs",
  bonos: "Bonos",
  fci: "Fondos",
  acciones: "Acciones AR",
  obligaciones: "Obligaciones",
  letras: "Letras",
  caucion: "Caución",
};

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const held = useMemo(() => assets.filter((a) => a.held), []);

  const { byCategory, totalHoldings } = useMemo(() => {
    const map = new Map<AssetCategory, { total: number; items: Asset[] }>();
    let totalH = 0;
    for (const a of held) {
      const v = a.price * (a.qty ?? 1);
      totalH += v;
      const entry = map.get(a.category) ?? { total: 0, items: [] };
      entry.total += v;
      entry.items.push(a);
      map.set(a.category, entry);
    }
    return {
      byCategory: [...map.entries()].sort((a, b) => b[1].total - a[1].total),
      totalHoldings: totalH,
    };
  }, [held]);

  const totalEquity = totalHoldings + CASH;
  const dayDelta = 24830;
  const dayPct = 1.96;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={[s.title, { color: c.text }]}>Cartera</Text>
          <Pressable
            onPress={() => router.push("/(app)/transfer")}
            style={[s.headerBtn, { backgroundColor: c.surfaceHover }]}
            hitSlop={8}
          >
            <Feather name="plus" size={18} color={c.text} />
          </Pressable>
        </View>

        <View style={s.summaryBlock}>
          <Text style={[s.summaryLabel, { color: c.textMuted }]}>
            Patrimonio total
          </Text>
          <Text style={[s.summaryValue, { color: c.text }]}>
            {formatARS(totalEquity)}
          </Text>
          <View style={s.deltaRow}>
            <Text style={[s.deltaTri, { color: c.greenDark }]}>▲</Text>
            <Text style={[s.deltaText, { color: c.greenDark }]}>
              {formatARS(dayDelta)}
            </Text>
            <Text style={[s.deltaSep, { color: c.greenDark }]}>·</Text>
            <Text style={[s.deltaText, { color: c.greenDark }]}>
              {formatPct(dayPct)} hoy
            </Text>
          </View>
          <Sparkline color={c.greenDark} style={{ marginTop: 16 }} />
        </View>

        <View style={s.splitRow}>
          <View
            style={[
              s.splitCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.splitLabel, { color: c.textMuted }]}>Inversiones</Text>
            <Text style={[s.splitValue, { color: c.text }]}>
              {formatARS(totalHoldings)}
            </Text>
            <Text style={[s.splitSub, { color: c.textMuted }]}>
              {held.length} posiciones
            </Text>
          </View>
          <View
            style={[
              s.splitCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.splitLabel, { color: c.textMuted }]}>Efectivo</Text>
            <Text style={[s.splitValue, { color: c.text }]}>{formatARS(CASH)}</Text>
            <Text style={[s.splitSub, { color: c.textMuted }]}>
              Disponible para operar
            </Text>
          </View>
        </View>

        <View style={s.allocBlock}>
          <Text style={[s.eyebrow, { color: c.textMuted }]}>Distribución</Text>

          <View style={[s.barTrack, { backgroundColor: c.surfaceSunken }]}>
            {byCategory.map(([cat, data], i) => {
              const pct = (data.total / totalHoldings) * 100;
              return (
                <View
                  key={cat}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: allocationColor(cat, c),
                    borderTopLeftRadius: i === 0 ? radius.pill : 0,
                    borderBottomLeftRadius: i === 0 ? radius.pill : 0,
                    borderTopRightRadius:
                      i === byCategory.length - 1 ? radius.pill : 0,
                    borderBottomRightRadius:
                      i === byCategory.length - 1 ? radius.pill : 0,
                  }}
                />
              );
            })}
          </View>

          <View style={s.legend}>
            {byCategory.map(([cat, data]) => {
              const pct = (data.total / totalHoldings) * 100;
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

        {byCategory.map(([cat, data]) => (
          <View key={cat} style={s.groupBlock}>
            <View style={s.groupHeader}>
              <Text style={[s.groupTitle, { color: c.text }]}>
                {categoryLabels[cat]}
              </Text>
              <Text style={[s.groupValue, { color: c.textMuted }]}>
                {formatARS(data.total)}
              </Text>
            </View>
            {data.items.map((asset, i) => (
              <HeldRow
                key={asset.ticker}
                asset={asset}
                first={i === 0}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/detail",
                    params: { ticker: asset.ticker },
                  })
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function HeldRow({
  asset,
  first,
  onPress,
}: {
  asset: Asset;
  first?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const value = asset.price * (asset.qty ?? 1);
  const up = asset.change >= 0;
  const dark = asset.iconTone === "dark";
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.row,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
      ]}
    >
      <View
        style={[s.rowIcon, { backgroundColor: dark ? c.ink : c.surfaceSunken }]}
      >
        <Text style={[s.rowIconText, { color: dark ? c.bg : c.textSecondary }]}>
          {assetIconCode(asset)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTicker, { color: c.text }]}>{asset.ticker}</Text>
        <Text style={[s.rowSub, { color: c.textMuted }]}>
          {asset.qty} {asset.qty === 1 ? "unidad" : "unidades"} ·{" "}
          {formatARS(asset.price)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.rowPrice, { color: c.text }]}>{formatARS(value)}</Text>
        <Text style={[s.rowChange, { color: up ? c.greenDark : c.red }]}>
          {formatPct(asset.change)}
        </Text>
      </View>
    </Pressable>
  );
}

function allocationColor(cat: AssetCategory, c: ThemeColors): string {
  switch (cat) {
    case "cedears":
      return c.ink;
    case "bonos":
      return c.green;
    case "fci":
      return c.greenDark;
    case "acciones":
      return c.textSecondary;
    case "obligaciones":
      return c.textMuted;
    default:
      return c.borderStrong;
  }
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1.2,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBlock: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  summaryLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    marginBottom: 6,
    letterSpacing: -0.15,
  },
  summaryValue: {
    fontFamily: fontFamily[700],
    fontSize: 42,
    letterSpacing: -1.8,
    marginBottom: 8,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deltaTri: {
    fontFamily: fontFamily[700],
    fontSize: 11,
  },
  deltaText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
  },
  deltaSep: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    opacity: 0.6,
  },
  splitRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
  },
  splitCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  splitLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  splitValue: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  splitSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.1,
  },
  allocBlock: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  barTrack: {
    height: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 16,
  },
  legend: {
    gap: 10,
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
    minWidth: 92,
    textAlign: "right",
    letterSpacing: -0.15,
  },
  groupBlock: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  groupTitle: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
  },
  groupValue: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
  },
  rowTicker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  rowSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  rowPrice: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowChange: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    marginTop: 2,
  },
});
