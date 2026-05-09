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
import Animated, {
  FadeInDown,
  FadeOutUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path as SvgPath,
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
  type AssetCurrency,
} from "../../../lib/data/assets";
import { accounts, convertAmount } from "../../../lib/data/accounts";
import {
  categorizeAsset,
  findCategoryBySlug,
} from "../../../lib/data/marketCategories";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { BalanceInfoSheet } from "../../../lib/components/BalanceInfoSheet";
import { FlagIcon } from "../../../lib/components/FlagIcon";
import { type MarketSegmentedValue } from "../../../lib/components/MarketSegmented";
import { Tap } from "../../../lib/components/Tap";
import { AssetColorProvider } from "../../../lib/asset-color/context";
import { registerTabTap } from "../../../lib/tabs/activeTap";

/**
 * Tab 'Portfolio' — gold standard del detail.tsx aplicado a la cartera.
 *
 * Estructura (mismo patrón que detail.tsx):
 *   1. Top bar fijo con sticky overlay — el balance compacto + delta%
 *      aparecen al scrollear (crossfade), mismo lenguaje que detail.
 *   2. Hero scrollable — title 'Portfolio', balance pager ARS/USD,
 *      delta del día, dots. Scrollea hacia arriba con el contenido.
 *      El delta del día dicta la cromática del screen.
 *   3. Ladrillo full-bleed — pared 3D de distribución. Hold + drag
 *      para highlightear; tooltip aparece DEBAJO del bloque tocado
 *      para no chocar con el sticky overlay. Mientras holdeés el
 *      ladrillo, el ScrollView se bloquea (no scrolla).
 *   4. Range pills (Todo/AR/EE.UU/Crypto) — active filled con color
 *      contextual del día.
 *   5. Cards: Resumen (movers), Rendimiento (histórico, premium),
 *      Tus posiciones (por categoría), Distribución (por mercado).
 */

type Currency = "ARS" | "USD";

/** Orden canónico del pager y los dots del hero. */
const CURRENCY_ORDER: readonly Currency[] = ["ARS", "USD"];
type ColorMap = ReturnType<typeof useTheme>["c"];

interface Holding {
  asset: Asset;
  native: number;
  ars: number;
}

/* Paleta del ladrillo 3D — multi-color por diseño (cada slice
 * pide un tono distinto para distinción visual). El sexto entry
 * es el data green canónico de la app (#5AC53A); los otros
 * verdes (#00C805 vivid mint, #7EE9A6 pale, #00B864 medium) son
 * artísticos para shading y permanecen sin alinear al sistema
 * de tokens — no representan estado de activo. */
