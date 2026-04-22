import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  RefreshControl,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useTheme,
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from "../../../lib/theme";
import {
  assets,
  assetIconCode,
  categoryLabels,
  formatARS,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../../lib/data/assets";
import { useAuth } from "../../../lib/auth/context";
import { Sparkline, seriesFromSeed } from "../../../lib/components/Sparkline";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { MoneyIcon } from "../../../lib/components/MoneyIcon";
import { SideMenu } from "../../../lib/components/SideMenu";
import { ProHome } from "../../../lib/components/pro/ProHome";
import { useProMode } from "../../../lib/pro/context";
import { EdgeSwipeOpener } from "../../../lib/components/EdgeSwipeOpener";

type TabId = "tenencias" | "actividad" | "distribucion";
type Range = "1D" | "1S" | "1M" | "3M" | "1A";

const ranges: Range[] = ["1D", "1S", "1M", "3M", "1A"];

/** Variación % por rango — determina el trend y color del chart. */
const rangeChanges: Record<Range, number> = {
  "1D": 1.96,
  "1S": 3.24,
  "1M": -2.1,
  "3M": 8.45,
  "1A": 23.7,
};

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
  const { isPro } = useProMode();
  if (isPro) return <ProHome />;
  return <BaseHome />;
}

function BaseHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [tab, setTab] = useState<TabId>("tenencias");
  const [range, setRange] = useState<Range>("1D");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      setRefreshing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }, 1100);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = e.nativeEvent.contentOffset.y;
    },
    [],
  );

  // Tap sobre la tab Inicio estando en Inicio:
  //   · si no estoy arriba → scroll al tope
  //   · si ya estoy arriba → disparar refresh (con animación de pull-to-refresh)
  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (!isFocused) return;
      if (scrollYRef.current > 8) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else if (!refreshing) {
        onRefresh();
      }
    });
    return unsub;
  }, [navigation, isFocused, refreshing, onRefresh]);

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";

  const held = useMemo(() => assets.filter((a) => a.held), []);
  const total = useMemo(
    () => held.reduce((sum, a) => sum + a.price * (a.qty ?? 1), 0),
    [held],
  );

  const series = useMemo(
    () => generateSeries(total, rangeChanges[range], `home-${range}`),
    [total, range],
  );

  const rangePct = rangeChanges[range];
  const isUp = rangePct >= 0;
  const trendColor = isUp ? c.greenDark : c.red;

  const current = scrubIndex != null ? series[scrubIndex] : series[series.length - 1];
  const rangeStart = series[0];
  const displayDelta = current - rangeStart;
  const displayPct = (displayDelta / rangeStart) * 100;
  const displayIsUp = displayDelta >= 0;

  const timeLabel =
    scrubIndex != null
      ? indexLabel(range, scrubIndex, series.length)
      : rangeSubtitle(range);

  const byCategory = useMemo(() => {
    const map = new Map<AssetCategory, { total: number; items: Asset[] }>();
    for (const a of held) {
      const v = a.price * (a.qty ?? 1);
      const entry = map.get(a.category) ?? { total: 0, items: [] };
      entry.total += v;
      entry.items.push(a);
      map.set(a.category, entry);
    }
    return [...map.entries()].sort((a, b) => {
      // Dinero siempre arriba de todo
      if (a[0] === "efectivo") return -1;
      if (b[0] === "efectivo") return 1;
      return b[1].total - a[1].total;
    });
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
        <Pressable
          style={[s.topBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
        >
          <Feather name="menu" size={18} color={c.text} />
        </Pressable>
        <View style={s.topActions}>
          <Pressable
            style={[s.topPill, { backgroundColor: c.surfaceHover }]}
            onPress={() =>
              router.push({
                pathname: "/(app)/transfer",
                params: { mode: "deposit" },
              })
            }
            hitSlop={8}
          >
            <Feather name="arrow-down-left" size={14} color={c.text} />
            <Text style={[s.topPillText, { color: c.text }]}>Ingresar</Text>
          </Pressable>
          <Pressable
            style={[s.topPill, { backgroundColor: c.surfaceHover }]}
            onPress={() =>
              router.push({
                pathname: "/(app)/transfer",
                params: { mode: "withdraw" },
              })
            }
            hitSlop={8}
          >
            <Feather name="arrow-up-right" size={14} color={c.text} />
            <Text style={[s.topPillText, { color: c.text }]}>Retirar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrubIndex == null}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.textMuted}
            colors={[c.textMuted]}
            progressBackgroundColor={c.surface}
          />
        }
      >
        <View style={s.heroBlock}>
          <Text style={[s.greet, { color: c.textMuted }]}>
            Hola, {firstName}
          </Text>
          <AmountDisplay value={current} size={46} style={{ marginBottom: 8 }} />
          <View style={s.deltaRow}>
            <Text style={[s.deltaTri, { color: trendColor }]}>
              {displayIsUp ? "▲" : "▼"}
            </Text>
            <Text style={[s.deltaText, { color: trendColor }]}>
              {formatARS(Math.abs(displayDelta))}
            </Text>
            <Text style={[s.deltaSep, { color: trendColor }]}>·</Text>
            <Text style={[s.deltaText, { color: trendColor }]}>
              {formatPct(displayPct)}
            </Text>
            <Text style={[s.deltaSep, { color: c.textMuted }]}>·</Text>
            <Text style={[s.timeLabel, { color: c.textMuted }]}>{timeLabel}</Text>
          </View>

          <Sparkline
            series={series}
            color={trendColor}
            onScrub={(idx) => setScrubIndex(idx)}
            onScrubEnd={() => setScrubIndex(null)}
            style={{ marginTop: 18 }}
          />

          <View style={s.rangeRow}>
            {ranges.map((r) => {
              const active = r === range;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  style={[
                    s.rangePill,
                    active && { backgroundColor: trendColor },
                  ]}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      s.rangeText,
                      {
                        color: active ? c.bg : c.textMuted,
                      },
                    ]}
                  >
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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

        <FeaturedFunds onOpen={openDetail} onSeeAll={() => router.push("/(app)/explore")} />
        <UniversityCallout />
      </ScrollView>

      <EdgeSwipeOpener onOpen={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function FeaturedFunds({
  onOpen,
  onSeeAll,
}: {
  onOpen: (a: Asset) => void;
  onSeeAll: () => void;
}) {
  const { c } = useTheme();
  const funds = useMemo(
    () =>
      assets
        .filter((a) => a.category === "fci")
        .sort((a, b) => b.change - a.change)
        .slice(0, 3),
    [],
  );

  if (funds.length === 0) return null;

  return (
    <View style={s.featuredBlock}>
      <View style={s.featuredHead}>
        <Text style={[s.featuredEyebrow, { color: c.textMuted }]}>
          FONDOS POPULARES
        </Text>
        <Text style={[s.featuredSub, { color: c.text }]}>
          Tu plata rinde todos los días, desde $ 1.000.
        </Text>
      </View>

      <View
        style={[
          s.featuredCard,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        {funds.map((f, i) => {
          const up = f.change >= 0;
          return (
            <Pressable
              key={f.ticker}
              onPress={() => onOpen(f)}
              style={[
                s.featuredRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.border,
                },
              ]}
            >
              <View style={[s.featuredIcon, { backgroundColor: c.surfaceSunken }]}>
                <Text style={[s.featuredIconText, { color: c.textSecondary }]}>
                  {f.iconCode ?? f.ticker.slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.featuredName, { color: c.text }]}>
                  {f.name}
                </Text>
                <Text style={[s.featuredSubline, { color: c.textMuted }]}>
                  {f.subLabel}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.featuredChange, { color: up ? c.greenDark : c.red }]}>
                  {formatPct(f.change)}
                </Text>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={c.textFaint}
                  style={{ marginTop: 2 }}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={s.featuredSeeAll} onPress={onSeeAll}>
        <Text style={[s.featuredSeeAllText, { color: c.text }]}>
          Ver todos los fondos
        </Text>
        <Feather name="arrow-right" size={14} color={c.text} />
      </Pressable>
    </View>
  );
}

function UniversityCallout() {
  const { c } = useTheme();
  return (
    <Pressable
      style={[
        s.uniCard,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
      onPress={() =>
        Linking.openURL("https://alamos.capital/university").catch(() => {})
      }
    >
      <View style={[s.uniIcon, { backgroundColor: c.surfaceHover }]}>
        <Feather name="book-open" size={18} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.uniTitle, { color: c.text }]}>
          ¿Primera vez invirtiendo?
        </Text>
        <Text style={[s.uniBody, { color: c.textMuted }]}>
          Aprendé desde cero en{" "}
          <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
            Alamos University
          </Text>
          . Guías, tutoriales y casos del mercado argentino.
        </Text>
      </View>
      <Feather name="arrow-up-right" size={18} color={c.textMuted} />
    </Pressable>
  );
}

/* ─── Helpers ─── */

/** Genera una serie realista: va desde (total / (1 + pct/100)) hasta total, con ruido. */
function generateSeries(total: number, pct: number, seed: string): number[] {
  const length = 40;
  const startValue = total / (1 + pct / 100);
  const noise = seriesFromSeed(seed, length, "flat");
  const noiseScale = total * 0.018;
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const linear = startValue + (total - startValue) * t;
    const normalized = (noise[i] - 100) / 6;
    out.push(linear + normalized * noiseScale);
  }
  out[length - 1] = total;
  return out;
}

function rangeSubtitle(r: Range): string {
  switch (r) {
    case "1D":
      return "hoy";
    case "1S":
      return "esta semana";
    case "1M":
      return "este mes";
    case "3M":
      return "3 meses";
    case "1A":
      return "1 año";
  }
}

function indexLabel(r: Range, index: number, length: number): string {
  const t = 1 - index / (length - 1);
  switch (r) {
    case "1D": {
      const h = Math.round(t * 24);
      if (h === 0) return "ahora";
      if (h === 1) return "hace 1h";
      return `hace ${h}h`;
    }
    case "1S": {
      const d = Math.round(t * 7);
      if (d === 0) return "hoy";
      if (d === 1) return "hace 1 día";
      return `hace ${d} días`;
    }
    case "1M": {
      const d = Math.round(t * 30);
      if (d === 0) return "hoy";
      return `hace ${d} días`;
    }
    case "3M": {
      const w = Math.round(t * 13);
      if (w === 0) return "hoy";
      if (w === 1) return "hace 1 sem";
      return `hace ${w} sem`;
    }
    case "1A": {
      const m = Math.round(t * 12);
      if (m === 0) return "hoy";
      if (m === 1) return "hace 1 mes";
      return `hace ${m} meses`;
    }
  }
}

/* ─── Subcomponentes ─── */

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
  const isUSD = asset.ticker === "USD";
  const qty = asset.qty ?? 0;

  const primaryValue = isCash
    ? isUSD
      ? `US$ ${qty.toLocaleString("es-AR")}`
      : formatARS(qty)
    : formatARS(asset.price * (asset.qty ?? 1));
  const secondaryValue = isCash && isUSD ? formatARS(asset.price * qty) : null;

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
      {isCash && (asset.ticker === "ARS" || asset.ticker === "USD") ? (
        <MoneyIcon
          variant={asset.ticker === "ARS" ? "ars" : "usd"}
          size={40}
        />
      ) : (
        <View style={[s.rowIcon, { backgroundColor: bg }]}>
          <Text style={[s.rowIconText, { color: fg }]}>
            {assetIconCode(asset)}
          </Text>
        </View>
      )}
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
        <Text style={[s.rowPrice, { color: c.text }]}>{primaryValue}</Text>
        {secondaryValue ? (
          <Text style={[s.rowChange, { color: c.textMuted }]}>
            ≈ {secondaryValue}
          </Text>
        ) : !isCash ? (
          <Text style={[s.rowChange, { color: up ? c.greenDark : c.red }]}>
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
  /* ─── Fondos populares ─── */
  featuredBlock: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  featuredHead: {
    marginBottom: 12,
  },
  featuredEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  featuredSub: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  featuredCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  featuredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: 14,
  },
  featuredIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredIconText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.2,
  },
  featuredName: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  featuredSubline: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  featuredChange: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  featuredSeeAll: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
  },
  featuredSeeAllText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },

  /* ─── University Callout ─── */
  uniCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  uniIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  uniTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  uniBody: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.1,
  },

  /* ─── Core layout ─── */
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
  topPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  topPillText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
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
    flexWrap: "wrap",
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
  timeLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 4,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
  },
  tabsWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
