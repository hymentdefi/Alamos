import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Tap } from "../../../lib/components/Tap";
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
import { ProHome } from "../../../lib/components/pro/ProHome";
import { useProMode } from "../../../lib/pro/context";

type Range = "1min" | "1H" | "1D" | "1S" | "1M" | "3M" | "YTD";
type TabId = "dinero" | "portfolio";

const ranges: Range[] = ["1min", "1H", "1D", "1S", "1M", "3M", "YTD"];

/** Variación % por rango — determina el trend y color del chart. */
const rangeChanges: Record<Range, number> = {
  "1min": 0.08,
  "1H": 0.42,
  "1D": 1.96,
  "1S": 3.24,
  "1M": -2.1,
  "3M": 8.45,
  YTD: 15.3,
};

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
  const [range, setRange] = useState<Range>("1D");
  const [tab, setTab] = useState<TabId>("portfolio");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
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

  // Saludo según la hora local: 05-12 buen día, 12-20 buenas tardes, resto
  // buenas noches.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Buen día";
    if (h >= 12 && h < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);

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
  // Color del trazo del chart: verde Alamos específico para charts
  // (#5ac43e), separado del trendColor que usamos para textos y pills.
  const chartColor = isUp ? "#5ac43e" : c.red;

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
        <Tap
          style={[s.topBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.push("/(app)/activity")}
          hitSlop={8}
          haptic="selection"
        >
          <Feather name="activity" size={18} color={c.text} />
        </Tap>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 180 }}
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
            {greeting}, {firstName}
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
            color={chartColor}
            height={300}
            withFill={false}
            strokeWidth={1.4}
            smooth={false}
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
                    active && { backgroundColor: chartColor },
                  ]}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      s.rangeText,
                      {
                        color: active ? c.bg : chartColor,
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
          {tab === "dinero" ? (
            <Dinero byCategory={byCategory} />
          ) : (
            <Portfolio byCategory={byCategory} onOpen={openDetail} />
          )}
        </View>

      </ScrollView>

    </View>
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
    case "1min":
      return "último minuto";
    case "1H":
      return "última hora";
    case "1D":
      return "hoy";
    case "1S":
      return "esta semana";
    case "1M":
      return "este mes";
    case "3M":
      return "3 meses";
    case "YTD":
      return "en el año";
  }
}

function indexLabel(r: Range, index: number, length: number): string {
  const t = 1 - index / (length - 1);
  switch (r) {
    case "1min": {
      const s = Math.round(t * 60);
      if (s === 0) return "ahora";
      if (s === 1) return "hace 1s";
      return `hace ${s}s`;
    }
    case "1H": {
      const m = Math.round(t * 60);
      if (m === 0) return "ahora";
      if (m === 1) return "hace 1m";
      return `hace ${m}m`;
    }
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
    case "YTD": {
      // Hoy es abril, así que 0-3 meses atrás cubren el YTD.
      const m = Math.round(t * 4);
      if (m === 0) return "hoy";
      if (m === 1) return "hace 1 mes";
      return `hace ${m} meses`;
    }
  }
}

/* ─── Subcomponentes ─── */