const BRICK_PALETTE = [
  "#00C805",
  "#0E0F0C",
  "#7EE9A6",
  "#00B864",
  "#94A3B8",
  "#5AC53A",
  "#6B6C66",
];

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [infoOpen, setInfoOpen] = useState(false);
  const [pagerW, setPagerW] = useState(0);

  /* Sin filtro de mercado en esta pantalla — los 3 mercados son
   * la narrativa principal y se muestran todos juntos en la
   * sección "Mercados". El usuario sigue pudiendo swipear ARS↔USD
   * en el hero (no hay lockedCurrency derivada de un filtro). */
  const lockedCurrency: Currency | null = null;

  /* ─── Holdings (todos, sin filtrar) ─── */

  const holdings = useMemo<Asset[]>(
    () =>
      assets.filter(
        (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
      ),
    [],
  );

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
  const color = dayUp ? c.brand : c.red;

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

  /* ─── Breakdown por mercado para la sección "Mercados" ────────────
   *
   * Por cada mercado (AR / US / CRYPTO) calculamos:
   *   - invested: total invertido en MONEDA NATIVA del mercado
   *     (ARS para AR, USD para US/Crypto). Es el equivalente al
   *     valor visible para el usuario en cada mercado.
   *   - investedArs: el mismo total pero en pesos, para sumar y
   *     comparar entre mercados.
   *   - count: cantidad de posiciones holdeadas en el mercado.
   *   - dayPct: % de variación del día agregando todas las
   *     posiciones de ese mercado.
   *   - cash: efectivo NO invertido en la moneda del mercado.
   *   - cashLabel: label del yield del cash (ej "10,5% TNA").
   *
   * Los 3 mercados son la narrativa central de Álamos — esta
   * sección los presenta como bloques iguales en jerarquía. */
  const marketBreakdown = useMemo(() => {
    const allHeld = assets.filter(
      (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    );
    const buckets: Record<
      "AR" | "US" | "CRYPTO",
      {
        nativeCurrency: AssetCurrency;
        invested: number;
        investedArs: number;
        daySumArs: number;
        count: number;
        cash: number;
        cashLabel: string;
      }
    > = {
      AR: {
        nativeCurrency: "ARS",
        invested: 0,
        investedArs: 0,
        daySumArs: 0,
        count: 0,
        cash: 0,
        cashLabel: "",
      },
      US: {
        nativeCurrency: "USD",
        invested: 0,
        investedArs: 0,
        daySumArs: 0,
        count: 0,
        cash: 0,
        cashLabel: "",
      },
      CRYPTO: {
        nativeCurrency: "USDT",
        invested: 0,
        investedArs: 0,
        daySumArs: 0,
        count: 0,
        cash: 0,
        cashLabel: "",
      },
    };
    for (const a of allHeld) {
      const m = assetMarket(a);
      if (m !== "AR" && m !== "US" && m !== "CRYPTO") continue;
      const native = a.price * (a.qty ?? 0);
      const ars = convertAmount(native, assetCurrency(a), "ARS");
      buckets[m].invested += native;
      buckets[m].investedArs += ars;
      buckets[m].daySumArs += (ars * a.change) / 100;
      buckets[m].count += 1;
    }
    /* Cash por moneda — sumamos los balances de las cuentas que
     * matchean. AR usa ARS, US usa USD, Crypto usa USDT. El label
     * de yield viene del primer account no vacío. */
    const sumCash = (
      cur: AssetCurrency,
    ): { total: number; label: string } => {
      const list = accounts.filter((a) => a.currency === cur);
      const total = list.reduce((acc, a) => acc + a.balance, 0);
      const lead = list.find((a) => a.balance > 0) ?? list[0];
      const label = lead
        ? `${lead.yield.pct.toFixed(1).replace(".", ",")}% ${lead.yield.label.replace("% ", "")}`
        : "";
      return { total, label };
    };
    const arCash = sumCash("ARS");
    const usCash = sumCash("USD");
    const cryptoCash = sumCash("USDT");
    buckets.AR.cash = arCash.total;
    buckets.AR.cashLabel = arCash.label;
    buckets.US.cash = usCash.total;
    buckets.US.cashLabel = usCash.label;
    buckets.CRYPTO.cash = cryptoCash.total;
    buckets.CRYPTO.cashLabel = cryptoCash.label;
    return buckets;
  }, []);

  /* ─── Sticky overlay scroll-aware (mismo patrón detail.tsx) ─── */

  const stickyScrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      stickyScrollY.value = e.contentOffset.y;
    },
  });
  const STICKY_START = 110;
  const STICKY_FULL = 180;
  const stickyOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      stickyScrollY.value,
      [STICKY_START, STICKY_FULL],
      [0, 1],
      "clamp",
    ),
  }));

  /* ─── Refs + tab tap + refresh ─── */

  const scrollRef = useRef<ScrollView | null>(null);
  const pagerRef = useRef<ScrollView | null>(null);

  // Holding del ladrillo — mientras finger está apoyado, el ScrollView
  // se bloquea (scrollEnabled=false) para que el dedo no scrollee
  // accidentalmente mientras el usuario explora la distribución.
  const [brickHolding, setBrickHolding] = useState(false);
  // Visualización seleccionada — pie chart por default. El usuario
  // puede alternar con el toggle de glyphs arriba del chart.
  const [viz, setViz] = useState<"pie" | "brick">("pie");

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
      isAtTop: () => stickyScrollY.value <= 8,
      scrollToTop: () =>
        scrollRef.current?.scrollTo({ y: 0, animated: true }),
      refresh: () => {
        if (!refreshing) onRefresh();
      },
    });
    // stickyScrollY es shared value — su .value cambia sin re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshing, onRefresh]);

  // Cuando el filtro impone una moneda fija (AR / US / CRYPTO), forza
  // currency a ese valor. En "all" no toca la state — el usuario
  // mantiene su última elección entre ARS / USD / USDT.
  useEffect(() => {
    if (lockedCurrency) {
      setCurrency(lockedCurrency);
      if (pagerW > 0) {
        const idx = CURRENCY_ORDER.indexOf(lockedCurrency);
        pagerRef.current?.scrollTo({
          x: idx * pagerW,
          y: 0,
          animated: false,
        });
      }
    }
  }, [lockedCurrency, pagerW]);

  /* ─── Display values en moneda actual ─── */

  const totalDisplay =
    currency === "ARS" ? totalArs : convertAmount(totalArs, "ARS", currency);
  const daySumDisplay =
    currency === "ARS" ? daySumArs : convertAmount(daySumArs, "ARS", currency);

  const hasHoldings = holdingsSorted.length > 0 && totalArs > 0;

  /* ─── Render ─── */

  return (
    <AssetColorProvider up={dayUp}>
      <View style={[s.root, { backgroundColor: c.bg }]}>
        {/* Top bar — solo bg sólido + safe area + un poco de padding.
            El sticky overlay vive como sibling absolute (sin reservar
            espacio en el flex layout) — así cuando está invisible el
            hero arranca apenas debajo del status bar. */}
        <View
          style={[
            s.topBar,
            {
              paddingTop: insets.top + 8,
              backgroundColor: c.bg,
            },
          ]}
        />

        {/* Sticky overlay — absolute con bg propio. Crossfade-aparece
            al scrollear; cuando opacity=0 no oculta nada (bg también
            transparente). pointerEvents=none para no robar taps. */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.stickyOverlay,
            {
              top: insets.top + 8,
              backgroundColor: c.bg,
            },
            stickyOpacityStyle,
          ]}
        >
          <Text
            style={[s.stickyPrice, { color: c.text }]}
            numberOfLines={1}
          >
            {formatMoney(totalDisplay, currency)}
          </Text>
          <View style={s.stickyRow}>
            <Text style={[s.stickyTicker, { color: c.textMuted }]}>
              Portfolio
            </Text>
            <Text style={[s.stickyDot, { color: c.textMuted }]}>·</Text>
            <Text style={[s.stickyPct, { color }]}>
              {formatPct(dayPct)}
            </Text>
          </View>
        </Animated.View>

        <Animated.ScrollView
          ref={scrollRef as never}
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!brickHolding}
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
          {/* ─── Hero scrollable ─── */}
          <View style={s.heroBlock}>
            <Text style={[s.heroTitle, { color: c.text }]}>Portfolio</Text>

          <View style={s.heroPagerRow}>
            <View
              style={{ flex: 1 }}
              onLayout={(e) => setPagerW(e.nativeEvent.layout.width)}
            >
              {lockedCurrency ? (
                /* Filtro fija la moneda → render single AmountDisplay,
                   sin pager. AR=ARS, US/CRYPTO=USD. */
                <AmountDisplay
                  value={
                    lockedCurrency === "ARS"
                      ? totalArs
                      : convertAmount(totalArs, "ARS", "USD")
                  }
                  size={42}
                  currency={lockedCurrency}
                />
              ) : pagerW > 0 ? (
                /* "Todo" → pager swipeable ARS / USD / USDT. */
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
                    x: CURRENCY_ORDER.indexOf(currency) * pagerW,
                    y: 0,
                  }}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.x / pagerW,
                    );
                    const next = CURRENCY_ORDER[idx] ?? "ARS";
                    if (next !== currency) {
                      Haptics.selectionAsync().catch(() => {});
                      setCurrency(next);
                    }
                  }}
                  style={{ flexGrow: 0 }}
                >
                  {CURRENCY_ORDER.map((cur) => {
                    const value =
                      cur === "ARS"
                        ? totalArs
                        : convertAmount(totalArs, "ARS", cur);
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
                { borderColor: c.border },
              ]}
            >
              <Text
                style={[s.heroInfoLetter, { color: c.textMuted }]}
              >
                i
              </Text>
            </Tap>
          </View>

          {/* Dots ARS / USD / USDT — SIEMPRE renderizados con la misma
              altura. En "Todo" son tappable selectors; en AR/US/Crypto
              son indicadores estáticos del lock contextual. Layout
              constante entre filtros. */}
          <View style={s.dotsRow}>
            {CURRENCY_ORDER.map((cur) => {
              const active = cur === currency;
              const interactive = !lockedCurrency;
              return (
                <Tap
                  key={cur}
                  hitSlop={interactive ? 10 : 0}
                  haptic={interactive ? "selection" : "none"}
                  onPress={() => {
                    if (!interactive) return;
                    if (cur === currency) return;
                    setCurrency(cur);
                    pagerRef.current?.scrollTo({
                      x: CURRENCY_ORDER.indexOf(cur) * pagerW,
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

          </View>

          {/* ─── Mercados — los 3 buckets de Álamos. Cada uno con su
              monto en moneda nativa + delta del día + posiciones +
              cash disponible. Es el corazón narrativo de la pantalla.
              Hairlines como única división, sin cards. Va PRIMERO
              (antes del chart) — los números crudos arriba, el
              chart abajo como confirmación visual. */}
          {hasHoldings ? (
            <View style={s.marketsBlock}>
              <Text style={[s.sectionTitle, { color: c.text }]}>
                Mercados
              </Text>
              <MarketRow
                label="Argentina"
                bucket={marketBreakdown.AR}
                c={c}
              />
              <MarketRow
                label="Estados Unidos"
                bucket={marketBreakdown.US}
                c={c}
                divider
              />
              <MarketRow
                label="Crypto"
                bucket={marketBreakdown.CRYPTO}
                c={c}
                divider
              />
            </View>
          ) : null}

          {/* ─── Composición — chart pie / brick con toggle explícito.
              Va DESPUÉS de Mercados: los números primero, la
              visualización después como confirmación. Sin card. */}
          {hasHoldings ? (
            <View style={s.chartBlock}>
              <View style={s.chartHeader}>
                <Text style={[s.sectionTitle, { color: c.text, marginBottom: 0 }]}>
                  Composición
                </Text>
                <View
                  style={[
                    s.vizSeg,
                    { backgroundColor: c.surfaceHover },
                  ]}
                >
                  <Tap
                    onPress={() => setViz("pie")}
                    haptic="selection"
                    pressScale={0.95}
                    hitSlop={4}
                    style={[
                      s.vizSegBtn,
                      viz === "pie" && { backgroundColor: c.bg },
                    ]}
                  >
                    <PieGlyph
                      color={viz === "pie" ? c.text : c.textMuted}
                      size={14}
                    />
                    <Text
                      style={[
                        s.vizSegLabel,
                        {
                          color: viz === "pie" ? c.text : c.textMuted,
                          fontFamily:
                            viz === "pie" ? fontFamily[700] : fontFamily[500],
                        },
                      ]}
                    >
                      Pie
                    </Text>
                  </Tap>
                  <Tap
                    onPress={() => setViz("brick")}
                    haptic="selection"
                    pressScale={0.95}
                    hitSlop={4}
                    style={[
                      s.vizSegBtn,
                      viz === "brick" && { backgroundColor: c.bg },
                    ]}
                  >
                    <BrickGlyph
                      color={viz === "brick" ? c.text : c.textMuted}
                      size={14}
                    />
                    <Text
                      style={[
                        s.vizSegLabel,
                        {
                          color: viz === "brick" ? c.text : c.textMuted,
                          fontFamily:
                            viz === "brick" ? fontFamily[700] : fontFamily[500],
                        },
                      ]}
                    >
                      Ladrillo
                    </Text>
                  </Tap>
                </View>
              </View>
              <View style={s.chartCanvas}>
                {viz === "pie" ? (
                  <FloorPie
                    holdings={holdingsSorted}
                    totalArs={totalArs}
                    currency={currency}
                    groupBy="category"
                    onHoldChange={setBrickHolding}
                  />
                ) : (
                  <FloorBrick
                    holdings={holdingsSorted}
                    totalArs={totalArs}
                    groupBy="category"
                    onHoldChange={setBrickHolding}
                  />
                )}
              </View>
            </View>
          ) : null}

          {/* ─── Rendimiento — link de una sola línea al detalle. */}
          {hasHoldings ? (
            <Pressable
              onPress={() => router.push("/(app)/rendimiento" as never)}
              style={({ pressed }) => [
                s.linkRow,
                {
                  borderTopColor: c.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text style={[s.linkRowLabel, { color: c.text }]}>
                Rendimiento histórico
              </Text>
              <View style={s.linkRowTrailing}>
                <Text style={[s.linkRowValue, { color: c.brand }]}>
                  {formatPct(12.4)}
                </Text>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={c.textMuted}
                />
              </View>
            </Pressable>
          ) : null}

          {hasHoldings ? (
            <PosicionesCard
              groups={groupedByCategory}
              allocations={categoryAllocations}
              positionsCount={holdingsSorted.length}
              onTap={(slug) =>
                router.push({
                  pathname: "/(app)/market-category",
                  params: { slug },
                })
              }
              c={c}
            />
          ) : (
            /* Empty state accionable — el doc lo destaca: "empty
               states son una oportunidad de activación, no un mensaje
               de error". Copy específico por filtro + CTA al Mercado. */
            <View style={[s.card, { paddingTop: 24 }]}>
              <Text style={[s.emptyTitle, { color: c.text }]}>
                Empezá con $1.000
              </Text>
              <Text style={[s.emptyBody, { color: c.textMuted }]}>
                Comprá tu primer CEDEAR en 30 segundos y arrancá tu cartera.
              </Text>
              <Tap
                haptic="medium"
                pressScale={0.97}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/(tabs)/explore",
                  })
                }
                style={[s.emptyCta, { backgroundColor: c.text }]}
              >
                <Text style={[s.emptyCtaText, { color: c.bg }]}>
                  Ir a Mercado
                </Text>
              </Tap>
            </View>
          )}
        </Animated.ScrollView>

        <BalanceInfoSheet
          visible={infoOpen}
          onClose={() => setInfoOpen(false)}
        />
      </View>
    </AssetColorProvider>
  );
}

/* ─── InfoRow — fila del info column del first-block ──────────────
 *
 * Cada InfoRow es una mini-card vertical: eyebrow uppercase + primary
 * value. Opcionalmente tiene `trailing` (un pct a la derecha del
 * primary) y `arrow` (chevron verde para acciones tappable). Spacing
 * compacto para que las 4 rows entren en la altura del pie chart. */

function InfoRow({
  eyebrow,
  eyebrowColor,
  primary,
  primaryColor,
  trailing,
  trailingColor,
  arrow,
  onPress,
  c,
}: {
  eyebrow: string;
  eyebrowColor?: string;
  primary: string;
  primaryColor?: string;
  trailing?: string;
  trailingColor?: string;
  arrow?: boolean;
  onPress?: () => void;
  c: ColorMap;
}) {
  const content = (
    <>
      <Text
        style={[
          s.infoEyebrow,
          { color: eyebrowColor ?? c.textMuted },
        ]}
        numberOfLines={1}
      >
        {eyebrow}
      </Text>
      <View style={s.infoValueRow}>
        <Text
          style={[
            s.infoPrimary,
            { color: primaryColor ?? c.text },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {primary}
        </Text>
        {trailing ? (
          <Text
            style={[
              s.infoTrailing,
              { color: trailingColor ?? c.textMuted },
            ]}
            numberOfLines={1}
          >
            {trailing}
          </Text>
        ) : null}
        {arrow ? (
          <View style={s.infoArrow}>
            <Feather
              name="arrow-up-right"
              size={14}
              color={c.brand}
            />
          </View>
        ) : null}
      </View>
    </>
  );
  if (onPress) {
    return (
      <Tap
        onPress={onPress}
        haptic="selection"
        pressScale={0.97}
        style={s.infoRow}
      >
        {content}
      </Tap>
    );
  }
  return <View style={s.infoRow}>{content}</View>;
}

/* ─── MarketRow — fila de un mercado en la sección "Mercados" ─────
 *
 * Layout 2-líneas con la misma jerarquía en cada mercado:
 *   line 1: nombre del mercado          monto en moneda nativa
 *   line 2: N posiciones · cash         delta del día
 *
 * Sin cards, sin íconos de chart, sin chrome — sólo texto y un
 * hairline divider arriba si no es el primero. */

interface MarketBucket {
  nativeCurrency: AssetCurrency;
  invested: number;
  investedArs: number;
  daySumArs: number;
  count: number;
  cash: number;
  cashLabel: string;
}

function MarketRow({
  label,
  bucket,
  c,
  divider,
}: {
  label: string;
  bucket: MarketBucket;
  c: ColorMap;
  divider?: boolean;
}) {
  const empty = bucket.count === 0 && bucket.cash === 0;
  const yesterdayArs = bucket.investedArs - bucket.daySumArs;
  const dayPct =
    yesterdayArs > 0 ? (bucket.daySumArs / yesterdayArs) * 100 : 0;
  const dayUp = bucket.daySumArs >= 0;
  const deltaColor = empty ? c.textMuted : dayUp ? c.brand : c.red;

  /* Format del cash en notation compact en la línea de subtítulo. El
   * monto principal sale del invertido ya formateado en su moneda. */
  const investedDisplay = formatMoney(
    bucket.invested,
    bucket.nativeCurrency,
  );
  const cashDisplay =
    bucket.cash > 0
      ? `${formatMoney(bucket.cash, bucket.nativeCurrency)} libres`
      : null;
  const countLabel =
    bucket.count === 0
      ? "Sin posiciones"
      : `${bucket.count} ${bucket.count === 1 ? "posición" : "posiciones"}`;
  const subtitle = cashDisplay
    ? `${countLabel} · ${cashDisplay}`
    : countLabel;

  return (
    <View
      style={[
        s.marketRow,
        divider && {
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={s.marketRowTop}>
        <Text style={[s.marketName, { color: c.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text
          style={[s.marketAmount, { color: empty ? c.textMuted : c.text }]}
          numberOfLines={1}
        >
          {empty ? "—" : investedDisplay}
        </Text>
      </View>
      <View style={s.marketRowBottom}>
        <Text style={[s.marketSubtitle, { color: c.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {!empty ? (
          <Text style={[s.marketDelta, { color: deltaColor }]} numberOfLines={1}>
            {dayUp ? "▲" : "▼"} {formatPct(dayPct)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ─── PieGlyph / BrickGlyph — toggle icons del viz selector ─────── */

function PieGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Circle
        cx={9}
        cy={9}
        r={6.5}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
      />
      <SvgPath
        d="M 9 9 L 9 2.5 M 9 9 L 14.6 12.25"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function BrickGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      {/* Mini pared 3D — wall front + top inclined */}
      <Polygon
        points="3,7 13,7 13,14 3,14"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Polygon
        points="3,7 13,7 15,5 5,5"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Polygon
        points="13,7 15,5 15,12 13,14"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Line
        x1={8}
        y1={7}
        x2={8}
        y2={14}
        stroke={color}
        strokeWidth={1.2}
      />
    </Svg>
  );
}

/* ─── CashCard — chips de saldos no invertidos ────────────────────
 *
 * Vive justo debajo del pie chart. Cada chip representa una moneda
 * de cash con su monto + yield (TNA o APY según la cuenta). Filtra
 * por marketFilter: "Todo" muestra los 3, "AR" solo ARS, "US" solo
 * USD, "Crypto" solo USDT.
 *
 * Visual: eyebrow "Sin invertir" + row de chips con flex:1. Cada
 * chip tiene bg c.surfaceHover, continuous radius, padding cómodo,
 * dos líneas (monto bold + yield muted). Squarish-pill.
 */

function CashCard({
  marketFilter,
  c,
}: {
  marketFilter: MarketSegmentedValue;
  c: ColorMap;
}) {
  // Saldos sumados por moneda + el mejor yield de las cuentas que la
  // tienen (típicamente solo hay una por moneda en el mock, así que
  // tomamos el primero que matchee).
  const arsAccounts = accounts.filter((a) => a.currency === "ARS");
  const usdAccounts = accounts.filter((a) => a.currency === "USD");
  const usdtAccounts = accounts.filter((a) => a.currency === "USDT");

  const sumBalance = (list: typeof accounts): number =>
    list.reduce((acc, a) => acc + a.balance, 0);

  const wantARS = marketFilter === "all" || marketFilter === "AR";
  const wantUSD = marketFilter === "all" || marketFilter === "US";
  const wantUSDT = marketFilter === "all" || marketFilter === "CRYPTO";

  type Chip = {
    key: string;
    amount: string;
    yieldLabel: string;
  };
  const chips: Chip[] = [];
  if (wantARS && arsAccounts.length > 0) {
    const total = sumBalance(arsAccounts);
    chips.push({
      key: "ARS",
      amount: `$ ${formatCashCompact(total)}`,
      yieldLabel: `${arsAccounts[0].yield.pct.toFixed(1).replace(".", ",")}% ${arsAccounts[0].yield.label.replace("% ", "")}`,
    });
  }
  if (wantUSD && usdAccounts.length > 0) {
    const total = sumBalance(usdAccounts);
    if (total > 0) {
      chips.push({
        key: "USD",
        amount: `US$ ${formatCashCompact(total)}`,
        yieldLabel: `${usdAccounts.find((a) => a.balance > 0)?.yield.pct.toFixed(1).replace(".", ",") ?? "0"}% APY`,
      });
    }
  }
  if (wantUSDT && usdtAccounts.length > 0) {
    const total = sumBalance(usdtAccounts);
    chips.push({
      key: "USDT",
      amount: `${formatCashCompact(total)} USDT`,
      yieldLabel: `${usdtAccounts[0].yield.pct.toFixed(1).replace(".", ",")}% APY`,
    });
  }

  if (chips.length === 0) return null;

  return (
    <View style={s.cashCard}>
      <Text style={[s.cashEyebrow, { color: c.textMuted }]}>
        Sin invertir
      </Text>
      <View style={s.cashRow}>
        {chips.map((chip) => (
          <View
            key={chip.key}
            style={[
              s.cashChip,
              { backgroundColor: c.surfaceHover },
            ]}
          >
            <Text
              style={[s.cashAmount, { color: c.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {chip.amount}
            </Text>
            <Text
              style={[s.cashYield, { color: c.textMuted }]}
              numberOfLines={1}
            >
              {chip.yieldLabel}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Compact format para los chips de cash — los números acá son
 *  saldos chicos a medianos: $342.180 → "342k" para entrar en el chip. */
function formatCashCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + "M";
  if (abs >= 1e3) return Math.round(n / 1e3).toString() + "k";
  return n.toLocaleString("es-AR");
}

/* ─── SegGlyph — glyph del segmented por id. Flippea bg/fg cuando
 *     el pill está active para mantener legibilidad sobre el fondo
 *     sólido contextual del active state. */
function SegGlyph({
  id,
  active,
  color,
  c,
}: {
  id: MarketSegmentedValue;
  active: boolean;
  color: string;
  c: ColorMap;
}) {
  if (id === "AR" || id === "US") {
    return <FlagIcon code={id} size={18} />;
  }
  if (id === "CRYPTO") {
    const bg = active ? c.bg : c.brand;
    const fg = active ? color : c.bg;
    return (
      <View style={[s.segBadge, { backgroundColor: bg }]}>
        <Text style={[s.segBadgeText, { color: fg }]}>₿</Text>
      </View>
    );
  }
  // "all" — alamos isotipo (2 triángulos overlapping). En active el
  // círculo se vuelve c.bg con triángulos en el color contextual,
  // así sobresale del fondo solid del active pill.
  const bg = active ? c.bg : c.brand;
  const stroke = active ? color : "#FFFFFF";
  return (
    <View style={[s.segBadge, { backgroundColor: bg }]}>
      <Svg width={14} height={14} viewBox="0 0 100 100">
        <Polygon
          points="38,26 16,86 60,86"
          stroke={stroke}
          strokeWidth={10}
          strokeLinejoin="round"
          fill="none"
        />
        <Polygon
          points="56,12 29,86 83,86"
          stroke={stroke}
          strokeWidth={10}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}


/* ─── Posiciones card ─── */

function PosicionesCard({
  groups,
  allocations,
  positionsCount,
  onTap,
  c,
}: {
  groups: Array<
    [string, { totalArs: number; count: number; cat: AssetCategory }]
  >;
  allocations: Map<AssetCategory, { color: string; pct: number }>;
  positionsCount: number;
  onTap: (slug: string) => void;
  c: ColorMap;
}) {
  return (
    <View style={[s.card, { marginTop: 16 }]}>
      <View style={s.cardHead}>
        <Text style={[s.cardEyebrow, { color: c.text, marginBottom: 0 }]}>
          Tus posiciones
        </Text>
        <Text style={[s.cardCount, { color: c.textMuted }]}>
          {positionsCount} {positionsCount === 1 ? "activo" : "activos"}
        </Text>
      </View>
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

/* ─── FloorPie — donut chart interactivo ─────────────────────────
 *
 * Visualización principal de la distribución de la cartera. Cada slice
 * representa una categoría (o ticker en Crypto), coloreada con la
 * misma paleta del FloorBrick así ambas vistas hablan el mismo idioma
 * cromático sobre los mismos datos.
 *
 * Premium touches:
 *   - Outline 1.5pt ink en cada slice — feel handcrafted, mismo
 *     lenguaje que el ladrillo.
 *   - Drop shadow elíptico debajo del donut — depth sutil.
 *   - Donut hole con info en el centro: balance compact + label
 *     'Distribución' en estado neutral; categoría + % + count cuando
 *     se holdea un slice.
 *   - Slices atenuados a surfaceSunken cuando otro slice está activo
 *     — focus claro, narrativa simple.
 *   - Mismo gesture model que el ladrillo: hold + drag highlightea,
 *     soltar resetea, ScrollView padre se bloquea durante el hold.
 *
 * Geometría: viewBox 340 × 200, donut centrado en (170, 100), outer
 * radius 78, inner radius 48 (anillo de 30 de grosor). */

interface FloorPieProps {
  holdings: Holding[];
  totalArs: number;
  currency: Currency;
  groupBy: "category" | "ticker";
  onHoldChange?: (holding: boolean) => void;
}

function FloorPie({
  holdings,
  totalArs,
  currency,
  groupBy,
  onHoldChange,
}: FloorPieProps) {
  const { c } = useTheme();
  const [containerW, setContainerW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Geometría del viewBox — cuadrado para layout 2-col. Donut centrado
  // con outer 70 / inner 42 → grosor de anillo 28.
  const W = 200;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2;
  const outerR = 70;
  const innerR = 42;

  type Row = {
    ticker: string;
    shortTicker: string;
    change: number;
    ars: number;
  };

  const slices = useMemo(() => {
    const byKey = new Map<
      string,
      { ars: number; rows: Row[]; cat: AssetCategory; name: string }
    >();
    for (const h of holdings) {
      const key = groupBy === "ticker" ? h.asset.ticker : h.asset.category;
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
        count: rows.length,
        rows: rows.sort((a, b) => b.ars - a.ars),
      }))
      .sort((a, b) => b.pct - a.pct);

    // Asignación angular acumulativa. -π/2 (12 en punto) como inicio
    // — convención que se siente más natural en pies financieros.
    let cumulative = -Math.PI / 2;
    return sorted.map((s, i) => {
      const startAngle = cumulative;
      const sweep = (s.pct / 100) * 2 * Math.PI;
      const endAngle = startAngle + sweep;
      cumulative = endAngle;
      return {
        ...s,
        startAngle,
        endAngle,
        color: BRICK_PALETTE[i % BRICK_PALETTE.length],
      };
    });
  }, [holdings, totalArs, groupBy]);

  // Refs para el handleTouch (mismo motivo que el FloorBrick).
  const activeIdxRef = useRef<number | null>(null);
  const containerWRef = useRef(0);
  const slicesRef = useRef(slices);
  useEffect(() => {
    containerWRef.current = containerW;
  }, [containerW]);
  useEffect(() => {
    slicesRef.current = slices;
  }, [slices]);

  const handleTouch = useCallback(
    (px: number | null, py: number | null) => {
      let next: number | null = null;
      const cW = containerWRef.current;
      const sl = slicesRef.current;
      if (px !== null && py !== null && cW > 0) {
        // Convertir px/py del container al sistema del viewBox. Como
        // preserveAspectRatio="xMidYMid meet" y el container ocupa todo
        // el ancho, scale = W / cW. La altura se renderea como
        // cW * H / W, así el scale Y es igual.
        const scale = W / cW;
        const vbX = px * scale;
        const vbY = py * scale;
        const dx = vbX - cx;
        const dy = vbY - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Solo dentro del anillo (con un poco de tolerancia).
        if (distance <= outerR + 4 && distance >= innerR - 4) {
          let angle = Math.atan2(dy, dx);
          // Normalizar al rango [-π/2, 3π/2) que matchea nuestro start.
          if (angle < -Math.PI / 2) angle += 2 * Math.PI;
          const idx = sl.findIndex(
            (s) => angle >= s.startAngle && angle <= s.endAngle,
          );
          next = idx >= 0 ? idx : null;
        }
      }
      if (next === activeIdxRef.current) return;
      activeIdxRef.current = next;
      setActiveIdx(next);
      if (next !== null) Haptics.selectionAsync().catch(() => {});
    },
    [],
  );

  const activeSlice =
    activeIdx !== null ? slices[activeIdx] ?? null : null;
  const dimmedFill = c.surfaceSunken;

  // Texto del centro — compact balance en neutral, info de slice activa
  // en hold. Renderizado como View+Text para honrar Plus Jakarta.
  const totalDisplay =
    currency === "ARS" ? totalArs : convertAmount(totalArs, "ARS", currency);

  return (
    <View
      style={s.brickWrap}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      <View
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          onHoldChange?.(true);
          handleTouch(
            e.nativeEvent.locationX,
            e.nativeEvent.locationY,
          );
        }}
        onResponderMove={(e) =>
          handleTouch(
            e.nativeEvent.locationX,
            e.nativeEvent.locationY,
          )
        }
        onResponderRelease={() => {
          onHoldChange?.(false);
          handleTouch(null, null);
        }}
        onResponderTerminate={() => {
          onHoldChange?.(false);
          handleTouch(null, null);
        }}
      >
        <Svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={containerW > 0 ? (containerW * H) / W : undefined}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Drop shadow debajo del donut — same lenguaje que el
              ladrillo: óvalo gris bajo de opacidad. */}
          <Ellipse
            cx={cx}
            cy={cy + outerR + 12}
            rx={outerR + 4}
            ry={5}
            fill="rgba(14,15,12,0.10)"
          />

          {/* Slices del donut. */}
          {slices.map((slice, i) => {
            const dimmed = activeIdx !== null && activeIdx !== i;
            const fill = dimmed ? dimmedFill : slice.color;
            return (
              <SvgPath
                key={slice.key}
                d={annularSectorPath(
                  cx,
                  cy,
                  innerR,
                  outerR,
                  slice.startAngle,
                  slice.endAngle,
                )}
                fill={fill}
                stroke="#0E0F0C"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            );
          })}
        </Svg>

        {/* Center text — siempre constante (balance + 'Distribución').
            La info dinámica del slice activo vive en el tooltip de
            abajo, igual que en el ladrillo. */}
        {containerW > 0 ? (
          <View
            pointerEvents="none"
            style={[
              s.pieCenter,
              {
                width: containerW,
                height: (containerW * H) / W,
              },
            ]}
          >
            <Text
              style={[s.pieCenterPrimary, { color: c.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCenterMoney(totalDisplay, currency)}
            </Text>
            <Text
              style={[s.pieCenterSecondary, { color: c.textMuted }]}
              numberOfLines={1}
            >
              Distribución
            </Text>
          </View>
        ) : null}
      </View>

      {/* Tooltip — aparece al holdear un slice. Mismo patrón visual
          que el FloorBrick: pill ink + label uppercase + pct en
          brand + lista de tickers con su variación. Posicionado
          debajo del donut, centrado horizontalmente. Caret apunta
          hacia arriba. */}
      {activeSlice && containerW > 0 ? (
        <Animated.View
          key={`pie-tip-${activeIdx}`}
          entering={FadeInDown.duration(120)}
          exiting={FadeOutUp.duration(100)}
          pointerEvents="none"
          style={[
            s.tooltipAnchor,
            {
              left: containerW / 2,
              top: ((cy + outerR + 22) * containerW) / W,
            },
          ]}
        >
          <View style={[s.tooltipCaret, { backgroundColor: c.ink }]} />
          <View style={[s.tooltipPill, { backgroundColor: c.ink }]}>
            <View style={s.tooltipHeader}>
              <Text style={[s.tooltipLabel, { color: c.bg }]}>
                {activeSlice.label}
              </Text>
              <Text style={[s.tooltipPct, { color: c.brand }]}>
                {formatTooltipPct(activeSlice.pct)}
              </Text>
            </View>
            {groupBy === "ticker" && activeSlice.rows.length === 1 ? (
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
                    {activeSlice.rows[0].shortTicker}
                  </Text>
                  <Text
                    style={[
                      s.tooltipChange,
                      {
                        color:
                          activeSlice.rows[0].change >= 0
                            ? c.brand
                            : "#FF6E5C",
                      },
                    ]}
                  >
                    {activeSlice.rows[0].change >= 0 ? "▲ " : "▼ "}
                    {formatPct(activeSlice.rows[0].change, false)}
                  </Text>
                </View>
              </>
            ) : (
              <>
                {activeSlice.rows.length > 0 ? (
                  <View
                    style={[
                      s.tooltipDivider,
                      { backgroundColor: "rgba(255,255,255,0.12)" },
                    ]}
                  />
                ) : null}
                {activeSlice.rows.slice(0, 5).map((r) => (
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
                        {
                          color: r.change >= 0 ? c.brand : "#FF6E5C",
                        },
                      ]}
                    >
                      {r.change >= 0 ? "▲ " : "▼ "}
                      {formatPct(r.change, false)}
                    </Text>
                  </View>
                ))}
                {activeSlice.rows.length > 5 ? (
                  <Text
                    style={[
                      s.tooltipMore,
                      { color: "rgba(255,255,255,0.45)" },
                    ]}
                  >
                    +{activeSlice.rows.length - 5} más
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Path SVG de un sector anular (donut slice). */
function annularSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);
  const x3 = cx + innerR * Math.cos(endAngle);
  const y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

/** Compact format para el centro del donut — los millones argentinos
 *  no caben full ($ 12.840.000), así que abreviamos. */
function formatCenterMoney(n: number, currency: Currency): string {
  const abs = Math.abs(n);
  if (currency === "ARS") {
    if (abs >= 1e9) return `$ ${(n / 1e9).toFixed(1).replace(".", ",")} B`;
    if (abs >= 1e6) return `$ ${(n / 1e6).toFixed(1).replace(".", ",")} M`;
    if (abs >= 1e3) return `$ ${Math.round(n / 1e3)} K`;
    return formatMoney(n, currency);
  }
  // USD — números más chicos, formato natural.
  if (abs >= 1e6) {
    return `${(n / 1e6).toFixed(1).replace(".", ",")} M ${currency}`;
  }
  if (abs >= 1e3) {
    return `${(n / 1e3).toFixed(1).replace(".", ",")} K ${currency}`;
  }
  return formatMoney(n, currency);
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
  /** Callback que dispara true cuando el dedo agarra el ladrillo
   *  y false cuando lo suelta. El ScrollView padre lo usa para
   *  bloquearse mientras el usuario está holdeando. */
  onHoldChange?: (holding: boolean) => void;
}

function FloorBrick({
  holdings,
  totalArs,
  groupBy,
  onHoldChange,
}: FloorBrickProps) {
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
          onHoldChange?.(true);
          handleTouch(e.nativeEvent.locationX);
        }}
        onResponderMove={(e) => {
          // Mientras el dedo está apoyado, el ScrollView padre está
          // bloqueado (scrollEnabled=false) — así que el highlight
          // sigue al dedo sin escape. Soltar para volver a scrollear.
          handleTouch(e.nativeEvent.locationX);
        }}
        onResponderRelease={() => {
          onHoldChange?.(false);
          handleTouch(null);
        }}
        onResponderTerminate={() => {
          onHoldChange?.(false);
          handleTouch(null);
        }}
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
              // Position DEBAJO del bloque tocado — apunta hacia el
              // bloque desde abajo. Antes estaba arriba, pero el
              // sticky overlay del header lo ocultaba al scrollear.
              top: (yBot * containerW) / W + 6,
            },
          ]}
        >
          <View style={[s.tooltipCaret, { backgroundColor: c.ink }]} />
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

  /* Top bar — solo bg + safe area. NO contiene el sticky overlay
   * (vive aparte, absolute) → no reserva espacio cuando está oculto. */
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  /* Sticky overlay — absolute, sibling del topBar. Posicionado en
   * `top: insets.top + 8` (igual que el padding superior del topBar).
   * Tiene bg propio que crossfade-aparece junto con el texto, así no
   * reserva espacio cuando opacity=0 y el hero puede arrancar apenas
   * debajo del topBar. justifyContent flex-start + paddingTop chico
   * deja más whitespace debajo del 'Portfolio · variación' que arriba. */
  stickyOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 56,
    paddingTop: 2,
    alignItems: "center",
    justifyContent: "flex-start",
    zIndex: 10,
  },
  stickyPrice: {
    fontFamily: fontFamily[500],
    fontSize: 17,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  stickyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginTop: 1,
  },
  stickyTicker: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.15,
  },
  stickyDot: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    opacity: 0.6,
  },
  stickyPct: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.05,
  },

  /* Hero scrollable — title + balance + delta + dots. Scrollea
   * normal con el contenido (no es sticky, eso lo hace el overlay). */
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
    marginBottom: 4,
  },
  heroPagerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  /* Info dot — border-only circle con "i" tipográfica en Plus Jakarta
   * 800. Reemplaza el Feather "info" genérico por un treatment que
   * usa la typography del design system (negative letter spacing,
   * weight álamos, continuous radius). */
  heroInfoDot: {
    width: 22,
    height: 22,
    borderCurve: "continuous",
    borderRadius: 11,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInfoLetter: {
    fontFamily: fontFamily[800],
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.4,
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
  /* Dots row — compacto, justo debajo del saldo. Siempre renderizado
   * con altura constante para que el layout no se mueva al alternar
   * entre filtros. */
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    height: 8,
  },
  dot: {
    borderCurve: "continuous",
    borderRadius: 999,
  },
  /* Ladrillo full-bleed — sigue al hero scrollable. Sin
   * marginHorizontal porque el ScrollView no tiene padding lateral. */
  brickContainer: {
    marginTop: 24,
  },

  /* Chart block — full width, sin card. Header con title izquierda
   * + segmented Pie/Ladrillo a la derecha. */
  chartBlock: {
    paddingHorizontal: 24,
    marginTop: 28,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  /* Segmented Pie/Ladrillo — pill estilo iOS. Activo con bg c.bg
   * y texto bold; inactivo translúcido con texto muted. */
  vizSeg: {
    flexDirection: "row",
    padding: 3,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  vizSegBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  vizSegLabel: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  /* Toggle viejo (vizToggleRow) — kept para compatibilidad si algo
   * todavía lo referencia. No se usa en el JSX actual. */
  vizToggleRow: {
    flexDirection: "row",
    gap: 14,
  },
  chartCanvas: {
    /* Chart full-width — ocupa todo el ancho del chartBlock (con
     * sus padding 24 a cada lado). Pie y brick son cuadrados, así
     * que el alto sigue al ancho — chart grande y dominante en la
     * pantalla, en línea con su rol de centerpiece del portfolio. */
    alignSelf: "stretch",
  },

  /* InfoRow — kept para compatibilidad con código que pueda llamarlo,
   * pero ya no se usa en el JSX principal. */
  infoRow: {
    paddingVertical: 4,
  },
  infoEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  infoPrimary: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  infoTrailing: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  infoArrow: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ─── Mercados ──────────────────────────────────────────────────
   *
   * Bloque de los 3 buckets (AR / US / Crypto). Hairlines como
   * única división, sin cards. El sectionTitle abre la sección. */
  marketsBlock: {
    marginTop: 28,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  marketRow: {
    paddingVertical: 14,
  },
  marketRowTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  marketRowBottom: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  marketName: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  marketAmount: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.3,
  },
  marketSubtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  marketDelta: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },

  /* Link row (Rendimiento histórico) — una sola línea con label
   * izquierda + valor coloreado + chevron derecha. Sin card, sólo
   * un hairline arriba que lo separa de la sección Mercados. */
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 18,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkRowLabel: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  linkRowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkRowValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  /* Badge del glyph (Crypto / Todo) — círculo de 18 que aloja el
   * símbolo ₿ o el isotipo Alamos. Bg/fg flipean en active. */
  segBadge: {
    width: 18,
    height: 18,
    borderCurve: "continuous",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segBadgeText: {
    fontFamily: fontFamily[800],
    fontSize: 11,
    lineHeight: 13,
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
  /* Head row del card — title + count alineados horizontalmente, cuando
   * el card quiere mostrar un total al lado del título (ej: "Tus
   * posiciones · 14 activos"). Override marginBottom del cardEyebrow
   * inline cuando se usa en este wrapper. */
  cardHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  cardCount: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  /* Empty state — título grande + body + CTA pill negro. El doc lo
   * señala como activation moment, no como mensaje de error. */
  emptyTitle: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginBottom: 20,
  },
  emptyCta: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  emptyCtaText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
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

  /* Pie center — overlay con info en el donut hole. position absolute
   * sobre el SVG, centrado vertical+horizontal con el centro geometrico
   * del donut. */
  pieCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pieCenterPrimary: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    lineHeight: 18,
    maxWidth: 130,
  },
  pieCenterSecondary: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 4,
    maxWidth: 130,
    textAlign: "center",
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
  /* Caret apuntando hacia ARRIBA — el tooltip vive debajo del bloque
   * tocado. La mitad de abajo del cuadrado rotado queda oculta tras
   * el pill, dejando solo la mitad de arriba visible (forma triangular
   * apuntando al bloque). */
  tooltipCaret: {
    width: 8,
    height: 8,
    marginBottom: -4,
    transform: [{ rotate: "45deg" }],
  },
});
