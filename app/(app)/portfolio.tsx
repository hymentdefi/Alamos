import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";
import AssetItem from "../../lib/components/AssetItem";

const heldAssets = assets.filter((a) => a.held);
const allocColors = ["#00E676", "#448AFF", "#FF9100", "#E040FB", "#FF5252", "#FFEA00"];
const totalValue = heldAssets.reduce((s, a) => s + a.price * (a.qty || 1), 0);

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const openDetail = (asset: Asset) => {
    router.push({ pathname: "/(app)/detail", params: { ticker: asset.ticker } });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={[s.topNav, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Portfolio</Text>
      </View>

      {/* Total */}
      <View style={s.totalSection}>
        <Text style={s.totalLabel}>Valor total</Text>
        <Text style={s.totalValue}>{formatARS(4287430)}</Text>
        <View style={s.changeBadge}>
          <Text style={s.changeText}>▲ +12,4% total</Text>
        </View>
      </View>

      {/* Distribution label */}
      <View style={s.distLabel}>
        <Text style={s.distText}>Distribución</Text>
      </View>

      {/* Allocation bar */}
      <View style={s.allocBar}>
        {heldAssets.map((a, i) => {
          const pct = (a.price * (a.qty || 1)) / totalValue * 100;
          return (
            <View
              key={a.ticker}
              style={{ width: `${pct}%` as any, height: 8, backgroundColor: allocColors[i % allocColors.length] }}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {heldAssets.map((a, i) => (
          <View key={a.ticker} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: allocColors[i % allocColors.length] }]} />
            <Text style={s.legendText}>{a.ticker}</Text>
          </View>
        ))}
      </View>

      {/* Positions */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Posiciones</Text>
      </View>
      <View style={s.assetList}>
        {heldAssets.map((a) => (
          <AssetItem key={a.ticker} asset={a} onPress={openDetail} showValue />
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  topNav: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text.primary },
  totalSection: { paddingHorizontal: 20, marginBottom: 4 },
  totalLabel: { fontSize: 13, color: colors.text.secondary },
  totalValue: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  changeBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  changeText: { fontSize: 14, fontWeight: "600", color: colors.brand[500] },
  distLabel: { paddingHorizontal: 20, marginTop: 16, marginBottom: 8 },
  distText: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  allocBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 3,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.text.secondary },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  assetList: { paddingHorizontal: 20 },
});
