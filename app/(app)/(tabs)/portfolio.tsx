import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import Svg, {
  Ellipse,
  G,
  Line,
  Polygon,
  Text as SvgText,
} from "react-native-svg";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { fontFamily, radius, useTheme } from "../../../lib/theme";
import {
  assets,
  assetCurrency,
  assetMarket,
  categoryLabels,
  formatARS,
  formatMoney,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../../lib/data/assets";
import { convertAmount } from "../../../lib/data/accounts";
import {
  categorizeAsset,
  findCategoryBySlug,
} from "../../../lib/data/marketCategories";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { BalanceInfoSheet } from "../../../lib/components/BalanceInfoSheet";
import { type MarketSegmentedValue } from "../../../lib/components/MarketSegmented";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../../lib/components/Sparkline";
import { Tap } from "../../../lib/components/Tap";
import { AssetColorProvider } from "../../../lib/asset-color/context";
import { registerTabTap } from "../../../lib/tabs/activeTap";

/**
 * Tab 'Portfolio' — gold standard del detail.tsx aplicado a la cartera.
 *
 * Estructura:
 *   1. Hero block FIJO (afuera del ScrollView) — eyebrow "PORTFOLIO" +
 *      balance grande con pager ARS/USD + delta del día con triángulo +
 *      dots indicator. Permanece visible siempre, no scrollea. El delta
 *      del día dicta la cromática (greenDark si el día es verde, red si
 *      está negativo) via AssetColorProvider.
 *   2. Ladrillo full-bleed — primer item dentro del ScrollView. Hold +
 *      drag para highlightear y tooltip arriba.
 *   3. Range pills (Todo/AR/EE.UU/Crypto) — debajo del ladrillo.
 *      Active filled con el color contextual del día (greenDark si
 *      verde, red si en losses). Mismo lenguaje que el rangeRow del
 *      detail.tsx. Filtra holdings + ladrillo + cards.
 *   4. Cards full-width sin GlassCard:
 *        - Resumen: grid 2x2 (valor mercado, posiciones, mejor del
 *          día, peor del día) + ReturnRow del día.
 *        - Tus posiciones: rows por categoría, hairline dividers,
 *          swatch que matchea el ladrillo.
 *        - Distribución: stats grid 2-col por mercado.
 *   5. Disclaimer Manteca al final.
 */

type Currency = "ARS" | "USD";
type ColorMap = ReturnType<typeof useTheme>["c"];

interface Holding {
  asset: Asset;
  native: number;
  ars: number;
}

const BRICK_PALETTE = [
  "#00E676",
  "#0E0F0C",
  "#7EE9A6",
  "#00B864",
  "#94A3B8",
  "#5ac43e",
  "#6B6C66",
];

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c } = useTheme();
  const [marketFilter, setMarketFilter] =
    useState<MarketSegmentedValue>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [infoOpen, setInfoOpen] = useState(false);
  const [pagerW, setPagerW] = useState(0);

  // AR/Todo arrancan en ARS, US/Crypto en USD (su moneda nativa).
  const defaultCurrency: Currency =
    marketFilter === "US" || marketFilter === "CRYPTO" ? "USD" : "ARS";

  /* ─── Holdings filtrados ─── */

  const holdings = useMemo<Asset[]>(() => {
    const all = assets.filter(
      (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    );
    if (marketFilter === "all") return all;
    return all.filter((a) => assetMarket(a) === marketFilter);
  }, [marketFilter]);

  const holdingsSorted = useMemo<Holding[]>(() => {
    const withVal = holdings.map((a) => {
      const native = a.price * (a.qty ?? 0);
      const ars = convertAmount(native, assetCurrency(a), "ARS");
      return { asset: a, native, ars };
    });
    return withVal.sort((x, y) => y.ars - x.ars);
  }, [holdings]);

  const totalArs = useMemo(
    () => holdingsSorted.reduce((acc, h) => acc + h.ars, 0),
    [holdingsSorted],
  );

  // Delta del día = sum de (ars * change/100) por holding. Da el ARS
  // que sumó/restó la cartera hoy. % se computa contra el balance
  // de ayer (totalArs - daySum).
  const daySumArs = useMemo(
    () =>
      holdingsSorted.reduce(
        (acc, h) => acc + h.ars * (h.asset.change / 100),
        0,
      ),
    [holdingsSorted],
  );
  const yesterdayArs = totalArs - daySumArs;
  const dayPct = yesterdayArs > 0 ? (daySumArs / yesterdayArs) * 100 : 0;
  const dayUp = daySumArs >= 0;
  const color = dayUp ? c.greenDark : c.red;

  // Mejor / peor del día por % de change.
  const bestOfDay = useMemo<Holding | null>(() => {
    if (holdingsSorted.length === 0) return null;
    return [...holdingsSorted].sort(
      (a, b) => b.asset.change - a.asset.change,
    )[0];
  }, [holdingsSorted]);
  const worstOfDay = useMemo<Holding | null>(() => {
    if (holdingsSorted.length === 0) return null;
    return [...holdingsSorted].sort(
      (a, b) => a.asset.change - b.asset.change,
    )[0];
  }, [holdingsSorted]);

  /* ─── Grupos por categoría (para "Tus posiciones") ─── */

  const groupedByCategory = useMemo(() => {
    const map = new Map<
      string,
      { totalArs: number; count: number; cat: AssetCategory }
    >();
    for (const { asset, ars } of holdingsSorted) {
      const slug = categorizeAsset(asset);
      if (!slug) continue;
      const prev = map.get(slug) ?? {
        totalArs: 0,
        count: 0,
        cat: asset.category,
      };
      map.set(slug, {
        totalArs: prev.totalArs + ars,
        count: prev.count + 1,
        cat: asset.category,
      });
    }
    return [...map.entries()].sort(([, a], [, b]) => b.totalArs - a.totalArs);
  }, [holdingsSorted]);

  // Color + pct del ladrillo por categoría — comparten paleta y
  // ordenamiento con el FloorBrick (groupBy=category), así los
  // swatches del listado hablan el mismo idioma cromático.
  const categoryAllocations = useMemo(() => {
    const totals = new Map<AssetCategory, number>();
    for (const h of holdingsSorted) {
      totals.set(
        h.asset.category,
        (totals.get(h.asset.category) ?? 0) + h.ars,
      );
    }
    const sorted = [...totals.entries()].sort(([, a], [, b]) => b - a);
    const result = new Map<AssetCategory, { color: string; pct: number }>();
    sorted.forEach(([cat, ars], i) => {
      result.set(cat, {
        color: BRICK_PALETTE[i % BRICK_PALETTE.length],
        pct: totalArs > 0 ? (ars / totalArs) * 100 : 0,
      });
    });
    return result;
  }, [holdingsSorted, totalArs]);

  /* ─── Distribución por mercado ─── */

  const marketAllocation = useMemo(() => {
    let ar = 0;
    let us = 0;
    let crypto = 0;
    for (const h of holdingsSorted) {
      const m = assetMarket(h.asset);
      if (m === "AR") ar += h.ars;
      else if (m === "US") us += h.ars;
      else if (m === "CRYPTO") crypto += h.ars;
    }
    const total = ar + us + crypto;
    return {
      arPct: total > 0 ? (ar / total) * 100 : 0,
      usPct: total > 0 ? (us / total) * 100 : 0,
      cryptoPct: total > 0 ? (crypto / total) * 100 : 0,
      categoriesCount: groupedByCategory.length,
    };
  }, [holdingsSorted, groupedByCategory]);

  /* ─── Refs + tab tap + refresh ─── */

  const scrollRef = useRef<ScrollView | null>(null);
  const pagerRef = useRef<ScrollView | null>(null);
  // Track scroll Y en JS thread para el tab tap (scroll-to-top vs refresh).
  const scrollYRef = useRef(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      setRefreshing(false);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }, 1100);
  }, []);

  useEffect(() => {
    return registerTabTap("portfolio", {
      isAtTop: () => scrollYRef.current <= 8,
      scrollToTop: () =>
        scrollRef.current?.scrollTo({ y: 0, animated: true }),
      refresh: () => {
        if (!refreshing) onRefresh();
      },
    });
  }, [refreshing, onRefresh]);

  // Sync currency cuando cambia el filtro de mercado.
  useEffect(() => {
    setCurrency(defaultCurrency);
    if (pagerW > 0) {
      pagerRef.current?.scrollTo({
        x: defaultCurrency === "ARS" ? 0 : pagerW,
        y: 0,
        animated: false,
      });
    }
  }, [defaultCurrency, pagerW]);

  /* ─── Display values en moneda actual ─── */

  const totalDisplay =
    currency === "ARS" ? totalArs : convertAmount(totalArs, "ARS", "USD");
  const daySumDisplay =
    currency === "ARS" ? daySumArs : convertAmount(daySumArs, "ARS", "USD");

  const hasHoldings = holdingsSorted.length > 0 && totalArs > 0;

  /* ─── Render ─── */

  return (
    <AssetColorProvider up={dayUp}>
      <View style={[s.root, { backgroundColor: c.bg }]}>
        {/* Safe area spacer — el header del status bar. El hero arranca
            apenas debajo y vive afuera del ScrollView, así no scrollea. */}
        <View style={{ paddingTop: insets.top + 12 }} />

        {/* ─── Hero FIJO (afuera del ScrollView) ─── */}
        <View style={s.heroBlock}>
          <Text style={[s.heroTitle, { color: c.text }]}>Portfolio</Text>

          <View style={s.heroPagerRow}>
            <View
              style={{ flex: 1 }}
              onLayout={(e) => setPagerW(e.nativeEvent.layout.width)}
            >
              {pagerW > 0 ? (
                <ScrollView
                  ref={pagerRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="normal"
                  directionalLockEnabled
                  alwaysBounceVertical={false}
                  bounces={false}
                  contentOffset={{
                    x: currency === "ARS" ? 0 : pagerW,
                    y: 0,
                  }}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.x / pagerW,
                    );
                    const next: Currency = idx === 0 ? "ARS" : "USD";
                    if (next !== currency) {
                      Haptics.selectionAsync().catch(() => {});
                      setCurrency(next);
                    }
                  }}
                  style={{ flexGrow: 0 }}
                >
                  {(["ARS", "USD"] as const).map((cur) => {
                    const value =
                      cur === "ARS"
                        ? totalArs
                        : convertAmount(totalArs, "ARS", "USD");
                    return (
                      <View
                        key={cur}
                        style={{
                          width: pagerW,
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <AmountDisplay
                          value={value}
                          size={42}
                          currency={cur}
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <AmountDisplay
                  value={totalArs}
                  size={42}
                  currency="ARS"
                />
              )}
            </View>
            <Tap
              hitSlop={10}
              haptic="selection"
              onPress={() => setInfoOpen(true)}
              style={[
                s.heroInfoDot,
                { backgroundColor: c.surfaceHover },
              ]}
            >
              <Feather name="info" size={12} color={c.textSecondary} />
            </Tap>
          </View>

          <View style={s.deltaRow}>
            <Text style={[s.deltaTri, { color }]}>
              {dayUp ? "▲" : "▼"}
            </Text>
            <Text style={[s.deltaText, { color }]}>
              {formatMoney(Math.abs(daySumDisplay), currency)}
            </Text>
            <Text style={[s.deltaText, { color }]}>
              ({formatPct(dayPct)})
            </Text>
            <Text style={[s.deltaText, { color: c.textMuted }]}>hoy</Text>
          </View>

          <View style={s.dotsRow}>
            {(["ARS", "USD"] as const).map((cur) => {
              const active = cur === currency;
              return (
                <Tap
                  key={cur}
                  hitSlop={10}
                  haptic="selection"
                  onPress={() => {
                    if (cur === currency) return;
                    setCurrency(cur);
                    pagerRef.current?.scrollTo({
                      x: cur === "ARS" ? 0 : pagerW,
                      y: 0,
                      animated: true,
                    });
                  }}
                >
                  <View
                    style={[
                      s.dot,
                      {
                        backgroundColor: active ? c.text : c.textFaint,
                        width: active ? 7 : 5,
                        height: active ? 7 : 5,
                      },
                    ]}
                  />
                </Tap>
              );
            })}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
          {/* Ladrillo full-bleed — primer contenido scrollable, span
              completo del ancho de pantalla. */}
          {hasHoldings ? (
            <View style={s.brickContainer}>
              <FloorBrick
                holdings={holdingsSorted}
                totalArs={totalArs}
                groupBy={
                  marketFilter === "CRYPTO" ? "ticker" : "category"
                }
              />
            </View>
          ) : null}

          {/* ─── Filtro de mercado — range-pill style à la detail.tsx.
              Active filled con el color contextual del día (greenDark
              si dayUp, red si losses), inactive solo texto coloreado.
              Mismo lenguaje que las pills 1D/1S/etc del detail. */}
          <View style={s.rangeRow}>
            {(
              [
                { id: "all", label: "Todo" },
                { id: "AR", label: "AR" },
                { id: "US", label: "EE.UU." },
                { id: "CRYPTO", label: "Crypto" },
              ] as const
            ).map((t) => {
              const active = t.id === marketFilter;
              return (
                <Tap
                  key={t.id}
                  onPress={() => setMarketFilter(t.id)}
                  haptic="selection"
                  pressScale={0.92}
                  style={[
                    s.rangePill,
                    active && { backgroundColor: color },
                  ]}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      s.rangeText,
                      { color: active ? c.bg : color },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Tap>
              );
            })}
          </View>

          {hasHoldings ? (
            <>
              <ResumenCard
                totalDisplay={totalDisplay}
                currency={currency}
                positionsCount={holdingsSorted.length}
                bestOfDay={bestOfDay}
                worstOfDay={worstOfDay}
                c={c}
              />
              <PosicionesCard
                groups={groupedByCategory}
                allocations={categoryAllocations}
                onTap={(slug) =>
                  router.push({
                    pathname: "/(app)/market-category",
                    params: { slug },
                  })
                }
                c={c}
              />
              <DistribucionCard alloc={marketAllocation} c={c} />
            </>
          ) : (
            <View style={[s.card, { paddingTop: 12 }]}>
              <Text style={[s.empty, { color: c.textMuted }]}>
                {marketFilter === "all"
                  ? "Todavía no tenés posiciones. Entrá a Mercado para empezar."
                  : "No tenés posiciones en este mercado."}
              </Text>
            </View>
          )}
        </ScrollView>

        <BalanceInfoSheet
          visible={infoOpen}
          onClose={() => setInfoOpen(false)}
        />
      </View>
    </AssetColorProvider>
  );
}

/* ─── Resumen card ─── */

function ResumenCard({
  totalDisplay,
  currency,
  positionsCount,
  bestOfDay,
  worstOfDay,
  c,
}: {
  totalDisplay: number;
  currency: Currency;
  positionsCount: number;
  bestOfDay: Holding | null;
  worstOfDay: Holding | null;
  c: ColorMap;
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  return (
    <View style={[s.card, { marginTop: 16 }]}>
      <Text style={[s.cardEyebrow, { color: c.text }]}>Hoy</Text>

      {bestOfDay ? (
        <MoverRow label="Mejor del día" holding={bestOfDay} c={c} />
      ) : null}
      {worstOfDay && worstOfDay.asset.ticker !== bestOfDay?.asset.ticker ? (
        <MoverRow
          label="Peor del día"
          holding={worstOfDay}
          c={c}
          isLast
        />
      ) : null}

      <View style={s.summaryFooter}>
        <View style={{ flex: 1 }}>
          <Text style={[s.summaryLabel, { color: c.textMuted }]}>
            Valor de mercado
          </Text>
          <Text
            style={[s.summaryValue, { color: c.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {fmt(totalDisplay)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[s.summaryLabel, { color: c.textMuted }]}>
            Posiciones
          </Text>
          <Text
            style={[s.summaryValue, { color: c.text }]}
            numberOfLines={1}
          >
            {positionsCount}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* Mover row — fila dedicada a un activo (mejor o peor del día) con
 * mini sparkline, ticker, nombre y variación. Mismo lenguaje cromático
 * que el RelatedCarousel del detail. */
function MoverRow({
  label,
  holding,
  c,
  isLast,
}: {
  label: string;
  holding: Holding;
  c: ColorMap;
  isLast?: boolean;
}) {
  const up = holding.asset.change >= 0;
  const tone = up ? c.greenDark : c.red;
  const series = seriesFromSeed(
    holding.asset.ticker,
    50,
    up ? "up" : "down",
  );
  return (
    <View
      style={[
        s.moverRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[s.moverLabel, { color: c.textMuted }]}>{label}</Text>
        <Text style={[s.moverTicker, { color: c.text }]} numberOfLines={1}>
          {holding.asset.ticker}
        </Text>
        <Text style={[s.moverName, { color: c.textMuted }]} numberOfLines={1}>
          {holding.asset.name}
        </Text>
      </View>
      <View style={s.moverSpark}>
        <MiniSparkline
          series={series}
          color={tone}
          width={88}
          height={32}
          strokeWidth={1.4}
        />
      </View>
      <View style={{ alignItems: "flex-end", minWidth: 64 }}>
        <Text style={[s.moverChange, { color: tone }]}>
          {up ? "▲" : "▼"} {formatPct(holding.asset.change, false)}
        </Text>
      </View>
    </View>
  );
}

/* ─── Posiciones card ─── */

function PosicionesCard({
  groups,
  allocations,
  onTap,
  c,
}: {
  groups: Array<
    [string, { totalArs: number; count: number; cat: AssetCategory }]
  >;
  allocations: Map<AssetCategory, { color: string; pct: number }>;
  onTap: (slug: string) => void;
  c: ColorMap;
}) {
  return (
    <View style={[s.card, { marginTop: 16 }]}>
      <Text style={[s.cardEyebrow, { color: c.text }]}>Tus posiciones</Text>
      {groups.map(([slug, data], i) => {
        const lookup = findCategoryBySlug(slug);
        if (!lookup) return null;
        const { category } = lookup;
        const alloc = allocations.get(data.cat);
        return (
          <Pressable
            key={slug}
            onPress={() => onTap(slug)}
            style={[
              s.posRow,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: c.border,
              },
            ]}
          >
            {alloc ? (
              <View
                style={[s.posSwatch, { backgroundColor: alloc.color }]}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text
                style={[s.posLabel, { color: c.text }]}
                numberOfLines={1}
              >
                {category.label}
              </Text>
              <Text
                style={[s.posSub, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {data.count} instrumento{data.count === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[s.posValue, { color: c.text }]}
                numberOfLines={1}
              >
                {formatARS(data.totalArs)}
              </Text>
              {alloc ? (
                <Text style={[s.posPct, { color: c.textMuted }]}>
                  {formatAllocationPct(alloc.pct / 100)}
                </Text>
              ) : null}
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={c.textFaint}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Distribución card — stats grid 2-col por mercado ─── */

function DistribucionCard({
  alloc,
  c,
}: {
  alloc: {
    arPct: number;
    usPct: number;
    cryptoPct: number;
    categoriesCount: number;
  };
  c: ColorMap;
}) {
  const stats: Array<[string, string]> = [
    ["Argentina", formatAllocationPct(alloc.arPct / 100)],
    ["Estados Unidos", formatAllocationPct(alloc.usPct / 100)],
    ["Crypto", formatAllocationPct(alloc.cryptoPct / 100)],
    ["Categorías", `${alloc.categoriesCount}`],
  ];
  const pairs: Array<[(typeof stats)[number], (typeof stats)[number] | null]> =
    [];
  for (let i = 0; i < stats.length; i += 2) {
    pairs.push([stats[i], stats[i + 1] ?? null]);
  }
  return (
    <View style={[s.card, { marginTop: 16 }]}>
      <Text style={[s.cardEyebrow, { color: c.text }]}>Distribución</Text>
      {pairs.map(([left, right], i) => (
        <View
          key={i}
          style={[
            s.statsGridRow,
            i < pairs.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: c.border,
            },
          ]}
        >
          <View style={s.statsCell}>
            <Text style={[s.statsLabel, { color: c.textMuted }]}>
              {left[0]}
            </Text>
            <Text
              style={[s.statsValue, { color: c.text }]}
              numberOfLines={1}
            >
              {left[1]}
            </Text>
          </View>
          <View style={s.statsCell}>
            {right ? (
              <>
                <Text style={[s.statsLabel, { color: c.textMuted }]}>
                  {right[0]}
                </Text>
                <Text
                  style={[s.statsValue, { color: c.text }]}
                  numberOfLines={1}
                >
                  {right[1]}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── FloorBrick — pared 3D interactiva ──────────────────────────
 *
 * Lift del antiguo AllocationBrick: solo el ladrillo + tooltip +
 * gesture. El balance, pager y dots ahora viven en el hero.
 *
 * Geometría 1:1 con el mockup original — viewBox 340×180, pared
 * 280×100, depth 32, top inclinado 55%.
 *
 * Hold + drag highlightea un bloque y dimea el resto. Tooltip con
 * categoría + pct + lista de tickers. onResponderTerminationRequest
 * false impide que el ScrollView padre robe el touch mid-press.
 */

interface FloorBrickProps {
  holdings: Holding[];
  totalArs: number;
  /** Granularidad. "category" para AR/EE.UU/Todo, "ticker" para Crypto. */
  groupBy: "category" | "ticker";
}

function FloorBrick({ holdings, totalArs, groupBy }: FloorBrickProps) {
  const { c } = useTheme();
  const [containerW, setContainerW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const W = 340;
  const H = 180;
  const wallW = 280;
  const wallH = 100;
  const depth = 32;
  const xL = (W - (wallW + depth)) / 2;
  const yTop = 36;
  const yBot = yTop + wallH;
  const topShift = depth * 0.55;

  type Row = {
    ticker: string;
    shortTicker: string;
    change: number;
    ars: number;
  };
  const blocks = useMemo(() => {
    const byKey = new Map<
      string,
      { ars: number; rows: Row[]; cat: AssetCategory; name: string }
    >();
    for (const h of holdings) {
      const key =
        groupBy === "ticker" ? h.asset.ticker : h.asset.category;
      const entry = byKey.get(key) ?? {
        ars: 0,
        rows: [],
        cat: h.asset.category,
        name: h.asset.name,
      };
      entry.ars += h.ars;
      entry.rows.push({
        ticker: h.asset.ticker,
        shortTicker: shortCryptoTicker(h.asset.ticker),
        change: h.asset.change,
        ars: h.ars,
      });
      byKey.set(key, entry);
    }
    const sorted = Array.from(byKey.entries())
      .map(([key, { ars, rows, cat, name }]) => ({
        key,
        cat,
        label: groupBy === "ticker" ? name : categoryLabels[cat],
        ars,
        pct: (ars / totalArs) * 100,
        rows: rows.sort((a, b) => b.ars - a.ars),
      }))
      .sort((a, b) => b.pct - a.pct);

    const totalPct = sorted.reduce((acc, a) => acc + a.pct, 0) || 1;
    let xAcc = xL;
    return sorted.map((a, i) => {
      const w = (a.pct / totalPct) * wallW;
      const x0 = xAcc;
      xAcc += w;
      return {
        ...a,
        x0,
        x1: xAcc,
        color: BRICK_PALETTE[i % BRICK_PALETTE.length],
      };
    });
  }, [holdings, totalArs, groupBy, xL, wallW]);

  // Refs para handleTouch — el gesture se construye una sola vez,
  // si el handler dependiera de state mid-press el GestureDetector
  // recibiría una gesture nueva con el dedo apoyado y el highlight
  // quedaría stuck.
  const activeIdxRef = useRef<number | null>(null);
  const containerWRef = useRef(0);
  const blocksRef = useRef(blocks);
  useEffect(() => {
    containerWRef.current = containerW;
  }, [containerW]);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const handleTouch = useCallback((touchPx: number | null) => {
    let next: number | null = null;
    const cW = containerWRef.current;
    const blks = blocksRef.current;
    if (touchPx !== null && cW > 0) {
      const svgX = (touchPx / cW) * W;
      if (svgX >= xL && svgX <= xL + wallW) {
        const idx = blks.findIndex((b) => svgX >= b.x0 && svgX <= b.x1);
        next = idx >= 0 ? idx : null;
      }
    }
    if (next === activeIdxRef.current) return;
    activeIdxRef.current = next;
    setActiveIdx(next);
    if (next !== null) Haptics.selectionAsync().catch(() => {});
    // xL y wallW son constantes locales — no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTouchY = useRef(0);
  const dimmedFront = c.surfaceSunken;
  const dimmedTop = c.surfaceHover;
  const dimmedRight = c.border;

  const activeBlock =
    activeIdx !== null ? blocks[activeIdx] ?? null : null;
  const tooltipLeftPx =
    activeBlock && containerW > 0
      ? (((activeBlock.x0 + activeBlock.x1) / 2) / W) * containerW
      : 0;

  return (
    <View
      style={s.brickWrap}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      <View
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          startTouchY.current = e.nativeEvent.locationY;
          handleTouch(e.nativeEvent.locationX);
        }}
        onResponderMove={(e) => {
          // Si el dedo se mueve más de 12px en Y, soltamos el highlight
          // para que el usuario pueda scrollear. Una vez agarrado el
          // responder, RN no puede pasarlo al ScrollView padre, pero
          // esto evita estado pegado.
          const dy = Math.abs(
            e.nativeEvent.locationY - startTouchY.current,
          );
          if (dy > 12) handleTouch(null);
          else handleTouch(e.nativeEvent.locationX);
        }}
        onResponderRelease={() => handleTouch(null)}
        onResponderTerminate={() => handleTouch(null)}
      >
        <Svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={containerW > 0 ? (containerW * H) / W : undefined}
          preserveAspectRatio="xMidYMid meet"
        >
          <Ellipse
            cx={xL + (wallW + depth) / 2}
            cy={yBot + 14}
            rx={wallW / 2 + 14}
            ry={7}
            fill="rgba(14,15,12,0.10)"
          />
          {blocks.map((blk, i) => {
            const dimmed = activeIdx !== null && activeIdx !== i;
            const front = dimmed ? dimmedFront : blk.color;
            const top = dimmed ? dimmedTop : shadeHex(blk.color, 0.22);
            const labelW = blk.x1 - blk.x0;
            const showLabel = labelW > 38 && !dimmed;
            return (
              <G key={blk.key}>
                <Polygon
                  points={`${blk.x0},${yTop} ${blk.x1},${yTop} ${blk.x1},${yBot} ${blk.x0},${yBot}`}
                  fill={front}
                />
                <Polygon
                  points={`${blk.x0},${yTop} ${blk.x1},${yTop} ${blk.x1 + depth},${yTop - topShift} ${blk.x0 + depth},${yTop - topShift}`}
                  fill={top}
                />
                {showLabel ? (
                  <SvgText
                    x={(blk.x0 + blk.x1) / 2}
                    y={(yTop + yBot) / 2 + 5}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="800"
                    fill={textOnHex(blk.color)}
                    fontFamily={fontFamily[800]}
                  >
                    {Math.round(blk.pct)}%
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          {blocks.length > 0
            ? (() => {
                const last = blocks[blocks.length - 1];
                const lastIdx = blocks.length - 1;
                const dimmed =
                  activeIdx !== null && activeIdx !== lastIdx;
                const fillR = dimmed
                  ? dimmedRight
                  : shadeHex(last.color, -0.2);
                return (
                  <Polygon
                    points={`${last.x1},${yTop} ${last.x1 + depth},${yTop - topShift} ${last.x1 + depth},${yBot - topShift} ${last.x1},${yBot}`}
                    fill={fillR}
                  />
                );
              })()
            : null}
          <G
            stroke="#0E0F0C"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          >
            {blocks.slice(0, -1).map((blk) => (
              <G key={`div-${blk.key}`}>
                <Line x1={blk.x1} y1={yTop} x2={blk.x1} y2={yBot} />
                <Line
                  x1={blk.x1}
                  y1={yTop}
                  x2={blk.x1 + depth}
                  y2={yTop - topShift}
                />
              </G>
            ))}
            <Polygon
              points={`${xL},${yTop} ${xL + wallW},${yTop} ${xL + wallW},${yBot} ${xL},${yBot}`}
            />
            <Polygon
              points={`${xL},${yTop} ${xL + wallW},${yTop} ${xL + wallW + depth},${yTop - topShift} ${xL + depth},${yTop - topShift}`}
            />
            <Polygon
              points={`${xL + wallW},${yTop} ${xL + wallW + depth},${yTop - topShift} ${xL + wallW + depth},${yBot - topShift} ${xL + wallW},${yBot}`}
            />
          </G>
        </Svg>
      </View>

      {activeBlock && containerW > 0 ? (
        <Animated.View
          key={`tip-${activeIdx}`}
          entering={FadeInDown.duration(120)}
          exiting={FadeOutUp.duration(100)}
          pointerEvents="none"
          style={[
            s.tooltipAnchor,
            {
              left: tooltipLeftPx,
              bottom: ((H - yTop) * containerW) / W + 6,
            },
          ]}
        >
          <View style={[s.tooltipPill, { backgroundColor: c.ink }]}>
            <View style={s.tooltipHeader}>
              <Text style={[s.tooltipLabel, { color: c.bg }]}>
                {activeBlock.label}
              </Text>
              <Text style={[s.tooltipPct, { color: c.brand }]}>
                {formatTooltipPct(activeBlock.pct)}
              </Text>
            </View>
            {groupBy === "ticker" && activeBlock.rows.length === 1 ? (
              <>
                <View
                  style={[
                    s.tooltipDivider,
                    { backgroundColor: "rgba(255,255,255,0.12)" },
                  ]}
                />
                <View style={s.tooltipRow}>
                  <Text
                    style={[
                      s.tooltipTicker,
                      { color: "rgba(255,255,255,0.65)" },
                    ]}
                  >
                    {activeBlock.rows[0].shortTicker}
                  </Text>
                  <Text
                    style={[
                      s.tooltipChange,
                      {
                        color:
                          activeBlock.rows[0].change >= 0
                            ? c.brand
                            : "#FF6E5C",
                      },
                    ]}
                  >
                    {activeBlock.rows[0].change >= 0 ? "▲ " : "▼ "}
                    {formatPct(activeBlock.rows[0].change, false)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {activeBlock.rows.length > 0 ? (
                  <View
                    style={[
                      s.tooltipDivider,
                      { backgroundColor: "rgba(255,255,255,0.12)" },
                    ]}
                  />
                ) : null}
                {activeBlock.rows.slice(0, 5).map((r) => (
                  <View key={r.ticker} style={s.tooltipRow}>
                    <Text
                      style={[s.tooltipTicker, { color: c.bg }]}
                      numberOfLines={1}
                    >
                      {r.ticker}
                    </Text>
                    <Text
                      style={[
                        s.tooltipChange,
                        { color: r.change >= 0 ? c.brand : "#FF6E5C" },
                      ]}
                    >
                      {r.change >= 0 ? "▲ " : "▼ "}
                      {formatPct(r.change, false)}
                    </Text>
                  </View>
                ))}
                {activeBlock.rows.length > 5 ? (
                  <Text
                    style={[
                      s.tooltipMore,
                      { color: "rgba(255,255,255,0.45)" },
                    ]}
                  >
                    +{activeBlock.rows.length - 5} más
                  </Text>
                ) : null}
              </>
            )}
          </View>
          <View style={[s.tooltipCaret, { backgroundColor: c.ink }]} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ─── Helpers ─── */

/** Mezcla un hex con blanco (amt > 0) o negro (amt < 0). amt en
 *  rango [-1, 1]. Devuelve "rgb(r,g,b)". */
function shadeHex(hex: string, amt: number): string {
  if (!hex.startsWith("#")) return hex;
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = (v: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(
          v + (255 - v) * Math.max(0, amt) - v * Math.max(0, -amt),
        ),
      ),
    );
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Texto blanco sobre fondos oscuros, ink sobre claros. */
function textOnHex(color: string): string {
  return color === "#0E0F0C" || color === "#000000" ? "#FAFAF7" : "#0E0F0C";
}

/** Devuelve el ticker corto de un par crypto. "BTC/USDT" → "BTC". */
function shortCryptoTicker(ticker: string): string {
  if (ticker.includes("/USDT")) return ticker.replace("/USDT", "");
  if (ticker.endsWith("USDT.P"))
    return ticker.replace("USDT.P", "") + ".P";
  return ticker;
}

/** Pct para el tooltip — un decimal siempre, con coma. */
function formatTooltipPct(p: number): string {
  return p.toFixed(1).replace(".", ",") + "%";
}

/** Pct sin signo, máximo un decimal cuando es chico (< 10%). */
function formatAllocationPct(p: number): string {
  const v = p * 100;
  if (v >= 10) return Math.round(v).toString() + "%";
  return v.toFixed(1).replace(".", ",") + "%";
}

const s = StyleSheet.create({
  root: { flex: 1 },

  /* Hero FIJO — vive afuera del ScrollView, no scrollea. */
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
  },
  /* Título "Portfolio" — mismo peso visual que "Mercado" / "Noticias"
   * en sus respectivas tabs. 32pt bold con letterSpacing negativo
   * fuerte. Wayfinding consistente entre tabs. */
  heroTitle: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    marginBottom: 14,
  },
  heroPagerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroInfoDot: {
    width: 22,
    height: 22,
    borderCurve: "continuous",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  deltaTri: {
    fontFamily: fontFamily[700],
    fontSize: 12,
  },
  deltaText: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 2,
  },
  dot: {
    borderCurve: "continuous",
    borderRadius: 999,
  },

  /* Ladrillo full-bleed — primer item dentro del ScrollView. Sin
   * marginHorizontal porque no hay padding lateral en el ScrollView. */
  brickContainer: {
    marginTop: 8,
  },

  /* Range pills del filtro de mercado — mismo lenguaje que el rangeRow
   * de detail.tsx (1D/1S/1M/3M/1A/MAX). Active filled con el color
   * contextual del día. */
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    paddingHorizontal: 24,
  },
  rangePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: 0.3,
  },

  /* Cards full-width sin chrome — mismo s.card que detail.tsx */
  card: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  cardEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  empty: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 8,
  },

  /* Resumen card — movers showcase ─────────────────────────────────
   * Cada MoverRow ocupa una fila con label / ticker / nombre a la
   * izquierda, mini sparkline al centro, y change% a la derecha.
   * Hairline divider entre rows. Después de los movers viene el
   * summaryFooter con valor de mercado + posiciones. */
  moverRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  moverLabel: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  moverTicker: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.3,
  },
  moverName: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 1,
  },
  moverSpark: {
    width: 88,
    height: 32,
    justifyContent: "center",
  },
  moverChange: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },

  /* Footer del card Resumen — valor de mercado + posiciones, separado
   * del bloque de movers por padding generoso. Sin divider extra: la
   * última MoverRow ya cierra la sección con su isLast=true. */
  summaryFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 22,
    gap: 16,
  },
  summaryLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
  },

  /* Posiciones — list rows con hairline dividers */
  posRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  posSwatch: {
    width: 14,
    height: 14,
    borderCurve: "continuous",
    borderRadius: 3,
  },
  posLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  posSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  posValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  posPct: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },

  /* Distribución — stats grid 2-col */
  statsGridRow: {
    flexDirection: "row",
    paddingVertical: 15,
    gap: 32,
  },
  statsCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statsLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  statsValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },

  /* Ladrillo */
  brickWrap: {
    position: "relative",
    overflow: "visible",
  },

  /* Tooltip */
  tooltipAnchor: {
    position: "absolute",
    width: 0,
    alignItems: "center",
    zIndex: 5,
  },
  tooltipPill: {
    minWidth: 168,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderCurve: "continuous",
    borderRadius: radius.md,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  tooltipLabel: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tooltipPct: {
    fontFamily: fontFamily[800],
    fontSize: 13,
    letterSpacing: -0.2,
  },
  tooltipDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 7,
    marginBottom: 5,
  },
  tooltipRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 2,
  },
  tooltipTicker: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  tooltipChange: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  tooltipMore: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.1,
    marginTop: 4,
  },
  tooltipCaret: {
    width: 8,
    height: 8,
    marginTop: -4,
    transform: [{ rotate: "45deg" }],
  },
});
