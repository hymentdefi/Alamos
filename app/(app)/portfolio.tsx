import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";

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
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={s.topTitle}>Posiciones</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Total */}
      <View style={s.totalSection}>
        <Text style={s.totalLabel}>Valor total</Text>
        <Text style={s.totalValue}>{formatARS(totalValue)}</Text>
        <View style={s.changeBadge}>
          <Text style={s.changeText}>▲ +12,4% total</Text>
        </View>
      </View>

      {/* Allocation bar */}
      <View style={s.allocSection}>
        <Text style={s.allocTitle}>Distribución</Text>
        <View style={s.allocBar}>
          {heldAssets.map((a, i) => {
            const pct = (a.price * (a.qty || 1)) / totalValue * 100;
            return (
              <View
                key={a.ticker}
                style={{
                  width: `${pct}%` as any,
                  height: 8,
                  backgroundColor: allocColors[i % allocColors.length],
                  borderRadius: i === 0 ? 4 : 0,
                }}
              />
            );
          })}
        </View>
        <View style={s.legend}>
          {heldAssets.map((a, i) => (
            <View key={a.ticker} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: allocColors[i % allocColors.length] }]} />
              <Text style={s.legendText}>{a.ticker}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Divider */}
      <View style={s.divider} />

      {/* Positions list */}
      <View style={s.positionsSection}>
        <Text style={s.sectionTitle}>Tus activos</Text>
        {heldAssets.map((a) => {
          const val = a.price * (a.qty || 1);
          const isUp = a.change >= 0;
          return (
            <Pressable key={a.ticker} style={s.positionRow} onPress={() => openDetail(a)}>
              <View style={s.positionIcon}>
                <Text style={s.positionIconText}>{a.ticker.substring(0, 2)}</Text>
              </View>
              <View style={s.positionInfo}>
                <Text style={s.positionTicker}>{a.ticker}</Text>
                <Text style={s.positionQty}>{a.qty || 1} unidad{(a.qty || 1) > 1 ? "es" : ""}</Text>
              </View>
              <View style={s.positionValues}>
                <Text style={s.positionValue}>{formatARS(val)}</Text>
                <Text style={[s.positionChange, { color: isUp ? colors.brand[500] : colors.red }]}>
                  {isUp ? "+" : ""}{a.change.toFixed(2)}%
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },

  totalSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1,
  },
  changeBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
  },
  changeText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand[500],
  },

  allocSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  allocTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 10,
  },
  allocBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 14,
    gap: 2,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: colors.text.secondary,
  },

  divider: {
    height: 6,
    backgroundColor: colors.surface[100],
    marginVertical: 4,
  },

  positionsSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  positionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  positionIconText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text.primary,
  },
  positionInfo: {
    flex: 1,
  },
  positionTicker: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  positionQty: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  positionValues: {
    alignItems: "flex-end",
  },
  positionValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  positionChange: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
});
