import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useTheme,
  fontFamily,
  radius,
  type ThemeColors,
} from "../../lib/theme";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";
import {
  assets,
  assetIconCode,
  assetMarket,
  assetCurrency,
  subgroupLabel,
  marketLabels,
  marketLabelsFull,
  categoryLabels,
  formatARS,
  formatUSD,
  formatPct,
  formatQty,
  formatMoney,
  type Asset,
  type AssetCategory,
  type AssetMarket,
  type AssetCurrency,
} from "../../lib/data/assets";
import { convertAmount } from "../../lib/data/accounts";

/* ─── Habilitamos LayoutAnimation en Android para que los acordeones
 *     se expandan/colapsen suavemente igual que en iOS. */
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ─── Sort & filter model ─────────────────────────────────────── */

type SortKey = "value" | "performance" | "alpha" | "recent";
type ViewMode = "grouped" | "flat";
type PerformanceFilter = "all" | "gain" | "loss";

interface Filters {
  /** null = sin filtro (todos los mercados). */
  markets: AssetMarket[] | null;
  currencies: AssetCurrency[] | null;
  categories: AssetCategory[] | null;
  performance: PerformanceFilter;
}

const DEFAULT_FILTERS: Filters = {
  markets: null,
  currencies: null,
  categories: null,
  performance: "all",
};

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "value", label: "Valor" },
  { id: "performance", label: "Rendimiento" },
  { id: "alpha", label: "Alfabético" },
  { id: "recent", label: "Recientes" },
];

/** Orden visual de los mercados — Argentina primero (mercado primario). */
const MARKET_ORDER: AssetMarket[] = ["AR", "US", "CRYPTO"];

/* ─── Helpers de filter / sort ────────────────────────────────── */

function passesFilters(a: Asset, f: Filters): boolean {
  if (f.markets && !f.markets.includes(assetMarket(a))) return false;
  if (f.currencies && !f.currencies.includes(assetCurrency(a))) return false;
  if (f.categories && !f.categories.includes(a.category)) return false;
  if (f.performance === "gain" && a.change < 0) return false;
  if (f.performance === "loss" && a.change >= 0) return false;
  return true;
}

function sortAssets(arr: Asset[], key: SortKey): Asset[] {
  const list = arr.slice();
  switch (key) {
    case "value":
      // Valor de tenencia convertido a USD para comparar entre monedas.
      return list.sort((a, b) => valueInUsd(b) - valueInUsd(a));
    case "performance":
      return list.sort((a, b) => b.change - a.change);
    case "alpha":
      return list.sort((a, b) => a.ticker.localeCompare(b.ticker));
    case "recent":
      // Sin timestamp real → orden inverso del array (proxy: los del
      // final se cargaron "más reciente" en el mock).
      return list.reverse();
  }
}

function valueNative(a: Asset): number {
  return a.price * (a.qty ?? 0);
}

function valueInUsd(a: Asset): number {
  return convertAmount(valueNative(a), assetCurrency(a), "USD");
}

/* ─── Pantalla ────────────────────────────────────────────────── */

interface MarketSubgroup {
  category: AssetCategory;
  label: string;
  items: Asset[];
  valueNative: number;
  currency: AssetCurrency;
}

interface MarketGroup {
  market: AssetMarket;
  items: Asset[];
  valueUsd: number;
  subgroups: MarketSubgroup[];
}

