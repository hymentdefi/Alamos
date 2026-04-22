import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useTheme,
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from "../../lib/theme";
import {
  assets,
  assetIconCode,
  categoryLabels,
  formatARS,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../lib/data/assets";
import { useAuth } from "../../lib/auth/context";
import { AlamosLogo } from "../../lib/components/Logo";
import { Sparkline } from "../../lib/components/Sparkline";

type TabId = "tenencias" | "actividad" | "distribucion";

const activityItems = [
  {
    id: "1",
    icon: "check-circle" as const,
    title: "Compra AAPL",
    date: "Hoy, 14:32",
    amount: -48240,
  },
  {
    id: "2",
    icon: "arrow-down-left" as const,
    title: "Ingreso transferencia",
    date: "Ayer, 10:15",
    amount: 250000,
  },
  {
    id: "3",
    icon: "check-circle" as const,
    title: "Compra AL30",
    date: "14 abr, 09:45",
    amount: -71540,
  },
  {
    id: "4",
    icon: "dollar-sign" as const,
    title: "Dividendo AAPL",
    date: "12 abr, 16:20",
    amount: 4280,
  },
  {
    id: "5",
    icon: "arrow-up-right" as const,
    title: "Venta parcial MSFT",
    date: "10 abr, 11:02",
    amount: 83490,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("tenencias");

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";

  const held = useMemo(() => assets.filter((a) => a.held), []);
  const total = useMemo(
    () => held.reduce((sum, a) => sum + a.price * (a.qty ?? 1), 0),
    [held],
  );

  const dayPct = 1.96;
  const dayDelta = Math.round((total * dayPct) / 100);

  const byCategory = useMemo(() => {
    const map = new Map<AssetCategory, { total: number; items: Asset[] }>();
    for (const a of held) {
      const v = a.price * (a.qty ?? 1);
      const entry = map.get(a.category) ?? { total: 0, items: [] };
      entry.total += v;
      entry.items.push(a);
      map.set(a.category, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [held]);

  const openDetail = (asset: Asset) => {
    if (asset.category === "efectivo") {
      router.push("/(app)/transfer");
      return;
    }
    router.push({
      pathname: "/(app)/detail",
      params: { ticker: asset.ticker },
    });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <AlamosLogo variant="mark" tone="light" size={28} />
        <View style={s.topActions}>
          <Pressable
            style={[s.topBtn, { backgroundColor: c.surfaceHover }]}
            onPress={() => router.push("/(app)/transfer")}
            hitSlop={8}
          >
            <Feather name="plus" size={18} color={c.text} />
          </Pressable>
          <Pressable
            style={[s.topBtn, { backgroundColor: c.surfaceHover }]}
            onPress={() => router.push("/(app)/notifications")}
            hitSlop={8}
          >
            <Feather name="bell" size={18} color={c.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroBlock}>
          <Text style={[s.greet, { color: c.textMuted }]}>
            Hola, {firstName}
          </Text>
          <Text style={[s.balance, { color: c.text }]}>{formatARS(total)}</Text>
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

        <View style={s.tabsWrap}>
          <TabStrip tab={tab} onChange={setTab} />
        </View>

        <View style={s.tabContent}>
          {tab === "tenencias" ? (
            <Tenencias byCategory={byCategory} onOpen={openDetail} />
          ) : null}
          {tab === "actividad" ? <Actividad /> : null}
          {tab === "distribucion" ? (
            <Distribucion byCategory={byCategory} total={total} />
          ) : null}
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
    { id: "tenencias", label: "Tenencias" },
    { id: "actividad", label: "Actividad" },
    { id: "distribucion", label: "Distribución" },
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
              style={[s.tabLabel, { color: active ? c.text : c.textMuted }]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Tenencias({
  byCategory,
  onOpen,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
  onOpen: (a: Asset) => void;
}) {
  const { c } = useTheme();
  return (
    <View>
      {byCategory.map(([cat, data]) => (
        <View key={cat} style={s.groupBlock}>
          <View style={s.groupHead}>
            <Text style={[s.groupTitle, { color: c.text }]}>
              {categoryLabels[cat]}
            </Text>
            <Text style={[s.groupValue, { color: c.textMuted }]}>
              {formatARS(data.total)}
            </Text>
          </View>
          {data.items.map((asset, i) => (
            <AssetRow
              key={asset.ticker}
              asset={asset}
              first={i === 0}
              onPress={() => onOpen(asset)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Actividad() {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {activityItems.map((item, i) => {
        const positive = item.amount > 0;
        return (
          <View
            key={item.id}
            style={[
              s.activityRow,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: c.border,
              },
            ]}
          >
            <View
              style={[
                s.activityIcon,
                {
                  backgroundColor: positive ? c.greenDim : c.surfaceHover,
                },
              ]}
            >
              <Feather
                name={item.icon}
                size={16}
                color={positive ? c.greenDark : c.text}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.activityTitle, { color: c.text }]}>
                {item.title}
              </Text>
              <Text style={[s.activityDate, { color: c.textMuted }]}>
                {item.date}
              </Text>
            </View>
            <Text
              style={[
                s.activityAmount,
                { color: positive ? c.greenDark : c.text },
              ]}
            >
              {positive ? "+" : "−"}
              {formatARS(item.amount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Distribucion({
  byCategory,
  total,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
  total: number;
}) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={[s.barTrack, { backgroundColor: c.surfaceSunken }]}>
        {byCategory.map(([cat, data], i) => {
          const pct = (data.total / total) * 100;
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

      <View style={{ gap: 10, marginTop: 16 }}>
        {byCategory.map(([cat, data]) => {
          const pct = (data.total / total) * 100;
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
  );
}

function AssetRow({
  asset,
  first,
  onPress,
}: {
  asset: Asset;
  first?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const isCash = asset.category === "efectivo";
  const value = isCash
    ? (asset.qty ?? 0)
    : asset.price * (asset.qty ?? 1);
  const up = asset.change >= 0;

  const bg =
    asset.iconTone === "dark"
      ? c.ink
      : asset.iconTone === "accent"
      ? c.green
      : c.surfaceSunken;
  const fg =
    asset.iconTone === "dark"
      ? c.bg
      : asset.iconTone === "accent"
      ? c.ink
      : c.textSecondary;

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
      <View style={[s.rowIcon, { backgroundColor: bg }]}>
        <Text style={[s.rowIconText, { color: fg }]}>
          {assetIconCode(asset)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTicker, { color: c.text }]}>
          {isCash ? asset.name : asset.ticker}
        </Text>
        <Text style={[s.rowSub, { color: c.textMuted }]}>
          {isCash
            ? asset.subLabel
            : `${asset.qty} ${asset.qty === 1 ? "unidad" : "unidades"} · ${formatARS(asset.price)}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.rowPrice, { color: c.text }]}>{formatARS(value)}</Text>
        {!isCash ? (
          <Text
            style={[s.rowChange, { color: up ? c.greenDark : c.red }]}
          >
            {formatPct(asset.change)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function allocationColor(cat: AssetCategory, c: ThemeColors): string {
  switch (cat) {
    case "efectivo":
      return c.green;
    case "cedears":
      return c.ink;
    case "bonos":
      return c.greenDark;
    case "fci":
      return c.textSecondary;
    case "acciones":
      return c.textMuted;
    case "obligaciones":
      return c.borderStrong;
    default:
      return c.textFaint;
  }
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
  topActions: {
    flexDirection: "row",
    gap: 8,
  },
  topBtn: {
    width: 36,
    height: 36,
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
    fontFamily: fontFamily[500],
    fontSize: 15,
    letterSpacing: -0.15,
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
    marginBottom: 4,
  },
  deltaTri: {
    fontFamily: fontFamily[700],
    fontSize: 12,
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
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  tabContent: {
    marginTop: 4,
  },
  groupBlock: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  groupTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
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
    fontSize: 14,
    letterSpacing: -0.3,
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
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: 14,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  activityDate: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  activityAmount: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  barTrack: {
    height: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    overflow: "hidden",
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
});
