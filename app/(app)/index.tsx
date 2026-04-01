import { View, Text, Image, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";
import AssetItem from "../../lib/components/AssetItem";

const heldAssets = assets.filter((a) => a.held);
const totalBalance = 4287430;
const changeAmount = 127650;
const changePct = 3.07;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const openDetail = (asset: Asset) => {
    router.push({ pathname: "/(app)/detail", params: { ticker: asset.ticker } });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>Buenos días</Text>
            <Image
              source={require("../../assets/logo-white.png")}
              style={s.logoImg}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={s.balanceLabel}>Tu portfolio</Text>
        <Text style={s.balance}>{formatARS(totalBalance)}</Text>
        <View style={s.changeBadge}>
          <Text style={s.changeText}>
            ▲ +{formatARS(changeAmount)} (+{changePct}%) hoy
          </Text>
        </View>
      </View>

      {/* Chart placeholder */}
      <View style={s.chartArea}>
        <View style={s.chartLine} />
      </View>

      {/* Quick actions */}
      <View style={s.quickActions}>
        <Pressable
          style={[s.quickBtn, s.quickBtnAccent]}
          onPress={() => router.push("/(app)/explore")}
        >
          <Text style={s.quickBtnAccentText}>+ Comprar</Text>
        </Pressable>
        <Pressable style={s.quickBtn}>
          <Text style={s.quickBtnText}>→ Transferir</Text>
        </Pressable>
        <Pressable style={s.quickBtn}>
          <Text style={s.quickBtnText}>← Retirar</Text>
        </Pressable>
      </View>

      {/* Assets */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Tu cartera</Text>
        <Pressable onPress={() => router.push("/(app)/explore")}>
          <Text style={s.sectionLink}>Ver todo</Text>
        </Pressable>
      </View>
      <View style={s.assetList}>
        {heldAssets.map((a) => (
          <AssetItem key={a.ticker} asset={a} onPress={openDetail} />
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  header: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: { fontSize: 14, color: colors.text.secondary, marginBottom: 2 },
  logoImg: { width: 120, height: 28, marginTop: 4 },
  balanceLabel: { fontSize: 14, color: colors.text.secondary, marginTop: 20, marginBottom: 4 },
  balance: { fontSize: 36, fontWeight: "700", color: colors.text.primary, letterSpacing: -1 },
  changeBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  changeText: { fontSize: 14, fontWeight: "600", color: colors.brand[500] },
  chartArea: {
    height: 140,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: "center",
  },
  chartLine: {
    height: 2,
    backgroundColor: colors.brand[500],
    borderRadius: 1,
    opacity: 0.3,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  quickBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnAccent: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  quickBtnText: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  quickBtnAccentText: { fontSize: 14, fontWeight: "600", color: "#000" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  sectionLink: { fontSize: 13, color: colors.brand[500], fontWeight: "600" },
  assetList: { paddingHorizontal: 20 },
});
