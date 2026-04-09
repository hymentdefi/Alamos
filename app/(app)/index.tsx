import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";

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

/* Generate fake chart points per period */
function generateChartPoints(period: string): number[] {
  const seeds: Record<string, number[]> = {
    "1D":  [40, 42, 38, 44, 50, 48, 52, 55, 53, 58, 60, 56, 62, 65, 63, 68, 70, 66, 72, 75],
    "1S":  [50, 48, 45, 47, 52, 55, 50, 48, 53, 58, 62, 60, 57, 55, 58, 63, 65, 60, 58, 62],
    "1M":  [70, 68, 65, 60, 55, 52, 48, 50, 45, 42, 40, 38, 42, 45, 40, 38, 35, 40, 42, 38],
    "3M":  [30, 35, 40, 38, 45, 50, 55, 52, 58, 62, 65, 60, 68, 72, 70, 75, 78, 74, 80, 82],
    "YTD": [40, 45, 50, 48, 55, 52, 58, 62, 60, 65, 68, 64, 70, 72, 68, 75, 78, 74, 72, 76],
    "1A":  [25, 30, 35, 40, 38, 45, 50, 55, 58, 52, 60, 65, 70, 68, 72, 75, 80, 78, 82, 85],
    "MAX": [10, 15, 20, 18, 25, 30, 35, 40, 38, 45, 50, 55, 52, 60, 65, 70, 75, 72, 80, 85],
  };
  return seeds[period] || seeds["1D"];
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTime, setActiveTime] = useState("1D");

  const change = changeByTime[activeTime];
  const isPositive = change.pct >= 0;
  const chartColor = isPositive ? colors.brand[500] : colors.red;
  const points = generateChartPoints(activeTime);

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
        <View style={{ flex: 1 }} />
        <View style={s.topBarRight}>
          <Pressable
            onPress={() => router.push("/(app)/explore")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="search" size={24} color={colors.text.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/notifications")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Portfolio value ── */}
      <View style={s.valueSection}>
        <Text style={s.valueLabel}>Inversiones</Text>
        <Text style={s.valueAmount}>{formatARS(totalBalance)}</Text>
        <View style={s.changeRow}>
          <Text style={[s.changeTriangle, { color: chartColor }]}>
            {isPositive ? "\u25B2" : "\u25BC"}
          </Text>
          <Text style={[s.changeText, { color: chartColor }]}>
            {" "}{isPositive ? "+" : ""}{formatARS(change.amount)} ({isPositive ? "+" : ""}{change.pct.toFixed(2)}%)
          </Text>
          <Text style={s.changePeriod}> {timeLabels[activeTime]}</Text>
        </View>
      </View>

      {/* ── Chart ── */}
      <View style={s.chartArea}>
        {/* Dotted baseline */}
        <View style={s.chartBaseline} />
        {/* SVG-like chart using absolute positioned lines */}
        <View style={s.chartContent}>
          {points.map((p, i) => {
            if (i === 0) return null;
            const prev = points[i - 1];
            const segW = 100 / (points.length - 1);
            const minP = Math.min(...points);
            const maxP = Math.max(...points);
            const range = maxP - minP || 1;
            const y1 = 100 - ((prev - minP) / range) * 100;
            const y2 = 100 - ((p - minP) / range) * 100;
            const midY = (y1 + y2) / 2;
            return (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: `${(i - 1) * segW}%`,
                  width: `${segW}%`,
                  top: `${midY}%`,
                  height: 2,
                  backgroundColor: chartColor,
                  borderRadius: 1,
                  transform: [{ rotate: `${Math.atan2(y2 - y1, segW) * 0.3}rad` }],
                }}
              />
            );
          })}
        </View>
      </View>

      {/* ── Time filters ── */}
      <View style={s.timeFilters}>
        {timeFilters.map((t) => (
          <Pressable
            key={t}
            style={[s.timeBtn, activeTime === t && s.timeBtnActive]}
            onPress={() => setActiveTime(t)}
          >
            <Text style={[s.timeBtnText, activeTime === t && s.timeBtnTextActive]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Buying power ── */}
      <View style={s.thinDivider} />
      <Pressable style={s.buyingPowerRow}>
        <Text style={s.buyingPowerLabel}>Poder de compra</Text>
        <View style={s.buyingPowerRight}>
          <Text style={s.buyingPowerValue}>{formatARS(buyingPower)}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </View>
      </Pressable>

      {/* ── Thick divider ── */}
      <View style={s.thickDivider} />

      {/* ── Cash section ── */}
      <View style={s.section}>
        <View style={s.sectionHeaderRow}>
          <View style={s.row}>
            <Text style={s.sectionTitle}>Efectivo</Text>
            <Ionicons name="information-circle-outline" size={18} color={colors.text.muted} style={{ marginLeft: 6 }} />
          </View>
          <View style={s.interestBadge}>
            <Text style={s.interestBadgeText}>TNA 97%</Text>
          </View>
        </View>

        {/* Promo card */}
        <View style={s.promoCard}>
          <Ionicons name="star" size={18} color={colors.brand[500]} style={{ marginRight: 10 }} />
          <Text style={s.promoText}>
            Ganá rendimiento sobre tu efectivo no invertido. Sin tope.
          </Text>
          <Pressable hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.text.muted} />
          </Pressable>
        </View>

        {/* Cash detail rows */}
        <View style={s.cashDetailRow}>
          <View>
            <Text style={s.cashDetailLabel}>Interés acumulado este mes</Text>
            <Text style={s.cashDetailSub}>Próximo pago: 31 de enero</Text>
          </View>
          <Text style={s.cashDetailValue}>{formatARS(0)}</Text>
        </View>
        <View style={s.cashDetailDivider} />

        <View style={s.cashDetailRow}>
          <Text style={s.cashDetailLabel}>Interés total cobrado</Text>
          <Text style={s.cashDetailValue}>{formatARS(15420)}</Text>
        </View>
        <View style={s.cashDetailDivider} />

        <View style={s.cashDetailRow}>
          <View style={s.row}>
            <Text style={s.cashDetailLabel}>Efectivo generando interés</Text>
            <Ionicons name="help-circle-outline" size={14} color={colors.text.muted} style={{ marginLeft: 4 }} />
          </View>
          <Text style={s.cashDetailValue}>{formatARS(buyingPower)}</Text>
        </View>

        <Pressable onPress={() => router.push("/(app)/transfer")}>
          <Text style={s.depositLink}>Depositar efectivo</Text>
        </Pressable>
      </View>

      {/* ── Thick divider ── */}
      <View style={s.thickDivider} />

      {/* ── Stocks section ── */}
      <View style={s.section}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Acciones</Text>
          <Pressable onPress={() => router.push("/(app)/explore")}>
            <Text style={s.sectionAction}>Invertir</Text>
          </Pressable>
        </View>
        {heldAssets.map((a, idx) => {
          const val = a.price * (a.qty || 1);
          const isUp = a.change >= 0;
          return (
            <Pressable key={a.ticker} style={s.stockRow} onPress={() => openDetail(a)}>
              <View style={s.stockLeft}>
                <Text style={s.stockTicker}>{a.ticker}</Text>
                <Text style={s.stockQty}>{a.qty || 1} unidad{(a.qty || 1) > 1 ? "es" : ""}</Text>
              </View>
              {/* Mini chart */}
              <View style={s.miniChart}>
                <View style={s.miniChartInner}>
                  {[0, 1, 2, 3, 4, 5, 6].map((j) => {
                    const h = 6 + Math.abs(Math.sin(a.price / 1000 + j * 0.8)) * 16;
                    return (
                      <View
                        key={j}
                        style={{
                          width: 2,
                          height: h,
                          backgroundColor: isUp ? colors.brand[500] : colors.red,
                          borderRadius: 1,
                          opacity: 0.7,
                        }}
                      />
                    );
                  })}
                </View>
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

      {/* ── Thick divider ── */}
      <View style={s.thickDivider} />

      {/* ── Discover more section ── */}
      <View style={s.section}>
        <View style={s.sectionHeaderRow}>
          <View style={s.row}>
            <Text style={s.sectionTitle}>Descubrí más</Text>
            <Ionicons name="information-circle-outline" size={18} color={colors.text.muted} style={{ marginLeft: 6 }} />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.discoverScroll}>
          {[
            { icon: "logo-bitcoin", title: "Crypto", desc: "Comprá Bitcoin, ETH y más", route: "/(app)/crypto", bg: "#2D1F6F" },
            { icon: "repeat", title: "Recurrente", desc: "Invertí de forma automática", route: "", bg: "#1A3A2A" },
            { icon: "bar-chart", title: "Dividendos", desc: "Reinvertí tus ganancias", route: "", bg: "#3A2A1A" },
            { icon: "globe", title: "CEDEARs", desc: "Accedé a empresas globales", route: "", bg: "#1A2A3A" },
          ].map((item) => (
            <Pressable
              key={item.title}
              style={s.discoverCard}
              onPress={() => item.route ? router.push(item.route as any) : undefined}
            >
              <View style={[s.discoverIconArea, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={36} color="#fff" />
              </View>
              <View style={s.discoverTextArea}>
                <Text style={s.discoverTitle}>{item.title}</Text>
                <Text style={s.discoverDesc}>{item.desc}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Thick divider ── */}
      <View style={s.thickDivider} />

      {/* ── Watchlist ── */}
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

        {/* Show non-held assets as watchlist items */}
        {assets.filter(a => !a.held).map((a) => {
          const isUp = a.change >= 0;
          return (
            <Pressable key={a.ticker} style={s.stockRow} onPress={() => openDetail(a)}>
              <View style={s.stockLeft}>
                <Text style={s.stockTicker}>{a.ticker}</Text>
                <Text style={s.stockQty}>{a.name}</Text>
              </View>
              <View style={s.miniChart}>
                <View style={s.miniChartInner}>
                  {[0, 1, 2, 3, 4, 5, 6].map((j) => {
                    const h = 6 + Math.abs(Math.sin(a.price / 1000 + j * 0.8)) * 16;
                    return (
                      <View
                        key={j}
                        style={{
                          width: 2,
                          height: h,
                          backgroundColor: isUp ? colors.brand[500] : colors.red,
                          borderRadius: 1,
                          opacity: 0.7,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
              <View style={[s.priceBadge, { backgroundColor: isUp ? "rgba(0,230,118,0.15)" : "rgba(255,68,68,0.15)" }]}>
                <Text style={[s.priceBadgeText, { color: isUp ? colors.brand[500] : colors.red }]}>
                  {formatARS(a.price)}
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

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarRight: { flexDirection: "row", gap: 20 },

  /* Portfolio value */
  valueSection: { paddingHorizontal: 20, paddingTop: 4 },
  valueLabel: {
    fontSize: 34,
    fontWeight: "300",
    color: colors.text.secondary,
    letterSpacing: -0.5,
  },
  valueAmount: {
    fontSize: 38,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1,
    marginTop: -2,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  changeTriangle: {
    fontSize: 12,
  },
  changeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  changePeriod: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  /* Chart */
  chartArea: {
    height: 240,
    paddingHorizontal: 4,
    marginTop: 12,
    position: "relative",
    justifyContent: "center",
  },
  chartBaseline: {
    position: "absolute",
    left: 20,
    right: 20,
    top: "50%",
    height: 1,
    borderStyle: "dashed",
    borderWidth: 0.5,
    borderColor: colors.text.muted,
    opacity: 0.3,
  },
  chartContent: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 20,
    bottom: 20,
  },

  /* Time filters */
  timeFilters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 4,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
  },
  timeBtnActive: {
    backgroundColor: colors.surface[200],
  },
  timeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.muted,
  },
  timeBtnTextActive: {
    color: colors.text.primary,
  },

  /* Dividers */
  thinDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  thickDivider: {
    height: 6,
    backgroundColor: colors.surface[100],
  },

  /* Buying power */
  buyingPowerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  buyingPowerLabel: { fontSize: 16, color: colors.text.primary },
  buyingPowerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  buyingPowerValue: { fontSize: 16, fontWeight: "600", color: colors.text.primary },

  /* Shared */
  row: { flexDirection: "row", alignItems: "center" },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 24,
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

  /* Interest badge */
  interestBadge: {
    backgroundColor: colors.surface[200],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  interestBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand[500],
  },

  /* Promo card */
  promoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface[100],
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  promoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  /* Cash detail */
  cashDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  cashDetailLabel: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  cashDetailSub: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  cashDetailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  cashDetailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  depositLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand[500],
    marginTop: 12,
  },

  /* Stocks */
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stockLeft: { flex: 1 },
  stockTicker: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  stockQty: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  miniChart: {
    width: 64,
    height: 32,
    justifyContent: "center",
    marginHorizontal: 12,
  },
  miniChartInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: "100%",
  },
  priceBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "flex-end",
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },

  /* Discover */
  discoverScroll: { gap: 12, paddingRight: 20 },
  discoverCard: {
    width: 170,
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: "hidden",
  },
  discoverIconArea: {
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  discoverTextArea: {
    padding: 12,
  },
  discoverTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  discoverDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 3,
    lineHeight: 16,
  },

  /* Lists */
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  listName: { fontSize: 16, fontWeight: "700", color: colors.text.primary },
  listCount: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
});
