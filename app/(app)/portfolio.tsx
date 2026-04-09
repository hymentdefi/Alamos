import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";

const heldAssets = assets.filter((a) => a.held);
const totalValue = heldAssets.reduce((s, a) => s + a.price * (a.qty || 1), 0);

/* ─── Category tabs & allocation ─── */
const tabs = ["Acciones", "Bonos", "CEDEARs"] as const;
type Tab = (typeof tabs)[number];

const categoryMap: Record<Tab, Asset["category"]> = {
  Acciones: "acciones",
  Bonos: "bonos",
  CEDEARs: "cedears",
};

function getCategoryValue(cat: Asset["category"]) {
  return heldAssets
    .filter((a) => a.category === cat)
    .reduce((s, a) => s + a.price * (a.qty || 1), 0);
}

/* Allocation bubbles data */
const bubbles = tabs.map((tab) => {
  const val = getCategoryValue(categoryMap[tab]);
  const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
  return { label: tab, pct, value: val };
});

const bubbleColors = [colors.brand[500], "#448AFF", "#FF9100"];

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("Acciones");

  const filteredAssets = heldAssets.filter(
    (a) => a.category === categoryMap[activeTab]
  );

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
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </Pressable>
        <View style={s.topBarRight}>
          <Pressable onPress={() => router.push("/(app)/explore")} hitSlop={10}>
            <Ionicons name="search" size={24} color={colors.text.primary} />
          </Pressable>
          <Pressable onPress={() => router.push("/(app)/notifications")} hitSlop={10}>
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={s.tabsRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[s.tab, activeTab === tab && s.tabActive]}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Bubble allocation chart (Robinhood style) ── */}
      <View style={s.bubblesArea}>
        {bubbles.map((b, i) => {
          const isActive = b.label === activeTab;
          const size = 60 + b.pct * 1.2;
          return (
            <Pressable
              key={b.label}
              onPress={() => setActiveTab(b.label as Tab)}
              style={[
                s.bubble,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: isActive ? "#FFFFFF" : colors.surface[200],
                  borderWidth: isActive ? 0 : 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  s.bubblePct,
                  { color: isActive ? "#000" : colors.text.primary },
                ]}
              >
                {b.pct.toFixed(0)}%
              </Text>
              <Text
                style={[
                  s.bubbleLabel,
                  { color: isActive ? "#000" : colors.text.secondary },
                ]}
              >
                {b.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Category total ── */}
      <View style={s.categoryTotal}>
        <Text style={s.categoryTotalLabel}>{activeTab}</Text>
        <Text style={s.categoryTotalValue}>
          {formatARS(getCategoryValue(categoryMap[activeTab]))}
        </Text>
        <Text style={s.categoryTotalPct}>
          {((getCategoryValue(categoryMap[activeTab]) / totalValue) * 100).toFixed(1)}% del portfolio
        </Text>
      </View>

      {/* ── Divider ── */}
      <View style={s.thickDivider} />

      {/* ── Positions ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Posiciones</Text>
        {filteredAssets.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No tenés activos en esta categoría.</Text>
            <Pressable
              style={s.investBtn}
              onPress={() => router.push("/(app)/explore")}
            >
              <Text style={s.investBtnText}>Explorar inversiones</Text>
            </Pressable>
          </View>
        )}
        {filteredAssets.map((a) => {
          const val = a.price * (a.qty || 1);
          const isUp = a.change >= 0;
          return (
            <Pressable
              key={a.ticker}
              style={s.positionRow}
              onPress={() => openDetail(a)}
            >
              <View style={s.positionIcon}>
                <Text style={s.positionIconText}>
                  {a.ticker.substring(0, 2)}
                </Text>
              </View>
              <View style={s.positionInfo}>
                <Text style={s.positionTicker}>{a.ticker}</Text>
                <Text style={s.positionQty}>
                  {a.qty || 1} unidad{(a.qty || 1) > 1 ? "es" : ""}
                </Text>
              </View>
              {/* Mini chart */}
              <View style={s.miniChart}>
                <View style={s.miniChartInner}>
                  {[0, 1, 2, 3, 4, 5, 6].map((j) => {
                    const h =
                      6 + Math.abs(Math.sin(a.price / 1000 + j * 0.8)) * 16;
                    return (
                      <View
                        key={j}
                        style={{
                          width: 2,
                          height: h,
                          backgroundColor: isUp
                            ? colors.brand[500]
                            : colors.red,
                          borderRadius: 1,
                          opacity: 0.7,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
              <View style={s.positionValues}>
                <Text style={s.positionValue}>{formatARS(val)}</Text>
                <Text
                  style={[
                    s.positionChange,
                    { color: isUp ? colors.brand[500] : colors.red },
                  ]}
                >
                  {isUp ? "+" : ""}
                  {a.change.toFixed(2)}%
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── Divider ── */}
      <View style={s.thickDivider} />

      {/* ── Portfolio summary ── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Resumen</Text>

        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Valor total del portfolio</Text>
          <Text style={s.summaryValue}>{formatARS(totalValue)}</Text>
        </View>
        <View style={s.summaryDivider} />

        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Rendimiento total</Text>
          <Text style={[s.summaryValue, { color: colors.brand[500] }]}>
            +12.4%
          </Text>
        </View>
        <View style={s.summaryDivider} />

        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Activos en cartera</Text>
          <Text style={s.summaryValue}>{heldAssets.length}</Text>
        </View>
        <View style={s.summaryDivider} />

        {/* Allocation bar */}
        <Text style={s.allocTitle}>Distribución</Text>
        <View style={s.allocBar}>
          {bubbles.map((b, i) => (
            <View
              key={b.label}
              style={{
                width: `${b.pct}%` as any,
                height: 8,
                backgroundColor: bubbleColors[i],
              }}
            />
          ))}
        </View>
        <View style={s.legend}>
          {bubbles.map((b, i) => (
            <View key={b.label} style={s.legendItem}>
              <View
                style={[s.legendDot, { backgroundColor: bubbleColors[i] }]}
              />
              <Text style={s.legendText}>
                {b.label} {b.pct.toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Legal disclaimer ── */}
      <View style={s.legalSection}>
        <Text style={s.legalText}>
          Toda inversión implica riesgo, incluyendo la posible pérdida del
          capital invertido. Las operaciones con valores negociables son
          ofrecidas por Álamos Capital S.A., agente registrado en la CNV.
        </Text>
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

  /* Tabs */
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 24,
    paddingBottom: 8,
  },
  tab: {
    paddingBottom: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.text.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text.muted,
  },
  tabTextActive: {
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* Bubbles */
  bubblesArea: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 16,
    flexWrap: "wrap",
  },
  bubble: {
    alignItems: "center",
    justifyContent: "center",
  },
  bubblePct: {
    fontSize: 18,
    fontWeight: "800",
  },
  bubbleLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  /* Category total */
  categoryTotal: {
    alignItems: "center",
    paddingBottom: 24,
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
  },

  /* Dividers */
  thickDivider: {
    height: 6,
    backgroundColor: colors.surface[100],
  },

  /* Section */
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

  /* Empty state */
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  investBtn: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
  },
  investBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  /* Positions */
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
  miniChart: {
    width: 56,
    height: 28,
    justifyContent: "center",
    marginHorizontal: 8,
  },
  miniChartInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: "100%",
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

  /* Summary */
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  summaryLabel: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  /* Allocation */
  allocTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
    marginTop: 16,
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
    gap: 16,
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
    fontSize: 13,
    color: colors.text.secondary,
  },

  /* Legal */
  legalSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  legalText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
    textAlign: "center",
  },
});
