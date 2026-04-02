import { useState } from "react";
import {
  View, Text, Image, ScrollView, Pressable, StyleSheet, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";

const { width: SCREEN_W } = Dimensions.get("window");
const heldAssets = assets.filter((a) => a.held);
const totalBalance = 4287430;
const buyingPower = 342180;

const timeFilters = ["1D", "1S", "1M", "3M", "YTD", "1A", "MAX"];
const timeLabels: Record<string, string> = {
  "1D": "Hoy", "1S": "Última semana", "1M": "Último mes",
  "3M": "Últimos 3 meses", "YTD": "Este año", "1A": "Último año", "MAX": "Histórico",
};

const changeByTime: Record<string, { amount: number; pct: number }> = {
  "1D": { amount: 127650, pct: 3.07 },
  "1S": { amount: 89430, pct: 2.13 },
  "1M": { amount: -156200, pct: -3.52 },
  "3M": { amount: 412300, pct: 10.63 },
  "YTD": { amount: 287100, pct: 7.17 },
  "1A": { amount: 1023400, pct: 31.35 },
  "MAX": { amount: 1287430, pct: 42.93 },
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTime, setActiveTime] = useState("1D");

  const change = changeByTime[activeTime];
  const isPositive = change.pct >= 0;
  const chartColor = isPositive ? colors.brand[500] : colors.red;

  const openDetail = (asset: Asset) => {
    router.push({ pathname: "/(app)/detail", params: { ticker: asset.ticker } });
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 80 }} />
        <View style={s.topBarRight}>
          <Pressable onPress={() => router.push("/(app)/explore")}>
            <Ionicons name="search" size={24} color={colors.text.primary} />
          </Pressable>
          <Pressable>
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Portfolio value ── */}
      <View style={s.valueSection}>
        <Text style={s.valueLabel}>Inversiones</Text>
        <Text style={s.valueAmount}>{formatARS(totalBalance)}</Text>
        <Text style={[s.valueChange, { color: chartColor }]}>
          {isPositive ? "▲" : "▼"} {isPositive ? "+" : ""}{formatARS(change.amount)} ({isPositive ? "+" : ""}{change.pct.toFixed(2)}%) {timeLabels[activeTime]}
        </Text>
      </View>

      {/* ── Chart placeholder ── */}
      <View style={s.chartArea}>
        <View style={s.chartGrid}>
          <View style={[s.chartGridLine, { top: "0%" }]} />
          <View style={[s.chartGridLine, { top: "50%" }]} />
          <View style={[s.chartGridLine, { top: "100%" }]} />
        </View>
        <View style={[s.chartLineMain, { backgroundColor: chartColor }]} />
      </View>

      {/* ── Time filters ── */}
      <View style={s.timeFilters}>
        {timeFilters.map((t) => (
          <Pressable
            key={t}
            style={[s.timeBtn, activeTime === t && [s.timeBtnActive, { borderColor: chartColor }]]}
            onPress={() => setActiveTime(t)}
          >
            <Text style={[s.timeBtnText, activeTime === t && { color: colors.text.primary }]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Buying power ── */}
      <Pressable style={s.buyingPowerRow}>
        <Text style={s.buyingPowerLabel}>Poder de compra</Text>
        <View style={s.buyingPowerRight}>
          <Text style={s.buyingPowerValue}>{formatARS(buyingPower)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </View>
      </Pressable>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── Cash section ── */}
      <View style={s.section}>
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionHeaderLeft}>
            <Text style={s.sectionTitle}>Efectivo</Text>
            <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} style={{ marginLeft: 4 }} />
          </View>
        </View>
        <View style={s.cashRow}>
          <Text style={s.cashLabel}>Disponible en cuenta</Text>
          <Text style={s.cashValue}>{formatARS(buyingPower)}</Text>
        </View>
        <Pressable onPress={() => router.push("/(app)/transfer")}>
          <Text style={s.depositLink}>Depositar efectivo</Text>
        </Pressable>
      </View>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── Stocks section ── */}
      <View style={s.section}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Acciones</Text>
          <Pressable onPress={() => router.push("/(app)/explore")}>
            <Text style={s.sectionAction}>Invertir</Text>
          </Pressable>
        </View>
        {heldAssets.map((a) => {
          const val = a.price * (a.qty || 1);
          const isUp = a.change >= 0;
          return (
            <Pressable key={a.ticker} style={s.stockRow} onPress={() => openDetail(a)}>
              <View style={s.stockLeft}>
                <Text style={s.stockTicker}>{a.ticker}</Text>
                <Text style={s.stockQty}>{a.qty || 1} unidad{(a.qty || 1) > 1 ? "es" : ""}</Text>
              </View>
              {/* Mini chart placeholder */}
              <View style={s.miniChart}>
                <View style={[s.miniChartLine, { backgroundColor: isUp ? colors.brand[500] : colors.red }]} />
              </View>
              <View style={[s.priceBadge, { backgroundColor: isUp ? "rgba(0,230,118,0.15)" : "rgba(255,68,68,0.15)" }]}>
                <Text style={[s.priceBadgeText, { color: isUp ? colors.brand[500] : colors.red }]}>
                  {formatARS(val)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── Discover more section ── */}
      <View style={s.section}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Descubrí más</Text>
          <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.discoverScroll}>
          {[
            { icon: "₿", title: "Crypto", desc: "Comprá Bitcoin, ETH y más", route: "/(app)/crypto" },
            { icon: "🔄", title: "Recurrente", desc: "Invertí de forma automática", route: "" },
            { icon: "📊", title: "Dividendos", desc: "Reinvertí tus ganancias", route: "" },
            { icon: "📱", title: "CEDEARs", desc: "Accedé a empresas globales", route: "" },
          ].map((item) => (
            <Pressable
              key={item.title}
              style={s.discoverCard}
              onPress={() => item.route ? router.push(item.route as any) : undefined}
            >
              <View style={s.discoverIcon}>
                <Text style={{ fontSize: 32 }}>{item.icon}</Text>
              </View>
              <Text style={s.discoverTitle}>{item.title}</Text>
              <Text style={s.discoverDesc}>{item.desc}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── Lists / Watchlist ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Listas</Text>
        <Pressable style={s.listItem}>
          <View style={s.listIcon}>
            <Ionicons name="bulb-outline" size={18} color={colors.brand[500]} />
          </View>
          <View style={s.listInfo}>
            <Text style={s.listName}>Mi watchlist</Text>
            <Text style={s.listCount}>{assets.length} activos</Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={colors.text.muted} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarRight: { flexDirection: "row", gap: 20 },

  /* Portfolio value */
  valueSection: { paddingHorizontal: 20, paddingTop: 4 },
  valueLabel: {
    fontSize: 32,
    fontWeight: "300",
    color: colors.text.secondary,
    letterSpacing: -0.5,
  },
  valueAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1,
  },
  valueChange: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },

  /* Chart */
  chartArea: {
    height: 220,
    paddingHorizontal: 4,
    marginTop: 8,
    position: "relative",
    justifyContent: "center",
  },
  chartGrid: { position: "absolute", left: 0, right: 0, top: 20, bottom: 20 },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.3,
  },
  chartLineMain: {
    height: 2,
    marginHorizontal: 20,
    borderRadius: 1,
    opacity: 0.6,
  },

  /* Time filters */
  timeFilters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 4,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  timeBtnActive: {
    borderWidth: 1,
  },
  timeBtnText: { fontSize: 13, fontWeight: "600", color: colors.text.muted },

  /* Buying power */
  buyingPowerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buyingPowerLabel: { fontSize: 15, color: colors.text.primary },
  buyingPowerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  buyingPowerValue: { fontSize: 15, fontWeight: "600", color: colors.text.primary },

  /* Shared */
  divider: {
    height: 6,
    backgroundColor: colors.surface[100],
    marginVertical: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center" },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    textDecorationLine: "underline",
  },

  /* Cash */
  cashRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  cashLabel: { fontSize: 14, color: colors.text.secondary },
  cashValue: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  depositLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand[500],
    marginTop: 4,
  },

  /* Stocks */
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stockLeft: { flex: 1 },
  stockTicker: { fontSize: 15, fontWeight: "700", color: colors.text.primary },
  stockQty: { fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  miniChart: {
    width: 64,
    height: 28,
    justifyContent: "center",
    marginHorizontal: 12,
  },
  miniChartLine: {
    height: 1.5,
    borderRadius: 1,
  },
  priceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },

  /* Discover */
  discoverScroll: { gap: 12, paddingRight: 20 },
  discoverCard: {
    width: 160,
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: "hidden",
  },
  discoverIcon: {
    height: 100,
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
  },
  discoverTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  discoverDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    paddingHorizontal: 12,
    paddingBottom: 12,
    marginTop: 2,
  },

  /* Lists */
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface[100],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  listInfo: { flex: 1 },
  listName: { fontSize: 15, fontWeight: "700", color: colors.text.primary },
  listCount: { fontSize: 12, color: colors.text.secondary, marginTop: 1 },
});
