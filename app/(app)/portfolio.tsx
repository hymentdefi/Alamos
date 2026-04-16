import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";

const heldAssets = assets.filter((a) => a.held);
const totalValue = heldAssets.reduce((s, a) => s + a.price * (a.qty || 1), 0);

const timeFilters = ["1D", "1S", "1M", "3M", "1A", "MAX"] as const;
const timeLabels: Record<(typeof timeFilters)[number], string> = {
  "1D": "hoy",
  "1S": "esta semana",
  "1M": "este mes",
  "3M": "estos 3 meses",
  "1A": "este ano",
  "MAX": "desde el inicio",
};

const changeByTime: Record<(typeof timeFilters)[number], { amount: number; pct: number }> = {
  "1D": { amount: 127650, pct: 3.07 },
  "1S": { amount: 89430, pct: 2.13 },
  "1M": { amount: -156200, pct: -3.52 },
  "3M": { amount: 412300, pct: 10.63 },
  "1A": { amount: 1023400, pct: 31.35 },
  "MAX": { amount: 1287430, pct: 42.93 },
};

const tabs = ["Acciones", "Bonos", "CEDEARs"] as const;
type Tab = (typeof tabs)[number];

const categoryMap: Record<Tab, Asset["category"]> = {
  Acciones: "acciones",
  Bonos: "bonos",
  CEDEARs: "cedears",
};

const donutColors = {
  Acciones: "#FFFFFF",
  Bonos: "#8E8E93",
  CEDEARs: "#2C2C2E",
} as const;

const DONUT_SEGMENTS = 72;

function chartPoints(period: (typeof timeFilters)[number]): number[] {
  const series: Record<(typeof timeFilters)[number], number[]> = {
    "1D": [38, 42, 39, 45, 48, 46, 52, 54, 53, 57, 59, 58, 62, 64, 63, 67, 69, 68, 72, 76],
    "1S": [44, 43, 45, 47, 49, 48, 50, 52, 51, 53, 56, 55, 57, 60, 59, 61, 63, 62, 65, 67],
    "1M": [70, 66, 64, 60, 56, 58, 54, 50, 48, 45, 44, 42, 43, 41, 40, 38, 39, 37, 38, 36],
    "3M": [28, 31, 35, 38, 36, 41, 44, 47, 45, 50, 53, 56, 54, 58, 62, 61, 65, 68, 70, 74],
    "1A": [22, 25, 30, 34, 33, 38, 42, 47, 45, 50, 55, 58, 56, 61, 66, 69, 72, 76, 79, 82],
    "MAX": [12, 17, 20, 24, 29, 33, 36, 40, 44, 47, 51, 56, 59, 63, 67, 70, 74, 79, 84, 88],
  };

  return series[period];
}

