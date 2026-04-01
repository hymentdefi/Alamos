import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";
import Button from "../../lib/components/Button";

const timeFilters = ["1D", "1S", "1M", "3M", "1A", "MAX"];

export default function DetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTime, setActiveTime] = useState("1D");

  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset) return null;

  const isPositive = asset.change >= 0;
  const sign = isPositive ? "+" : "";
  const changeAmt = Math.round(asset.price * Math.abs(asset.change) / 100);
  const open = asset.price - Math.round(asset.price * asset.change / 200);
  const hi = asset.price + Math.round(asset.price * 0.018);
  const lo = asset.price - Math.round(asset.price * 0.022);

  const stats = [
    { label: "Apertura", value: formatARS(open) },
    { label: "Cierre ant.", value: formatARS(open - 120) },
    { label: "Máximo", value: formatARS(hi) },
    { label: "Mínimo", value: formatARS(lo) },
  ];

  return (
    <View style={s.container}>
      <View style={[s.topNav, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={s.title}>{asset.name}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Price */}
        <View style={s.priceSection}>
          <Text style={s.ticker}>{asset.ticker}</Text>
          <Text style={s.price}>{formatARS(asset.price)}</Text>
          <Text style={[s.change, isPositive ? s.positive : s.negative]}>
            {isPositive ? "▲" : "▼"} {sign}{formatARS(changeAmt)} ({sign}{asset.change.toFixed(2)}%) hoy
          </Text>
        </View>

        {/* Chart placeholder */}
        <View style={s.chartArea}>
          <View style={[s.chartLine, { backgroundColor: isPositive ? colors.brand[500] : colors.red }]} />
        </View>

        {/* Time filters */}
        <View style={s.timeFilters}>
          {timeFilters.map((t) => (
            <Pressable
              key={t}
              style={[s.timeBtn, activeTime === t && s.timeBtnActive]}
              onPress={() => setActiveTime(t)}
            >
              <Text style={[s.timeBtnText, activeTime === t && s.timeBtnTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          {stats.map((stat, i) => (
            <View key={stat.label} style={s.statItem}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={s.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Buy button */}
        <View style={s.buySection}>
          <Button
            title="Comprar"
            onPress={() => router.push({ pathname: "/(app)/confirm", params: { ticker: asset.ticker } })}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text.primary },
  priceSection: { paddingHorizontal: 20, marginBottom: 8 },
  ticker: { fontSize: 14, color: colors.text.secondary, fontWeight: "500" },
  price: { fontSize: 32, fontWeight: "700", color: colors.text.primary, letterSpacing: -0.5 },
  change: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  positive: { color: colors.brand[500] },
  negative: { color: colors.red },
  chartArea: {
    height: 180,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  chartLine: { height: 2, borderRadius: 1, opacity: 0.4 },
  timeFilters: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  timeBtnActive: { backgroundColor: colors.card },
  timeBtnText: { fontSize: 13, fontWeight: "600", color: colors.text.muted },
  timeBtnTextActive: { color: colors.text.primary },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
  },
  statItem: {
    width: "50%",
    backgroundColor: colors.card,
    padding: 14,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  statLabel: { fontSize: 12, color: colors.text.secondary, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: "700", color: colors.text.primary },
  buySection: { paddingHorizontal: 20 },
});
