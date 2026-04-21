import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, type, radius, spacing, fontFamily } from "../../lib/theme";
import { Sparkline } from "../../lib/components/Sparkline";
import {
  assets,
  assetIconCode,
  formatARS,
  formatPct,
  type Asset,
} from "../../lib/data/assets";
import { useAuth } from "../../lib/auth/context";
import { AlamosLogo } from "../../lib/components/Logo";

const heldAssets = assets.filter((a) => a.held);

const totalHoldings = heldAssets.reduce(
  (sum, a) => sum + a.price * (a.qty ?? 1),
  0,
);
const deltaPct = 1.96;
const deltaAmount = Math.round((totalHoldings * deltaPct) / 100);

const newsItems = [
  {
    id: "1",
    category: "Mercado",
    title: "Bonos en dólares suben fuerte tras datos de reservas",
    time: "hace 2h",
  },
  {
    id: "2",
    category: "CEDEARs",
    title: "NVIDIA cierra en máximos históricos, acompañada por el sector tech",
    time: "hace 4h",
  },
  {
    id: "3",
    category: "Macro",
    title: "Inflación de marzo se ubicaría por debajo del 3% según privados",
    time: "hace 6h",
  },
];

type TabId = "cartera" | "mercado" | "noticias";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("cartera");

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";

  const marketAssets = useMemo(
    () =>
      [...assets]
        .filter((a) => !a.held)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 5),
    [],
  );

  const openDetail = (asset: Asset) => {
    router.push({ pathname: "/(app)/detail", params: { ticker: asset.ticker } });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <AlamosLogo variant="mark" tone="light" size={28} />
        <Pressable
          style={s.bellButton}
          hitSlop={12}
          onPress={() => router.push("/(app)/notifications")}
        >
          <Feather name="bell" size={20} color={c.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroBlock}>
          <Text style={[s.greet, { color: c.textMuted }]}>Hola, {firstName}</Text>
          <Text style={[s.balance, { color: c.text }]}>{formatARS(totalHoldings)}</Text>
          <View style={s.deltaRow}>
            <Text style={[s.deltaTriangle, { color: c.greenDark }]}>▲</Text>
            <Text style={[s.deltaText, { color: c.greenDark }]}>
              {formatARS(deltaAmount)}
            </Text>
            <Text style={[s.deltaSep, { color: c.greenDark }]}>·</Text>
            <Text style={[s.deltaText, { color: c.greenDark }]}>
              {formatPct(deltaPct)} hoy
            </Text>
          </View>

          <Sparkline color={c.greenDark} style={{ marginTop: 6 }} />
        </View>

        <View style={s.tabsWrap}>
          <TabStrip tab={tab} onChange={setTab} />
        </View>

        <View style={s.listBlock}>
          {tab === "cartera" && (
            <View>
              {heldAssets.map((asset, i) => (
                <AssetRow
                  key={asset.ticker}
                  asset={asset}
                  onPress={() => openDetail(asset)}
                  first={i === 0}
                />
              ))}
              <Pressable
                style={s.seeAll}
                onPress={() => router.push("/(app)/portfolio")}
              >
                <Text style={[s.seeAllText, { color: c.text }]}>Ver toda la cartera</Text>
                <Feather name="arrow-right" size={16} color={c.text} />
              </Pressable>
            </View>
          )}

          {tab === "mercado" && (
            <View>
              {marketAssets.map((asset, i) => (
                <AssetRow
                  key={asset.ticker}
                  asset={asset}
                  onPress={() => openDetail(asset)}
                  first={i === 0}
                  showPrice
                />
              ))}
              <Pressable
                style={s.seeAll}
                onPress={() => router.push("/(app)/explore")}
              >
                <Text style={[s.seeAllText, { color: c.text }]}>Ver todo el mercado</Text>
                <Feather name="arrow-right" size={16} color={c.text} />
              </Pressable>
            </View>
          )}

          {tab === "noticias" && (
            <View>
              {newsItems.map((n, i) => (
                <Pressable
                  key={n.id}
                  style={[
                    s.newsRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  ]}
                  onPress={() => router.push("/(app)/news")}
                >
                  <Text style={[s.newsCategory, { color: c.textMuted }]}>
                    {n.category.toUpperCase()} · {n.time}
                  </Text>
                  <Text style={[s.newsTitle, { color: c.text }]}>{n.title}</Text>
                </Pressable>
              ))}
              <Pressable style={s.seeAll} onPress={() => router.push("/(app)/news")}>
                <Text style={[s.seeAllText, { color: c.text }]}>Ver todas las noticias</Text>
                <Feather name="arrow-right" size={16} color={c.text} />
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function TabStrip({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
}) {
  const { c } = useTheme();
  const tabs: { id: TabId; label: string }[] = [
    { id: "cartera", label: "Cartera" },
    { id: "mercado", label: "Mercado" },
    { id: "noticias", label: "Noticias" },
  ];

  return (
    <View style={[s.tabGroup, { backgroundColor: c.surfaceHover }]}>
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <Pressable
            key={t.id}
            style={[
              s.tab,
              active && [
                s.tabActive,
                { backgroundColor: c.surface, shadowColor: c.ink },
              ],
            ]}
            onPress={() => onChange(t.id)}
          >
            <Text
              style={[
                s.tabLabel,
                { color: active ? c.text : c.textMuted },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AssetRow({
  asset,
  onPress,
  first,
  showPrice = false,
}: {
  asset: Asset;
  onPress: () => void;
  first?: boolean;
  showPrice?: boolean;
}) {
  const { c } = useTheme();
  const value = showPrice ? asset.price : asset.price * (asset.qty ?? 1);
  const up = asset.change >= 0;
  const dark = asset.iconTone === "dark";

  return (
    <Pressable
      style={[
        s.row,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
      ]}
      onPress={onPress}
    >
      <View
        style={[
          s.icon,
          {
            backgroundColor: dark ? c.ink : c.surfaceSunken,
          },
        ]}
      >
        <Text
          style={[
            s.iconText,
            { color: dark ? c.bg : c.textSecondary },
          ]}
        >
          {assetIconCode(asset)}
        </Text>
      </View>
      <View style={s.rowMiddle}>
        <Text style={[s.rowTicker, { color: c.text }]}>{asset.ticker}</Text>
        <Text style={[s.rowSub, { color: c.textMuted }]}>{asset.subLabel}</Text>
      </View>
      <View style={s.rowRight}>
        <Text style={[s.rowPrice, { color: c.text }]}>{formatARS(value)}</Text>
        <Text
          style={[
            s.rowChange,
            { color: up ? c.greenDark : c.red },
          ]}
        >
          {formatPct(asset.change)}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  greet: {
    ...type.body,
    marginBottom: 6,
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -2,
    marginBottom: 8,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  deltaTriangle: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    lineHeight: 14,
  },
  deltaText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  deltaSep: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    opacity: 0.6,
  },
  tabsWrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
  },
  tabGroup: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  tabActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabLabel: {
    ...type.smallStrong,
  },
  listBlock: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: 14,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.3,
  },
  rowMiddle: { flex: 1 },
  rowTicker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  rowSub: {
    ...type.small,
    marginTop: 2,
  },
  rowRight: { alignItems: "flex-end" },
  rowPrice: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowChange: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  newsRow: {
    paddingVertical: spacing.lg,
  },
  newsCategory: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
  },
  newsTitle: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "transparent",
  },
  seeAllText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
});