function getCategoryValue(cat: Asset["category"]) {
  return heldAssets
    .filter((a) => a.category === cat)
    .reduce((s, a) => s + a.price * (a.qty || 1), 0);
}

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("Acciones");
  const [activeTime, setActiveTime] = useState<(typeof timeFilters)[number]>("1D");

  const change = changeByTime[activeTime];
  const positive = change.pct >= 0;
  const accentColor = positive ? colors.brand[500] : colors.red;
  const points = chartPoints(activeTime);

  const filteredAssets = heldAssets.filter((a) => a.category === categoryMap[activeTab]);
  const donutData = tabs.map((tab) => {
    const value = getCategoryValue(categoryMap[tab]);
    const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
    return {
      tab,
      value,
      pct,
      color: donutColors[tab],
    };
  });
  const activeSlice = donutData.find((slice) => slice.tab === activeTab)!;
  const donutSegments = donutData
    .flatMap((slice) => {
      const count = Math.max(1, Math.round((slice.pct / 100) * DONUT_SEGMENTS));
      return Array.from({ length: count }, () => ({
        tab: slice.tab,
        color: slice.color,
        active: slice.tab === activeTab,
      }));
    })
    .slice(0, DONUT_SEGMENTS);

  while (donutSegments.length < DONUT_SEGMENTS) {
    const fallback = donutData[donutData.length - 1];
    donutSegments.push({
      tab: fallback.tab,
      color: fallback.color,
      active: fallback.tab === activeTab,
    });
  }

  const openDetail = (asset: Asset) => {
    router.push({ pathname: "/(app)/detail", params: { ticker: asset.ticker } });
  };

  const glowColor = positive ? "rgba(0,230,118," : "rgba(255,68,68,";

  return (
    <View style={s.container}>
      {/* ── Glow effect from top ── */}
      <LinearGradient
        colors={[glowColor + "0.30)", glowColor + "0.12)", glowColor + "0.0)"]}
        locations={[0, 0.45, 1]}
        style={s.glowGradient}
        pointerEvents="none"
      />

      <View style={[s.fixedTop, { paddingTop: insets.top + 8 }]}>
        <View style={s.topBar}>
          <Text style={s.topBarTitle}>Portfolio</Text>
          <View style={s.topBarRight}>
            <Pressable onPress={() => router.push("/(app)/explore")} hitSlop={10}>
              <Ionicons name="search" size={24} color={colors.text.primary} />
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/notifications")} hitSlop={10}>
              <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroSection}>
          <Text style={s.overline}>Tu portfolio</Text>
          <Text style={s.heroAmount}>{formatARS(totalValue)}</Text>
          <Text style={[s.heroChange, { color: accentColor }]}>
            {positive ? "+" : ""}
            {formatARS(change.amount)} ({positive ? "+" : ""}
            {change.pct.toFixed(2)}%) {timeLabels[activeTime]}
          </Text>

          <View style={s.chart}>
            {points.map((point, index) => {
              if (index === 0) return null;
              const previous = points[index - 1];
              const segmentWidth = 100 / (points.length - 1);
              const minimum = Math.min(...points);
              const maximum = Math.max(...points);
              const range = maximum - minimum || 1;
              const y1 = 100 - ((previous - minimum) / range) * 100;
              const y2 = 100 - ((point - minimum) / range) * 100;

              return (
                <View
                  key={index}
                  style={{
                    position: "absolute",
                    left: `${(index - 1) * segmentWidth}%`,
                    width: `${segmentWidth}%`,
                    top: `${(y1 + y2) / 2}%`,
                    height: 2,
                    backgroundColor: accentColor,
                    borderRadius: 999,
                    transform: [{ rotate: `${Math.atan2(y2 - y1, segmentWidth) * 0.32}rad` }],
                  }}
                />
              );
            })}
          </View>

          <View style={s.timeRow}>
            {timeFilters.map((filter) => {
              const isActive = activeTime === filter;
              return (
                <Pressable
                  key={filter}
                  style={[
                    s.timeButton,
                    {
                      backgroundColor: isActive ? accentColor : "transparent",
                      borderColor: isActive ? accentColor : "transparent",
                    },
                  ]}
                  onPress={() => setActiveTime(filter)}
                >
                  <Text style={[s.timeButtonText, { color: isActive ? "#000000" : accentColor }]}>
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Posiciones</Text>
          {filteredAssets.map((asset) => {
            const value = asset.price * (asset.qty || 1);
            const isUp = asset.change >= 0;
            return (
              <Pressable key={asset.ticker} style={s.positionRow} onPress={() => openDetail(asset)}>
                <View style={s.positionIcon}>
                  <Text style={s.positionIconText}>{asset.ticker.substring(0, 2)}</Text>
                </View>
                <View style={s.positionInfo}>
                  <Text style={s.positionTicker}>{asset.ticker}</Text>
                  <Text style={s.positionQty}>
                    {asset.qty || 1} unidad{(asset.qty || 1) > 1 ? "es" : ""}
                  </Text>
                </View>
                <View style={s.positionValues}>
                  <Text style={s.positionValue}>{formatARS(value)}</Text>
                  <Text style={[s.positionChange, { color: isUp ? colors.brand[500] : colors.red }]}>
                    {isUp ? "+" : ""}
                    {asset.change.toFixed(2)}%
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.thickDivider} />

        <View style={s.donutSection}>
          <View style={s.donutWrap}>
            <View style={s.donutBase} />
            {donutSegments.map((segment, index) => {
              const angle = (index / donutSegments.length) * Math.PI * 2;
              const radius = 104;
              const x = Math.cos(angle - Math.PI / 2) * radius;
              const y = Math.sin(angle - Math.PI / 2) * radius;

              return (
                <View
                  key={`${segment.tab}-${index}`}
                  style={[
                    s.donutSegment,
                    {
                      backgroundColor: segment.color,
                      transform: [
                        { translateX: x },
                        { translateY: y },
                        { rotate: `${angle}rad` },
                        { scaleY: segment.active ? 1.22 : 1 },
                      ],
                      opacity: segment.active ? 1 : 0.95,
                    },
                  ]}
                />
              );
            })}

            <View style={s.donutHole}>
              <Text style={s.categoryTotalLabel}>{activeTab}</Text>
              <Text style={s.categoryTotalValue}>{formatARS(activeSlice.value)}</Text>
              <Text style={s.categoryTotalPct}>
                {activeSlice.pct.toFixed(1)}% del portfolio
              </Text>
            </View>
          </View>

          <View style={s.tabsRow}>
            {donutData.map((slice) => {
              const active = slice.tab === activeTab;
              return (
                <Pressable
                  key={slice.tab}
                  onPress={() => setActiveTab(slice.tab)}
                  style={[
                    s.tabPill,
                    active && {
                      backgroundColor: slice.color,
                      borderColor: slice.color,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.tabDot,
                      { backgroundColor: active ? "#000000" : slice.color },
                    ]}
                  />
                  <Text
                    style={[
                      s.tabPillText,
                      {
                        color: active
                          ? slice.tab === "Acciones"
                            ? "#000000"
                            : "#FFFFFF"
                          : colors.text.primary,
                      },
                    ]}
                  >
                    {slice.tab}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  glowGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    zIndex: 1,
  },
  fixedTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  topBarRight: { flexDirection: "row", gap: 20 },
  heroSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  overline: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 38,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1.2,
  },
  heroChange: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  chart: {
    height: 300,
    position: "relative",
    marginTop: 12,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
  },
  timeButton: {
    minWidth: 42,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  timeButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  donutSection: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  donutWrap: {
    width: 280,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  donutBase: {
    position: "absolute",
    width: 236,
    height: 236,
    borderRadius: 118,
    borderWidth: 22,
    borderColor: colors.surface[200],
  },
  donutSegment: {
    position: "absolute",
    width: 10,
    height: 22,
    borderRadius: 999,
  },
  donutHole: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface[100],
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: "700",
  },
  categoryTotalLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  categoryTotalValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  categoryTotalPct: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 4,
    textAlign: "center",
  },
  thickDivider: {
    height: 6,
    backgroundColor: colors.surface[100],
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 24,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  positionIconText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text.primary,
  },
  positionInfo: { flex: 1 },
  positionTicker: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  positionQty: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  positionValues: { alignItems: "flex-end" },
  positionValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  positionChange: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
});