/* ─── TabStrip Dinero / Portfolio ─── */
function TabStrip({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
}) {
  const { c } = useTheme();
  const tabs: { id: TabId; label: string }[] = [
    { id: "dinero", label: "Dinero" },
    { id: "portfolio", label: "Portfolio" },
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

/* ─── Dinero: cash positions + acciones de Ingresar/Retirar ─── */
function Dinero({
  byCategory,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
}) {
  const { c } = useTheme();
  const router = useRouter();
  const cash = useMemo(
    () => byCategory.find(([cat]) => cat === "efectivo")?.[1].items ?? [],
    [byCategory],
  );

  const ars = cash.find((a) => a.ticker === "ARS");
  const usd = cash.find((a) => a.ticker === "USD");

  if (!ars && !usd) return null;

  return (
    <View style={s.sectionBlock}>
      {ars ? (
        <View style={s.moneyRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.moneyRowLabel, { color: c.textSecondary }]}>
              Pesos argentinos
            </Text>
            <Text style={[s.moneyRowAmount, { color: c.text }]}>
              {formatARS(ars.price * (ars.qty ?? 1))}
            </Text>
          </View>
          <View style={s.moneyInlineActions}>
            <Tap
              style={[s.moneyIconBtn, { backgroundColor: c.ink }]}
              haptic="medium"
              onPress={() =>
                router.push({
                  pathname: "/(app)/transfer",
                  params: { mode: "deposit" },
                })
              }
              hitSlop={6}
            >
              <Feather name="arrow-down-left" size={16} color={c.bg} />
            </Tap>
            <Tap
              style={[
                s.moneyIconBtn,
                { backgroundColor: c.surfaceHover, borderColor: c.border, borderWidth: 1 },
              ]}
              haptic="light"
              onPress={() =>
                router.push({
                  pathname: "/(app)/transfer",
                  params: { mode: "withdraw" },
                })
              }
              hitSlop={6}
            >
              <Feather name="arrow-up-right" size={16} color={c.text} />
            </Tap>
          </View>
        </View>
      ) : null}

      {usd ? (
        <View
          style={[
            s.moneyRow,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: c.border,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[s.moneyRowLabel, { color: c.textSecondary }]}>
              Dólares MEP
            </Text>
            <Text style={[s.moneyRowAmount, { color: c.text }]}>
              US${" "}
              {(usd.qty ?? 0).toLocaleString("es-AR", {
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
          <Text style={[s.moneyRowEquiv, { color: c.textMuted }]}>
            {formatARS(usd.price * (usd.qty ?? 1))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ─── Portfolio: activos financieros con métricas y distribución ─── */
function Portfolio({
  byCategory,
  onOpen,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
  onOpen: (a: Asset) => void;
}) {
  const { c } = useTheme();

  const portfolioEntries = useMemo(
    () => byCategory.filter(([cat]) => cat !== "efectivo"),
    [byCategory],
  );
  const invested = useMemo(
    () => portfolioEntries.reduce((sum, [, data]) => sum + data.total, 0),
    [portfolioEntries],
  );
  // Rendimiento ponderado del día: Σ (valor × change%) / invertido.
  const weightedPct = useMemo(() => {
    if (invested <= 0) return 0;
    let w = 0;
    for (const [, data] of portfolioEntries) {
      for (const a of data.items) {
        const v = a.price * (a.qty ?? 1);
        w += v * (a.change / 100);
      }
    }
    return (w / invested) * 100;
  }, [portfolioEntries, invested]);
  const rendimientoAbs = invested * (weightedPct / 100);
  const up = weightedPct >= 0;

  if (portfolioEntries.length === 0) {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={[s.emptyPortfolio, { color: c.textMuted }]}>
          Todavía no tenés inversiones. Entrá a Mercado para empezar.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Header editorial: total invertido grande, rendimiento abajo */}
      <View style={s.portfolioHero}>
        <Text style={[s.summaryEyebrow, { color: c.textMuted }]}>
          TOTAL INVERTIDO
        </Text>
        <Text style={[s.portfolioTotal, { color: c.text }]}>
          {formatARS(invested)}
        </Text>
        <View style={s.portfolioDelta}>
          <Text
            style={[
              s.portfolioDeltaTri,
              { color: up ? c.greenDark : c.red },
            ]}
          >
            {up ? "▲" : "▼"}
          </Text>
          <Text
            style={[
              s.portfolioDeltaText,
              { color: up ? c.greenDark : c.red },
            ]}
          >
            {formatARS(Math.abs(rendimientoAbs))}
          </Text>
          <Text
            style={[
              s.portfolioDeltaSep,
              { color: up ? c.greenDark : c.red },
            ]}
          >
            ·
          </Text>
          <Text
            style={[
              s.portfolioDeltaText,
              { color: up ? c.greenDark : c.red },
            ]}
          >
            {formatPct(weightedPct)}
          </Text>
          <Text style={[s.portfolioDeltaSep, { color: c.textMuted }]}>·</Text>
          <Text style={[s.portfolioDeltaPeriod, { color: c.textMuted }]}>
            hoy
          </Text>
        </View>
      </View>

      {/* Listado agrupado por categoría */}
      {portfolioEntries.map(([cat, data]) => (
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

      {/* Distribución al final — contextualiza las tenencias */}
      <View style={s.distBlock}>
        <Text style={[s.sectionEyebrow, { color: c.textMuted }]}>
          DISTRIBUCIÓN
        </Text>
        <View style={[s.barTrack, { backgroundColor: c.surfaceSunken }]}>
          {portfolioEntries.map(([cat, data], i) => {
            const pct = (data.total / invested) * 100;
            return (
              <View
                key={cat}
                style={{
                  width: `${pct}%`,
                  backgroundColor: allocationColor(cat, c),
                  borderTopLeftRadius: i === 0 ? radius.pill : 0,
                  borderBottomLeftRadius: i === 0 ? radius.pill : 0,
                  borderTopRightRadius:
                    i === portfolioEntries.length - 1 ? radius.pill : 0,
                  borderBottomRightRadius:
                    i === portfolioEntries.length - 1 ? radius.pill : 0,
                }}
              />
            );
          })}
        </View>

        <View style={{ gap: 10, marginTop: 16 }}>
          {portfolioEntries.map(([cat, data]) => {
            const pct = (data.total / invested) * 100;
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
  /* ─── Core layout ─── */
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  /* TabStrip Dinero / Portfolio */
  tabsWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
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
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  tabContent: {
    marginTop: 4,
  },

  /* Secciones editoriales (Dinero / Portfolio) */
  sectionBlock: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
  sectionEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
  },

  /* Dinero */
  moneyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 14,
  },
  moneyRowLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  moneyRowAmount: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  moneyRowEquiv: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  moneyInlineActions: {
    flexDirection: "row",
    gap: 8,
  },
  moneyIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Portfolio hero */
  portfolioHero: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  summaryEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  portfolioTotal: {
    fontFamily: fontFamily[800],
    fontSize: 36,
    letterSpacing: -1.4,
    marginTop: 10,
    marginBottom: 6,
  },
  portfolioDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  portfolioDeltaTri: {
    fontFamily: fontFamily[700],
    fontSize: 12,
  },
  portfolioDeltaText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  portfolioDeltaSep: {
    fontFamily: fontFamily[700],
    fontSize: 14,
  },
  portfolioDeltaPeriod: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  emptyPortfolio: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 24,
  },
  distBlock: {
    paddingHorizontal: 20,
    marginTop: 32,
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
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
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