export default function InvestmentsDetailScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [sort, setSort] = useState<SortKey>("value");
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterSheet, setFilterSheet] = useState(false);

  // Acordeones colapsables. Por default todos los mercados expandidos
  // (queremos que el usuario vea todo al entrar). Sub-acordeones
  // empiezan colapsados — el usuario expande lo que le interesa.
  const [collapsedMarkets, setCollapsedMarkets] = useState<Set<AssetMarket>>(
    new Set(),
  );
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  /* Held no-cash, una sola vez. */
  const allHeld = useMemo(
    () => assets.filter((a) => a.held && a.category !== "efectivo"),
    [],
  );

  /* Agrupado: mercado → subcategoría → items. */
  const grouped = useMemo<MarketGroup[]>(() => {
    const filtered = allHeld.filter((a) => passesFilters(a, filters));
    const sorted = sortAssets(filtered, sort);
    const out: MarketGroup[] = [];
    for (const m of MARKET_ORDER) {
      const inMarket = sorted.filter((a) => assetMarket(a) === m);
      if (inMarket.length === 0) continue;

      // Subcategorías dentro del mercado, en orden de aparición tras el sort.
      const seen = new Set<AssetCategory>();
      const subgroups: MarketSubgroup[] = [];
      for (const a of inMarket) {
        if (seen.has(a.category)) continue;
        seen.add(a.category);
        const items = inMarket.filter((x) => x.category === a.category);
        subgroups.push({
          category: a.category,
          label: subgroupLabel(a),
          items,
          valueNative: items.reduce((s, x) => s + valueNative(x), 0),
          currency: assetCurrency(a),
        });
      }
      const valueUsd = inMarket.reduce((s, a) => s + valueInUsd(a), 0);
      out.push({ market: m, items: inMarket, valueUsd, subgroups });
    }
    return out;
  }, [allHeld, filters, sort]);

  /* Lista flat (modo Pro): mismos filtros, mismo sort, sin grupos. */
  const flatList = useMemo(() => {
    const filtered = allHeld.filter((a) => passesFilters(a, filters));
    return sortAssets(filtered, sort);
  }, [allHeld, filters, sort]);

  const totalUsd = grouped.reduce((s, g) => s + g.valueUsd, 0);
  const totalArs = totalUsd > 0 ? convertAmount(totalUsd, "USD", "ARS") : 0;

  /* Rendimiento del día — agregado en USD para mezclar monedas. */
  const { dayReturnUsd, dayPct } = useMemo(() => {
    const all = grouped.flatMap((g) => g.items);
    const ret = all.reduce(
      (s, a) => s + valueInUsd(a) * (a.change / 100),
      0,
    );
    const start = totalUsd - ret;
    const pct = start > 0 ? (ret / start) * 100 : 0;
    return { dayReturnUsd: ret, dayPct: pct };
  }, [grouped, totalUsd]);
  const dayUp = dayReturnUsd >= 0;

  const top = useMemo(() => {
    const all = grouped.flatMap((g) => g.items);
    if (all.length === 0) return null;
    return [...all].sort((a, b) => b.change - a.change)[0];
  }, [grouped]);

  const totalAssets = grouped.reduce((s, g) => s + g.items.length, 0);

  const activeFilters = countActiveFilters(filters);
  const isFiltered = activeFilters > 0;

  const openDetail = (asset: Asset) => {
    router.push({
      pathname: "/(app)/detail",
      params: { ticker: asset.ticker },
    });
  };

  const toggleMarket = (m: AssetMarket) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const toggleSub = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Tus inversiones</Text>
        <View style={s.headerActions}>
          <Pressable
            onPress={() =>
              setViewMode((v) => (v === "grouped" ? "flat" : "grouped"))
            }
            hitSlop={10}
            style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          >
            <Feather
              name={viewMode === "grouped" ? "list" : "layers"}
              size={16}
              color={c.text}
            />
          </Pressable>
          <Pressable
            onPress={() => setFilterSheet(true)}
            hitSlop={10}
            style={[
              s.iconBtn,
              {
                backgroundColor: isFiltered ? c.text : c.surfaceHover,
              },
            ]}
          >
            <Feather
              name="sliders"
              size={16}
              color={isFiltered ? c.bg : c.text}
            />
            {isFiltered ? (
              <View style={[s.filterBadge, { backgroundColor: c.green }]}>
                <Text style={[s.filterBadgeText, { color: c.ink }]}>
                  {activeFilters}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: rendimiento del día */}
        <View style={s.hero}>
          <Text style={[s.heroEyebrow, { color: c.textMuted }]}>
            RENDIMIENTO DEL DÍA
          </Text>
          <View style={s.heroPctRow}>
            <Text
              style={[
                s.heroPctTri,
                { color: dayUp ? c.greenDark : c.red },
              ]}
            >
              {dayUp ? "▲" : "▼"}
            </Text>
            <Text
              style={[s.heroPct, { color: dayUp ? c.greenDark : c.red }]}
            >
              {formatPct(dayPct)}
            </Text>
            <Text style={[s.heroPctSub, { color: c.textMuted }]}>
              {dayUp ? "+" : "−"}
              {formatUSD(Math.abs(dayReturnUsd))}
            </Text>
          </View>
        </View>

        {/* Métricas */}
        <Text style={[s.eyebrow, { color: c.textMuted }]}>MÉTRICAS</Text>
        <View
          style={[
            s.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <MetricRow label="Total invertido" value={formatUSD(totalUsd)} />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetricRow
            label="Equivalente ARS"
            value={formatARS(totalArs)}
            valueColor={c.textSecondary}
          />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetricRow label="Activos" value={`${totalAssets}`} />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetricRow label="Mercados" value={`${grouped.length}`} />
          {top ? (
            <>
              <View style={[s.rowDivider, { backgroundColor: c.border }]} />
              <MetricRow
                label="Mejor performer"
                value={`${top.ticker}  ${formatPct(top.change)}`}
                valueColor={top.change >= 0 ? c.greenDark : c.red}
              />
            </>
          ) : null}
        </View>

        {/* Sort bar — chips horizontales */}
        <Text style={[s.eyebrow, { color: c.textMuted, marginTop: 28 }]}>
          ORDENAR POR
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.sortBar}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = opt.id === sort;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setSort(opt.id)}
                style={[
                  s.sortChip,
                  {
                    backgroundColor: active ? c.text : c.surfaceHover,
                    borderColor: active ? c.text : c.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.sortChipText,
                    { color: active ? c.bg : c.text },
                  ]}
                >
                  {opt.label}
                </Text>
                {active ? (
                  <Feather name="chevron-down" size={12} color={c.bg} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Lista — vista grouped o flat */}
        <Text style={[s.eyebrow, { color: c.textMuted, marginTop: 24 }]}>
          {viewMode === "grouped" ? "POR MERCADO" : "TODAS LAS POSICIONES"}
        </Text>

        {grouped.length === 0 ? (
          <View
            style={[
              s.emptyCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Feather name="inbox" size={20} color={c.textMuted} />
            <Text style={[s.emptyText, { color: c.textMuted }]}>
              {isFiltered
                ? "Ningún activo coincide con los filtros."
                : "Todavía no tenés inversiones."}
            </Text>
          </View>
        ) : viewMode === "flat" ? (
          <View
            style={[
              s.card,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                marginTop: 0,
              },
            ]}
          >
            {flatList.map((asset, i) => (
              <View key={asset.ticker}>
                {i > 0 ? (
                  <View
                    style={[s.rowDivider, { backgroundColor: c.border }]}
                  />
                ) : null}
                <AssetDetailRow
                  asset={asset}
                  onPress={() => openDetail(asset)}
                />
              </View>
            ))}
          </View>
        ) : (
          grouped.map((g) => {
            const collapsed = collapsedMarkets.has(g.market);
            const sharePct = totalUsd > 0 ? (g.valueUsd / totalUsd) * 100 : 0;
            return (
              <View key={g.market} style={s.marketBlock}>
                <Pressable
                  style={[
                    s.marketHead,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.border,
                    },
                  ]}
                  onPress={() => toggleMarket(g.market)}
                  hitSlop={4}
                >
                  <View
                    style={[
                      s.marketBadge,
                      { backgroundColor: marketBadgeBg(g.market, c) },
                    ]}
                  >
                    <Text
                      style={[
                        s.marketBadgeText,
                        { color: marketBadgeFg(g.market, c) },
                      ]}
                    >
                      {marketLabels[g.market]}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.marketTitle, { color: c.text }]}>
                      {marketLabelsFull[g.market]}
                    </Text>
                    <Text
                      style={[s.marketSub, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {formatUSD(g.valueUsd)} · {sharePct.toFixed(1)}%
                    </Text>
                  </View>
                  <Feather
                    name={collapsed ? "chevron-down" : "chevron-up"}
                    size={18}
                    color={c.textMuted}
                  />
                </Pressable>

                {!collapsed ? (
                  <View style={s.subgroupCol}>
                    {g.subgroups.map((sg) => {
                      const subKey = `${g.market}:${sg.category}`;
                      const subOpen = expandedSubs.has(subKey);
                      return (
                        <View key={subKey} style={s.subgroupBlock}>
                          <Pressable
                            style={[
                              s.subHead,
                              {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                              },
                            ]}
                            onPress={() => toggleSub(subKey)}
                            hitSlop={4}
                          >
                            <Text
                              style={[s.subTitle, { color: c.text }]}
                            >
                              {sg.label}
                            </Text>
                            <Text
                              style={[s.subValue, { color: c.textMuted }]}
                            >
                              {formatMoney(sg.valueNative, sg.currency)}
                              <Text style={{ color: c.textFaint }}>
                                {"  ·  "}
                                {sg.items.length}
                              </Text>
                            </Text>
                            <Feather
                              name={subOpen ? "chevron-up" : "chevron-down"}
                              size={16}
                              color={c.textMuted}
                              style={{ marginLeft: 8 }}
                            />
                          </Pressable>
                          {subOpen ? (
                            <View
                              style={[
                                s.subItems,
                                {
                                  backgroundColor: c.surface,
                                  borderColor: c.border,
                                },
                              ]}
                            >
                              {sg.items.map((asset, i) => (
                                <View key={asset.ticker}>
                                  {i > 0 ? (
                                    <View
                                      style={[
                                        s.rowDivider,
                                        { backgroundColor: c.border },
                                      ]}
                                    />
                                  ) : null}
                                  <AssetDetailRow
                                    asset={asset}
                                    onPress={() => openDetail(asset)}
                                  />
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <FilterSheet
        visible={filterSheet}
        filters={filters}
        onApply={(f) => {
          setFilters(f);
          setFilterSheet(false);
        }}
        onReset={() => {
          setFilters(DEFAULT_FILTERS);
          setFilterSheet(false);
        }}
        onClose={() => setFilterSheet(false)}
      />
    </View>
  );
}

/* ─── Subcomponentes ─────────────────────────────────────────── */

function AssetDetailRow({
  asset,
  onPress,
}: {
  asset: Asset;
  onPress: () => void;
}) {
  const { c } = useTheme();
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

  const cur = assetCurrency(asset);
  const total = valueNative(asset);

  return (
    <Pressable onPress={onPress} style={s.holdingRow}>
      <View style={[s.assetIcon, { backgroundColor: bg }]}>
        <Text style={[s.assetIconText, { color: fg }]}>
          {assetIconCode(asset)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.ticker, { color: c.text }]}>{asset.ticker}</Text>
        <Text style={[s.tickerSub, { color: c.textMuted }]} numberOfLines={1}>
          {formatQty(asset.qty ?? 0)}{" "}
          {(asset.qty ?? 0) === 1 ? "unidad" : "unidades"} ·{" "}
          {formatMoney(asset.price, cur)}
        </Text>
      </View>
      <View style={s.chartCol}>
        <MiniSparkline
          series={seriesFromSeed(asset.ticker, 28, up ? "up" : "down")}
          color={up ? c.greenDark : c.red}
        />
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.balance, { color: c.text }]}>
          {formatMoney(total, cur)}
        </Text>
        <Text style={[s.balanceSub, { color: up ? c.positive : c.red }]}>
          {up ? "▲ " : "▼ "}
          {formatPct(asset.change, false)}
        </Text>
      </View>
    </Pressable>
  );
}

function MetricRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={s.metricRow}>
      <Text style={[s.metricLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[s.metricValue, { color: valueColor ?? c.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/* ─── Filter sheet (bottom sheet) ────────────────────────────── */

function FilterSheet({
  visible,
  filters,
  onApply,
  onReset,
  onClose,
}: {
  visible: boolean;
  filters: Filters;
  onApply: (f: Filters) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [local, setLocal] = useState<Filters>(filters);

  // Re-sync el borrador local con los filtros aplicados cada vez que
  // se abre el sheet — así si el usuario cambia algo y cierra sin
  // aplicar, no queda el draft pegado en el próximo abrir.
  useEffect(() => {
    if (visible) setLocal(filters);
  }, [visible, filters]);

  const toggle = <T,>(arr: T[] | null, v: T): T[] | null => {
    if (!arr) return [v];
    if (arr.includes(v)) {
      const next = arr.filter((x) => x !== v);
      return next.length === 0 ? null : next;
    }
    return [...arr, v];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.sheetBackdrop} onPress={onClose} />
      <View
        style={[
          s.sheet,
          {
            backgroundColor: c.bg,
            paddingBottom: insets.bottom + 20,
            borderColor: c.border,
          },
        ]}
      >
        <View style={s.sheetGrabber}>
          <View style={[s.grabberPill, { backgroundColor: c.borderStrong }]} />
        </View>

        <View style={s.sheetHead}>
          <Text style={[s.sheetTitle, { color: c.text }]}>Filtrar</Text>
          <Pressable onPress={onReset} hitSlop={8}>
            <Text style={[s.sheetReset, { color: c.textMuted }]}>Limpiar</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <FilterGroup label="Mercado">
            {(["AR", "US", "CRYPTO"] as AssetMarket[]).map((m) => (
              <FilterChip
                key={m}
                label={marketLabelsFull[m]}
                active={!!local.markets?.includes(m)}
                onPress={() =>
                  setLocal({ ...local, markets: toggle(local.markets, m) })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Moneda">
            {(["ARS", "USD", "USDT"] as AssetCurrency[]).map((cu) => (
              <FilterChip
                key={cu}
                label={cu}
                active={!!local.currencies?.includes(cu)}
                onPress={() =>
                  setLocal({
                    ...local,
                    currencies: toggle(local.currencies, cu),
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Tipo de activo">
            {(
              [
                "cedears",
                "acciones",
                "bonos",
                "fci",
                "obligaciones",
                "letras",
                "crypto",
              ] as AssetCategory[]
            ).map((cat) => (
              <FilterChip
                key={cat}
                label={categoryLabels[cat]}
                active={!!local.categories?.includes(cat)}
                onPress={() =>
                  setLocal({
                    ...local,
                    categories: toggle(local.categories, cat),
                  })
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Resultado">
            {(
              [
                { id: "all", label: "Todos" },
                { id: "gain", label: "En ganancia" },
                { id: "loss", label: "En pérdida" },
              ] as { id: PerformanceFilter; label: string }[]
            ).map((p) => (
              <FilterChip
                key={p.id}
                label={p.label}
                active={local.performance === p.id}
                onPress={() => setLocal({ ...local, performance: p.id })}
              />
            ))}
          </FilterGroup>
        </ScrollView>

        <Pressable
          onPress={() => onApply(local)}
          style={[s.applyBtn, { backgroundColor: c.text }]}
        >
          <Text style={[s.applyBtnText, { color: c.bg }]}>Aplicar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={s.filterGroup}>
      <Text style={[s.filterGroupLabel, { color: c.textMuted }]}>
        {label.toUpperCase()}
      </Text>
      <View style={s.filterChipsRow}>{children}</View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.filterChip,
        {
          backgroundColor: active ? c.text : c.surfaceHover,
          borderColor: active ? c.text : c.border,
        },
      ]}
    >
      <Text
        style={[s.filterChipText, { color: active ? c.bg : c.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Helpers de UI ──────────────────────────────────────────── */

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.markets) n++;
  if (f.currencies) n++;
  if (f.categories) n++;
  if (f.performance !== "all") n++;
  return n;
}

function marketBadgeBg(m: AssetMarket, c: ThemeColors): string {
  switch (m) {
    case "AR":
      return c.surfaceSunken;
    case "US":
      return c.ink;
    case "CRYPTO":
      return c.greenDim;
  }
}

function marketBadgeFg(m: AssetMarket, c: ThemeColors): string {
  switch (m) {
    case "AR":
      return c.text;
    case "US":
      return c.bg;
    case "CRYPTO":
      return c.greenDark;
  }
}

/* ─── Estilos ────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    fontFamily: fontFamily[800],
    fontSize: 10,
    letterSpacing: -0.2,
  },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },

  /* Hero */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroPctRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  heroPctTri: {
    fontFamily: fontFamily[700],
    fontSize: 18,
  },
  heroPct: {
    fontFamily: fontFamily[800],
    fontSize: 36,
    letterSpacing: -1.3,
  },
  heroPctSub: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* Eyebrows + cards */
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
  },
  emptyCard: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 36,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 24,
  },

  /* Métricas */
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  metricLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  metricValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
    flexShrink: 1,
    textAlign: "right",
  },

  /* Sort bar */
  sortBar: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sortChipText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },

  /* Market group */
  marketBlock: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  marketHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  marketBadge: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  marketBadgeText: {
    fontFamily: fontFamily[800],
    fontSize: 11,
    letterSpacing: 0.4,
  },
  marketTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  marketSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 2,
  },

  /* Subgroup */
  subgroupCol: {
    marginTop: 8,
    marginLeft: 12,
    gap: 6,
  },
  subgroupBlock: {},
  subHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  subTitle: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
    flex: 1,
  },
  subValue: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  subItems: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  /* Holding row */
  holdingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  assetIconText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.3,
  },
  ticker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  tickerSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  chartCol: {
    width: 56,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  balanceSub: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },

  /* Filter sheet */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "85%",
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetGrabber: {
    alignItems: "center",
    paddingVertical: 8,
  },
  grabberPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  sheetReset: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  filterGroup: {
    marginBottom: 22,
  },
  filterGroupLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  applyBtn: {
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  applyBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
