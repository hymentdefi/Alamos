import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path as SvgPath,
  Polygon,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
import { CurrencySheet } from "../../../lib/components/CurrencySheet";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../../lib/components/Sparkline";
import { FlagIcon } from "../../../lib/components/FlagIcon";
import { type MarketSegmentedValue } from "../../../lib/components/MarketSegmented";
import { Tap } from "../../../lib/components/Tap";
import { AlamosRefreshControl } from "../../../lib/components/AlamosRefreshControl";
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

/* Mapping CategorySlug → mercado de origen. Se usa para el cross-
 * highlight bar ↔ chart: cuando el user agarra un segmento de la
 * allocation bar (AR/US/Crypto), atenuamos las slices del chart
 * que NO pertenezcan a ese mercado. Inversamente, cuando agarra
 * una slice del chart, identificamos su mercado y atenuamos los
 * otros segmentos de la barra. */
type MarketKey = "AR" | "US" | "CRYPTO" | "DINERO";

/** Resuelve el "market" del holding para los charts. Override del
 *  assetMarket() de la data layer: cash (category="efectivo") va a
 *  DINERO, el resto sigue la lógica normal. */
function chartMarketFor(asset: Asset): MarketKey {
  if (asset.category === "efectivo") return "DINERO";
  return assetMarket(asset) as MarketKey;
}

/** Crea un Asset sintético para representar un bucket de cash en
 *  los charts (no es una posición real, no aparece en /asset/X). */
function makeCashAsset(args: {
  ticker: string;
  name: string;
  subLabel: string;
  currency: AssetCurrency;
}): Asset {
  return {
    ticker: args.ticker,
    name: args.name,
    subLabel: args.subLabel,
    category: "efectivo",
    currency: args.currency,
    price: 0,
    change: 0,
    qty: 0,
    held: false,
  } as unknown as Asset;
}

/** Label completo del mercado para chrome del chart (centro del pie,
 *  overlays). Más expresivo que el "AR" / "US" del segmento. */
function marketLabelFull(m: MarketKey): string {
  if (m === "AR") return "Argentina";
  if (m === "US") return "Estados Unidos";
  if (m === "DINERO") return "Dinero";
  return "Crypto";
}

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c, mode } = useTheme();
  const refreshTint = mode === "dark" ? "#FFFFFF" : c.textMuted;
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  /* Sheet de selección de moneda — se abre desde la pill debajo del
   * balance. Cambiar moneda ahora es un acto deliberado: tap pill →
   * elegir card → confirma. NO hay swipe horizontal del balance. */

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

  /* ─── Dinero (cash) ─────────────────────────────────────────────
   *
   * Sintetizamos holdings de "Dinero" desde la tabla de accounts.
   * Cada moneda con saldo > 0 se convierte en una fila propia con
   * category "efectivo" — así las 4 vistas (pie/brick/ranking/treemap)
   * la agrupan en UN solo slice "Dinero" pero con 3 sub-rows en el
   * tooltip (Pesos / Dólares / USDT).
   *
   * Cash NO entra en posiciones (PositionsList) ni en mejor/peor
   * del día — sólo en los charts y en la AllocationBar como 4to
   * mercado, junto a AR / EE.UU / Crypto. */
  const cashHoldings = useMemo<Holding[]>(() => {
    const items: Holding[] = [];
    const arsAccount = accounts.find((a) => a.id === "ars-ar");
    const usdAccounts = accounts.filter((a) => a.currency === "USD");
    const usdtAccount = accounts.find((a) => a.id === "usdt-crypto");

    if (arsAccount && arsAccount.balance > 0) {
      items.push({
        asset: makeCashAsset({
          ticker: "ARS",
          name: "Pesos disponibles",
          subLabel: "ARS · Disponible para operar",
          currency: "ARS",
        }),
        native: arsAccount.balance,
        ars: arsAccount.balance,
      });
    }
    const usdTotal = usdAccounts.reduce((acc, a) => acc + a.balance, 0);
    if (usdTotal > 0) {
      items.push({
        asset: makeCashAsset({
          ticker: "USD",
          name: "Dólares disponibles",
          subLabel: "USD · Disponible para operar",
          currency: "USD",
        }),
        native: usdTotal,
        ars: convertAmount(usdTotal, "USD", "ARS"),
      });
    }
    if (usdtAccount && usdtAccount.balance > 0) {
      items.push({
        asset: makeCashAsset({
          ticker: "USDT",
          name: "USDT disponible",
          subLabel: "USDT · Disponible para operar",
          currency: "USDT",
        }),
        native: usdtAccount.balance,
        ars: convertAmount(usdtAccount.balance, "USDT", "ARS"),
      });
    }
    return items;
  }, []);

  /* Combo holdings + cash para los charts. Las posiciones de la
   * lista, los movers y el rendimiento siguen usando holdingsSorted
   * (sin cash) — Dinero NO es una posición. */
  const holdingsForCharts = useMemo<Holding[]>(
    () => [...holdingsSorted, ...cashHoldings],
    [holdingsSorted, cashHoldings],
  );
  const totalArsWithCash = useMemo(
    () => holdingsForCharts.reduce((acc, h) => acc + h.ars, 0),
    [holdingsForCharts],
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
    let cash = 0;
    for (const h of holdingsForCharts) {
      const m = chartMarketFor(h.asset);
      if (m === "AR") ar += h.ars;
      else if (m === "US") us += h.ars;
      else if (m === "CRYPTO") crypto += h.ars;
      else if (m === "DINERO") cash += h.ars;
    }
    const total = ar + us + crypto + cash;
    return {
      arPct: total > 0 ? (ar / total) * 100 : 0,
      usPct: total > 0 ? (us / total) * 100 : 0,
      cryptoPct: total > 0 ? (crypto / total) * 100 : 0,
      cashPct: total > 0 ? (cash / total) * 100 : 0,
      categoriesCount: groupedByCategory.length,
    };
  }, [holdingsForCharts, groupedByCategory]);

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

  // Holding del ladrillo — mientras finger está apoyado, el ScrollView
  // se bloquea (scrollEnabled=false) para que el dedo no scrollee
  // accidentalmente mientras el usuario explora la distribución.
  const [brickHolding, setBrickHolding] = useState(false);
  // Visualización seleccionada — treemap por default, primera opción
  // del segmented. El usuario alterna entre Treemap / Ladrillo / Pie /
  // Ranking (poll bars).
  const [viz, setViz] = useState<"pie" | "brick" | "ranking" | "treemap">(
    "treemap",
  );

  /* Cross-highlight bar ↔ chart. Mantiene QUÉ mercado está
   * "highlighted" actualmente — puede venir de:
   *   - Hold sobre un segmento de la allocation bar (AR/US/Crypto)
   *   - Hold sobre una slice del chart (su categoría → market)
   * Cuando !== null, el chart atenúa las slices que NO son de
   * ese mercado, y la barra atenúa los OTROS segmentos. */
  const [highlightedMarket, setHighlightedMarket] = useState<
    MarketKey | null
  >(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      setRefreshing(false);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }, 900);
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

  /* ─── Display values en moneda actual ─── */

  const totalDisplay =
    currency === "ARS" ? totalArs : convertAmount(totalArs, "ARS", currency);
  const daySumDisplay =
    currency === "ARS" ? daySumArs : convertAmount(daySumArs, "ARS", currency);

  const hasHoldings = holdingsSorted.length > 0 && totalArs > 0;

  /* ─── Hero number ticker ──────────────────────────────────────────
   *
   * Animamos el monto del hero AL MONTAR la pantalla — sube de 0
   * al target en ~700ms con ease-out cubic. JS-side rAF (AmountDisplay
   * no acepta SharedValue como prop), animamos un PROGRESS 0→1 que
   * multiplica los montos de todas las monedas del pager para que se
   * animen juntas.
   *
   * El "subtle wow" de Robinhood al abrir un screen viene de
   * detalles como este — el ojo registra el movimiento aunque no
   * lo procese conscientemente, y la pantalla "se siente viva". */
  const [tickerProgress, setTickerProgress] = useState(0);
  const tickerRafRef = useRef<number | null>(null);
  useEffect(() => {
    const start = Date.now();
    const duration = 700;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setTickerProgress(eased);
      if (t < 1) {
        tickerRafRef.current = requestAnimationFrame(tick);
      } else {
        tickerRafRef.current = null;
      }
    };
    tickerRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (tickerRafRef.current != null) {
        cancelAnimationFrame(tickerRafRef.current);
        tickerRafRef.current = null;
      }
    };
    /* Sólo al montar — no re-animamos en cada cambio de currency
     *  (el swipe del pager ya tiene su propia animación nativa). */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              {dayUp ? "▲" : "▼"} {fmtPctAbs(dayPct)}
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
            <AlamosRefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={refreshTint}
              progressViewOffset={8}
            />
          }
        >
          {/* ─── Hero scrollable ─── */}
          <View style={s.heroBlock}>
            <Text style={[s.heroTitle, { color: c.text }]}>Portfolio</Text>

          <View style={s.heroPagerRow}>
            <AmountDisplay
              value={totalDisplay * tickerProgress}
              size={42}
              currency={currency}
            />
          </View>

          {/* CurrencyPill — pill chiquito ARS/USD que abre el sheet
              para cambiar la moneda. Cambio deliberado: no hay swipe
              horizontal del balance. El sheet aclara que es la misma
              cartera, sólo distinta valuación. */}
          <View style={s.currencyPillRow}>
            <Tap
              haptic="selection"
              pressScale={0.96}
              onPress={() => setCurrencyOpen(true)}
              style={[
                s.currencyPill,
                {
                  backgroundColor: c.surfaceHover,
                },
              ]}
            >
              <Text
                style={[s.currencyPillCode, { color: c.text }]}
              >
                {currency}
              </Text>
              <Feather
                name="chevron-down"
                size={12}
                color={c.textMuted}
              />
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
              ({fmtPctAbs(dayPct)})
            </Text>
            <Text style={[s.deltaText, { color: c.textMuted }]}>hoy</Text>
          </View>

          {/* Selector de viz — debajo del hero, alineado a la derecha.
           *  Orden: Treemap / Ladrillo / Pie / Ranking (poll bars). */}
          {hasHoldings ? (
            <View style={s.heroSelectorRow}>
              <View
                style={[s.vizSeg, { backgroundColor: c.surfaceHover }]}
              >
                <Tap
                  onPress={() => setViz("treemap")}
                  haptic="selection"
                  pressScale={0.95}
                  hitSlop={4}
                  style={[
                    s.vizSegBtn,
                    viz === "treemap" && { backgroundColor: c.bg },
                  ]}
                  accessibilityLabel="Vista de treemap"
                >
                  <TreemapGlyph
                    color={viz === "treemap" ? c.text : c.textMuted}
                    size={16}
                  />
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
                  accessibilityLabel="Vista de ladrillo"
                >
                  <BrickGlyph
                    color={viz === "brick" ? c.text : c.textMuted}
                    size={16}
                  />
                </Tap>
                <Tap
                  onPress={() => setViz("pie")}
                  haptic="selection"
                  pressScale={0.95}
                  hitSlop={4}
                  style={[
                    s.vizSegBtn,
                    viz === "pie" && { backgroundColor: c.bg },
                  ]}
                  accessibilityLabel="Vista de torta"
                >
                  <PieGlyph
                    color={viz === "pie" ? c.text : c.textMuted}
                    size={16}
                  />
                </Tap>
                <Tap
                  onPress={() => setViz("ranking")}
                  haptic="selection"
                  pressScale={0.95}
                  hitSlop={4}
                  style={[
                    s.vizSegBtn,
                    viz === "ranking" && { backgroundColor: c.bg },
                  ]}
                  accessibilityLabel="Vista de ranking"
                >
                  <RankingGlyph
                    color={viz === "ranking" ? c.text : c.textMuted}
                    size={16}
                  />
                </Tap>
              </View>
            </View>
          ) : null}

          </View>

          {/* ─── Chart pie / brick — sin selector adentro. */}
          {hasHoldings ? (
            <View style={s.chartBlock}>
              <View style={s.chartCanvas}>
                {viz === "pie" ? (
                  <FloorPie
                    holdings={holdingsForCharts}
                    totalArs={totalArsWithCash}
                    currency={currency}
                    groupBy="category"
                    dayPct={dayPct}
                    dayUp={dayUp}
                    onHoldChange={setBrickHolding}
                    dimMarket={highlightedMarket}
                    onActiveMarketChange={setHighlightedMarket}
                  />
                ) : viz === "brick" ? (
                  <FloorBrick
                    holdings={holdingsForCharts}
                    totalArs={totalArsWithCash}
                    groupBy="category"
                    onHoldChange={setBrickHolding}
                    dimMarket={highlightedMarket}
                    onActiveMarketChange={setHighlightedMarket}
                  />
                ) : viz === "ranking" ? (
                  <RankingList
                    holdings={holdingsForCharts}
                    totalArs={totalArsWithCash}
                    onHoldChange={setBrickHolding}
                    dimMarket={highlightedMarket}
                    onActiveMarketChange={setHighlightedMarket}
                  />
                ) : (
                  <Treemap
                    holdings={holdingsForCharts}
                    totalArs={totalArsWithCash}
                    onHoldChange={setBrickHolding}
                    dimMarket={highlightedMarket}
                    onActiveMarketChange={setHighlightedMarket}
                  />
                )}
              </View>
            </View>
          ) : null}

          {/* ─── Allocation stacked bar — INTERACTIVA. Cada
              segmento es un Pressable que en hold setea el
              highlightedMarket (cross-highlight con el chart).
              Cuando hay un mercado highlighted, los segmentos que
              NO son ése bajan a opacity 0.25; los labels también. */}
          {hasHoldings ? (
            <AllocationBar
              alloc={marketAllocation}
              highlightedMarket={highlightedMarket}
              onHighlight={setHighlightedMarket}
              c={c}
            />
          ) : null}

          {/* ─── Rendimiento — link al detalle. Heading "álamos-style"
              (mismo treatment que Briefing del stock detail): título
              22/800 + arrow-right pegado, todo en color tone (brand
              cuando up, red cuando down). Valor del día al costado. */}
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
              <View style={s.alamosHeadingRow}>
                <Text style={[s.linkRowHeading, { color }]}>
                  Rendimiento
                </Text>
                <Feather name="arrow-right" size={16} color={color} />
              </View>
              <View style={s.linkRowValueStack}>
                <Text style={[s.linkRowValue, { color }]}>
                  ▲ {fmtPctAbs(12.4)}
                </Text>
                <Text style={[s.linkRowValueSub, { color: c.textMuted }]}>
                  hoy
                </Text>
              </View>
            </Pressable>
          ) : null}

          {/* ─── Mercados — los 3 buckets de Álamos. Detalle por
              mercado: monto + delta + posiciones + cash. Heading
              alamos-style, mismo peso visual que "Posiciones". */}
          {hasHoldings ? (
            <View style={s.marketsBlock}>
              <Text style={[s.alamosHeadingText, s.marketsHeading, { color: c.text }]}>
                Mercados
              </Text>
              <MarketRow
                label="Argentina"
                marketKey="AR"
                bucket={marketBreakdown.AR}
                c={c}
              />
              <MarketRow
                label="Estados Unidos"
                marketKey="US"
                bucket={marketBreakdown.US}
                c={c}
                divider
              />
              <MarketRow
                label="Crypto"
                marketKey="CRYPTO"
                bucket={marketBreakdown.CRYPTO}
                c={c}
                divider
              />
            </View>
          ) : null}

          {hasHoldings ? (
            <PositionsList
              holdings={holdingsSorted}
              currency={currency}
              onTap={(ticker) =>
                router.push({
                  pathname: "/(app)/detail",
                  params: { ticker },
                })
              }
              onSeeAll={() =>
                router.push("/(app)/posiciones" as never)
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

          {/* ─── Movers del día — 2 cards Robinhood-style al fondo
              de la pantalla. Cada card: eyebrow caps + ticker bold +
              mini-sparkline + delta grande, fondo surfaceHover. Tap
              navega al detail del asset. */}
          {hasHoldings && bestOfDay && worstOfDay ? (
            <View style={s.moversBlock}>
              <MoverCard
                variant="best"
                eyebrow="Mejor del día"
                asset={bestOfDay.asset}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/detail",
                    params: { ticker: bestOfDay.asset.ticker },
                  })
                }
                c={c}
              />
              <MoverCard
                variant="worst"
                eyebrow="Peor del día"
                asset={worstOfDay.asset}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/detail",
                    params: { ticker: worstOfDay.asset.ticker },
                  })
                }
                c={c}
              />
            </View>
          ) : null}
        </Animated.ScrollView>

        <CurrencySheet
          visible={currencyOpen}
          onClose={() => setCurrencyOpen(false)}
          selected={currency}
          totalArs={totalArs}
          onSelect={(cur) => setCurrency(cur)}
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

/* Helper: % en abs sin signo +/-. La dirección la comunica el ▲/▼
 * que va antes del valor. La pantalla del portfolio nunca muestra
 * signos +/-, sólo flechitas. */
function fmtPctAbs(n: number): string {
  return `${Math.abs(n).toFixed(2).replace(".", ",")}%`;
}

function MarketRow({
  label,
  marketKey,
  bucket,
  c,
  divider,
}: {
  label: string;
  marketKey: "AR" | "US" | "CRYPTO";
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
      {/* Icono del mercado a la izquierda — Argentina/US flag o
       *  símbolo Crypto. Le da identidad visual a cada bucket. */}
      <View style={s.marketIcon}>
        <MarketFlag marketKey={marketKey} size={40} />
      </View>

      <View style={s.marketContent}>
        <View style={s.marketRowTop}>
          <Text
            style={[s.marketName, { color: c.text }]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            style={[
              s.marketAmount,
              { color: empty ? c.textMuted : c.text },
            ]}
            numberOfLines={1}
          >
            {empty ? "—" : investedDisplay}
          </Text>
        </View>
        <View style={s.marketRowBottom}>
          {/* Solo el delta a la derecha — sin subtitle de positions
           *  count + cash. La data secundaria vive en /(app)/market-
           *  category cuando el user drilla. Más calmo. */}
          {!empty ? (
            <Text
              style={[s.marketDelta, { color: deltaColor }]}
              numberOfLines={1}
            >
              {dayUp ? "▲" : "▼"} {fmtPctAbs(dayPct)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/* ─── MarketFlag — bandera real en círculo, variantes con punch.
 *
 * Volvemos a banderas literales (no glyphs abstractos), pero en
 * variantes históricas/bold con colores fuertes para que NO se vean
 * iguales a la bandera genérica que usan todas las apps.
 *
 *   AR     → Tribar celeste/blanco/celeste con celeste FUERTE
 *            (#3F8CC9 vs el #74ACDF estándar) y el Sol de Mayo
 *            grande, dorado vibrante con 16 rayos rectos. Visualmente
 *            "Argentina" sin lugar a dudas pero más rica.
 *   US     → Variante Betsy Ross — stripes rojo/blanco igual pero
 *            con 13 estrellas en círculo en el canton (la bandera
 *            histórica de 1777). Old Glory red bold + true navy.
 *   CRYPTO → Bandera de Bitcoin: campo full Bitcoin orange (#F7931A)
 *            con ₿ blanco grande tilteado 14° (la ₿ "oficial" del
 *            logo de Bitcoin que va inclinada).
 *
 * Forma circular (no squircle) — coherente con el patrón de FlagIcon
 * y con cómo Robinhood/Coinbase muestran países y assets. */
function MarketFlag({
  marketKey,
  size = 40,
}: {
  marketKey: "AR" | "US" | "CRYPTO";
  size?: number;
}) {
  if (marketKey === "AR") {
    return <ArgentinaBoldFlag size={size} />;
  }
  if (marketKey === "US") {
    return <BetsyRossFlag size={size} />;
  }
  return <BitcoinFlag size={size} />;
}

/** Bandera AR — celeste profundo + Sol de Mayo CHICO al centro
 *  (rayos cortos, disco compacto). El sol acompaña, no domina. */
function ArgentinaBoldFlag({ size }: { size: number }) {
  const CELESTE = "#3F8CC9";
  const WHITE = "#FFFFFF";
  const SUN_RAY = "#F4B400";
  const SUN_DISC = "#FFC72C";
  return (
    <View
      style={[
        s.flagCircle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Defs>
          <ClipPath id="arBoldClip">
            <Circle cx={20} cy={20} r={20} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#arBoldClip)">
          {/* Bandas — 12 / 16 / 12 (banda blanca un poco más ancha
              para que el sol respire). */}
          <Rect x={0} y={0} width={40} height={12} fill={CELESTE} />
          <Rect x={0} y={12} width={40} height={16} fill={WHITE} />
          <Rect x={0} y={28} width={40} height={12} fill={CELESTE} />

          {/* Sol de Mayo compacto — 16 rayos cortos (de y=15 a y=18,
              triángulos angostos) + disco r=2.4. Total radius ~5,
              chico y centrado dentro de la banda blanca. */}
          {Array.from({ length: 16 }).map((_, i) => {
            const deg = (i * 360) / 16;
            return (
              <Polygon
                key={i}
                points="20,15 20.55,18 19.45,18"
                fill={SUN_RAY}
                transform={`rotate(${deg} 20 20)`}
              />
            );
          })}
          <Circle cx={20} cy={20} r={2.4} fill={SUN_DISC} />
        </G>
        {/* Borde sutil para definir el círculo sobre fondos claros */}
        <Circle
          cx={20}
          cy={20}
          r={19.7}
          fill="none"
          stroke="rgba(0,0,0,0.10)"
          strokeWidth={0.6}
        />
      </Svg>
    </View>
  );
}

/** Bandera US estándar — 13 stripes rojo/blanco + canton navy con
 *  estrellas distribuidas en grilla alternada (Old Glory style),
 *  no en círculo. Cromática bold: Old Glory red + true navy. */
function BetsyRossFlag({ size }: { size: number }) {
  const RED = "#BF0A30";
  const WHITE = "#FFFFFF";
  const NAVY = "#002868";
  const stripeH = 40 / 13;
  const cantonW = 40 * 0.4;
  const cantonH = stripeH * 7;
  // Grilla alternada de estrellas — 5 filas / 4-3-4-3-4 estrellas,
  // simulando el pattern de Old Glory (que en el original son 9
  // filas alternadas de 6 y 5 estrellas). Acá compactado para 40 px.
  const cols = [4, 3, 4, 3, 4];
  const rows = cols.length;
  const rowGap = cantonH / (rows + 1);
  const stars: { cx: number; cy: number }[] = [];
  cols.forEach((count, rowIdx) => {
    const colGap = cantonW / (count + 1);
    for (let i = 0; i < count; i++) {
      stars.push({
        cx: colGap * (i + 1),
        cy: rowGap * (rowIdx + 1),
      });
    }
  });
  return (
    <View
      style={[
        s.flagCircle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Defs>
          <ClipPath id="usFlagClip">
            <Circle cx={20} cy={20} r={20} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#usFlagClip)">
          <Rect x={0} y={0} width={40} height={40} fill={WHITE} />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <Rect
              key={i}
              x={0}
              y={i * stripeH}
              width={40}
              height={stripeH}
              fill={RED}
            />
          ))}
          <Rect x={0} y={0} width={cantonW} height={cantonH} fill={NAVY} />
          {/* Estrellas como puntos blancos distribuidos en grilla
              alternada — a 40 px los polígonos de 5 puntas no leen,
              los círculos sí. La distribución (4-3-4-3-4) replica
              el feel del Old Glory. */}
          {stars.map((p, i) => (
            <Circle key={i} cx={p.cx} cy={p.cy} r={0.7} fill={WHITE} />
          ))}
        </G>
        <Circle
          cx={20}
          cy={20}
          r={19.7}
          fill="none"
          stroke="rgba(0,0,0,0.10)"
          strokeWidth={0.6}
        />
      </Svg>
    </View>
  );
}

/** Bandera Crypto — campo full brand verde de Álamos con ₿ blanco
 *  grande tilteado 14° (mismo lenguaje que el logo de Bitcoin pero
 *  en la cromática de la app, no naranja). */
function BitcoinFlag({ size }: { size: number }) {
  const ALAMOS_GREEN = "#00C805";
  return (
    <View
      style={[
        s.flagCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ALAMOS_GREEN,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fontFamily[800],
          fontSize: size * 0.62,
          color: "#FFFFFF",
          letterSpacing: -0.5,
          marginTop: -size * 0.04,
          transform: [{ rotate: "-14deg" }],
        }}
      >
        ₿
      </Text>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: size / 2,
          borderWidth: 0.6,
          borderColor: "rgba(0,0,0,0.10)",
        }}
      />
    </View>
  );
}

/* ─── AllocationBar — barra stacked AR/US/Crypto con cross-highlight.
 *
 * Cada segmento es un Pressable con onPressIn/onPressOut que setea
 * `highlightedMarket` en el padre. El padre lo usa para atenuar:
 *   - los segmentos NO highlighted en la barra (acá mismo)
 *   - las slices del chart que no pertenecen al mercado (en
 *     FloorPie / FloorBrick via prop dimMarket)
 *
 * onLongPress haptic medium para confirmar el "hold mode". El
 * tap simple también highlightea brevemente. */

function AllocationBar({
  alloc,
  highlightedMarket,
  onHighlight,
  c,
}: {
  alloc: {
    arPct: number;
    usPct: number;
    cryptoPct: number;
    cashPct: number;
    categoriesCount: number;
  };
  highlightedMarket: MarketKey | null;
  onHighlight: (m: MarketKey | null) => void;
  c: ColorMap;
}) {
  const segments: Array<{ key: MarketKey; pct: number; label: string }> = [
    { key: "AR", pct: alloc.arPct, label: "AR" },
    { key: "US", pct: alloc.usPct, label: "EE.UU." },
    { key: "CRYPTO", pct: alloc.cryptoPct, label: "Crypto" },
    { key: "DINERO", pct: alloc.cashPct, label: "Dinero" },
  ].filter((s) => s.pct > 0) as Array<{
    key: MarketKey;
    pct: number;
    label: string;
  }>;

  /* Espejo del highlightedMarket en un sharedValue — los segmentos
   * lo leen desde useAnimatedStyle para animarse en el UI thread con
   * spring (sin re-render por frame). */
  const activeKey = useSharedValue<MarketKey | null>(highlightedMarket);
  useEffect(() => {
    activeKey.value = highlightedMarket;
  }, [highlightedMarket, activeKey]);

  return (
    <View style={[s.allocBlock, s.allocBlockStandalone]}>
      <View style={[s.allocBar, { backgroundColor: c.surfaceHover }]}>
        {segments.map((seg, i) => (
          <AllocBarSegment
            key={seg.key}
            segKey={seg.key}
            pct={seg.pct}
            marginLeft={i > 0 ? 2 : 0}
            activeKey={activeKey}
            c={c}
            onPressIn={() => {
              Haptics.selectionAsync().catch(() => {});
              onHighlight(seg.key);
            }}
            onPressOut={() => onHighlight(null)}
          />
        ))}
      </View>
      <View style={s.allocCaptionRow}>
        {segments.map((seg, i) => (
          <AllocCaption
            key={seg.key}
            segKey={seg.key}
            pct={seg.pct}
            label={seg.label}
            marginLeft={i > 0 ? 2 : 0}
            activeKey={activeKey}
            c={c}
            onPressIn={() => {
              Haptics.selectionAsync().catch(() => {});
              onHighlight(seg.key);
            }}
            onPressOut={() => onHighlight(null)}
          />
        ))}
      </View>
    </View>
  );
}

/* Spring base para la animación bar/caption — elastic, snappy, con
 * un toque de overshoot que da el "pop" cuando el segmento agarra
 * foco. Mismos params para los dos elementos así viajan en sync. */
const ALLOC_SPRING = {
  damping: 13,
  stiffness: 220,
  mass: 0.55,
  overshootClamping: false,
} as const;

/* ─── AllocBarSegment — un slot individual de la AllocationBar.
 *
 * Cuando el segmento está highlighted, se "infla" verticalmente
 * (scaleY 2.7) y se levanta apenas (translateY -2) — efecto de
 * "salir de la barra". El resto de los segmentos baja a opacity 0.18
 * y el track underneath revela su color sunken como contraste.
 * Toda la animación corre en spring sobre el UI thread vía
 * useAnimatedStyle. */
function AllocBarSegment({
  segKey,
  pct,
  marginLeft,
  activeKey,
  c,
  onPressIn,
  onPressOut,
}: {
  segKey: MarketKey;
  pct: number;
  marginLeft: number;
  activeKey: SharedValue<MarketKey | null>;
  c: ColorMap;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const isActive = activeKey.value === segKey;
    const hasActive = activeKey.value !== null;
    return {
      opacity: withTiming(hasActive && !isActive ? 0.18 : 1, {
        duration: 160,
      }),
      transform: [
        { translateY: withSpring(isActive ? -2 : 0, ALLOC_SPRING) },
        { scaleY: withSpring(isActive ? 2.7 : 1, ALLOC_SPRING) },
      ],
    };
  });

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={{ flex: pct, marginLeft }}
    >
      <Animated.View
        style={[
          {
            height: 6,
            width: "100%",
            backgroundColor: c.brand,
            borderCurve: "continuous",
            borderRadius: 3,
          },
          animStyle,
        ]}
      />
    </Pressable>
  );
}

/* ─── AllocCaption — el "X% Label" debajo de cada segmento.
 *
 * En highlight, scalea 1.1 y el "%" se vuelve text (full color)
 * para subir aún más el peso visual. Los inactivos bajan a opacity
 * 0.32. */
function AllocCaption({
  segKey,
  pct,
  label,
  marginLeft,
  activeKey,
  c,
  onPressIn,
  onPressOut,
}: {
  segKey: MarketKey;
  pct: number;
  label: string;
  marginLeft: number;
  activeKey: SharedValue<MarketKey | null>;
  c: ColorMap;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const isActive = activeKey.value === segKey;
    const hasActive = activeKey.value !== null;
    return {
      opacity: withTiming(hasActive && !isActive ? 0.32 : 1, {
        duration: 160,
      }),
      transform: [
        { scale: withSpring(isActive ? 1.1 : 1, ALLOC_SPRING) },
      ],
    };
  });

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={{ flex: pct, marginLeft }}
    >
      <Animated.View style={animStyle}>
        <Text style={s.allocCaption} numberOfLines={1}>
          <Text style={{ color: c.brand }}>{pct.toFixed(0)}%</Text>
          <Text style={{ color: c.text }}> {label}</Text>
        </Text>
      </Animated.View>
    </Pressable>
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

function RankingGlyph({
  color,
  size = 18,
}: {
  color: string;
  size?: number;
}) {
  // 3 horizontal bars, descending width — el clásico ranking icon.
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <SvgPath
        d="M 3 5 H 14 M 3 9 H 11 M 3 13 H 7"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function TreemapGlyph({
  color,
  size = 18,
}: {
  color: string;
  size?: number;
}) {
  // Outer rect + 2 internal divisions — treemap mini.
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <SvgPath
        d="M 3 3 H 15 V 15 H 3 Z M 3 9 H 15 M 9 3 V 9 M 11 9 V 15"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
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

/* ─── PositionsList — lista plana de holdings individuales ─────────
 *
 * Robinhood-style: sin card, sin border, sin chevrons, sin swatches,
 * sin agrupar por categoría. Cada row es una posición individual
 * ordenada por valor (ARS) descendente, con ticker bold + nombre
 * muted a la izquierda + valor + delta del día a la derecha.
 * Hairline divider entre rows. Tap → /(app)/detail del ticker. */

function PositionsList({
  holdings,
  currency,
  onTap,
  onSeeAll,
  c,
}: {
  holdings: Holding[];
  currency: Currency;
  onTap: (ticker: string) => void;
  /** Tap en el chevron verde al lado del título "Posiciones" → abre
   *  la pantalla dedicada con las posiciones agrupadas por categoría. */
  onSeeAll?: () => void;
  c: ColorMap;
}) {
  return (
    <View style={s.positionsBlock}>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          style={({ pressed }) => [
            s.positionsHead,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[s.alamosHeadingText, { color: c.text }]}>
            Posiciones
          </Text>
          <Feather name="arrow-right" size={18} color={c.brand} />
        </Pressable>
      ) : (
        <Text style={[s.alamosHeadingText, { color: c.text }]}>
          Posiciones
        </Text>
      )}
      {holdings.map((h, i) => {
        const displayValue =
          currency === "ARS"
            ? h.ars
            : convertAmount(h.ars, "ARS", currency);
        const dayUp = h.asset.change >= 0;
        const deltaColor = dayUp ? c.brand : c.red;
        // Crypto siempre cotiza contra USDT — limpiamos el "/USDT"
        // del display ticker. ETH/USDT → ETH. Los pares perpetuos
        // ".P" se mantienen porque distinguen del spot.
        const cleanTicker = shortCryptoTicker(h.asset.ticker);
        // Sparkline determinística — usa el ticker como seed y el
        // signo del change como tendencia. Da consistencia visual
        // entre renders y empata con el delta del día (verde sube,
        // rojo baja).
        const spark = seriesFromSeed(
          h.asset.ticker,
          40,
          dayUp ? "up" : "down",
        );
        return (
          <Pressable
            key={h.asset.ticker}
            onPress={() => onTap(h.asset.ticker)}
            style={({ pressed }) => [
              s.positionRow,
              i > 0 && {
                borderTopColor: c.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <View style={s.positionLeft}>
              <Text
                style={[s.positionTicker, { color: c.text }]}
                numberOfLines={1}
              >
                {cleanTicker}
              </Text>
              <Text
                style={[s.positionName, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {h.asset.name}
              </Text>
            </View>
            <View style={s.positionSpark}>
              <MiniSparkline
                series={spark}
                color={deltaColor}
                width={56}
                height={22}
                strokeWidth={1.6}
              />
            </View>
            <View style={s.positionRight}>
              <Text
                style={[s.positionValue, { color: c.text }]}
                numberOfLines={1}
              >
                {formatMoney(displayValue, currency)}
              </Text>
              <Text
                style={[s.positionDelta, { color: deltaColor }]}
                numberOfLines={1}
              >
                {dayUp ? "▲" : "▼"} {fmtPctAbs(h.asset.change)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── MoverCard — Mejor / Peor del día como cards Robinhood-style ─
 *
 * Cada card vive en una grilla de 2 columnas al fondo del portfolio.
 * Layout (top → bottom):
 *   - Eyebrow caps muted ("MEJOR DEL DÍA")
 *   - Ticker bold + nombre muted (1 línea)
 *   - Mini-sparkline (color brand/red, ocupa el ancho)
 *   - Delta grande con triángulo + %, cromado por el cambio del día.
 * Tap → /(app)/detail. Bg c.surface con borde sutil c.border. */

function MoverCard({
  variant,
  eyebrow,
  asset,
  onPress,
  c,
}: {
  /** "best" → eyebrow + delta en verde brand. "worst" → naranja red.
   *  Los 2 colores cromáticos de Álamos, mismo lenguaje que el resto
   *  de la app (subir/bajar). */
  variant: "best" | "worst";
  eyebrow: string;
  asset: Asset;
  onPress: () => void;
  c: ColorMap;
}) {
  const up = asset.change >= 0;
  // El cromado del eyebrow va por VARIANT, no por dirección del día —
  // el "Mejor del día" siempre verde, el "Peor del día" siempre naranja.
  const eyebrowTone = variant === "best" ? c.brand : c.red;
  // El delta sigue por dirección real, igual que en el resto del app.
  const deltaTone = up ? c.brand : c.red;
  const cleanTicker = shortCryptoTicker(asset.ticker);
  const spark = useMemo(
    () => seriesFromSeed(asset.ticker, 40, up ? "up" : "down"),
    [asset.ticker, up],
  );
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.moverCard,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      {/* Eyebrow display — misma fuente / sizing que el "Briefing"
          del stock detail (fontFamily[800], display weight). */}
      <Text style={[s.moverCardEyebrow, { color: eyebrowTone }]}>
        {eyebrow}
      </Text>
      <View style={s.moverCardHead}>
        <Text
          style={[s.moverCardTicker, { color: c.text }]}
          numberOfLines={1}
        >
          {cleanTicker}
        </Text>
        <Text
          style={[s.moverCardName, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {asset.name}
        </Text>
      </View>
      <View style={s.moverCardSpark}>
        <MiniSparkline
          series={spark}
          color={deltaTone}
          width={120}
          height={28}
          strokeWidth={1.6}
        />
      </View>
      <Text style={[s.moverCardDelta, { color: deltaTone }]}>
        {up ? "▲" : "▼"} {fmtPctAbs(asset.change)}
      </Text>
    </Pressable>
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
  /** % de variación del día del portfolio entero — se muestra en el
   *  centro del donut como ▲/▼ pct%. */
  dayPct: number;
  dayUp: boolean;
  onHoldChange?: (holding: boolean) => void;
  /** Cuando !== null, las slices que NO sean de ese mercado se
   *  rendean a opacity 0.25. Driver: el cross-highlight de la
   *  allocation bar — cuando el user agarra "AR" en la barra,
   *  acá atenuamos US y CRYPTO. */
  dimMarket?: MarketKey | null;
  /** Cross-highlight inverso (chart → barra) — emite el mercado
   *  de la slice activa o null al soltar. El padre lo usa para
   *  setear highlightedMarket y que la barra de arriba espeje. */
  onActiveMarketChange?: (m: MarketKey | null) => void;
}

function FloorPie({
  holdings,
  totalArs,
  currency,
  groupBy,
  dayPct,
  dayUp,
  onHoldChange,
  dimMarket,
  onActiveMarketChange,
}: FloorPieProps) {
  const { c } = useTheme();
  const [containerW, setContainerW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  /* Altura medida del tooltip — la usamos para translateY(-tooltipH)
   * y dejarlo flotando ARRIBA del slice tocado (encima del dedo). */
  const [tooltipH, setTooltipH] = useState(0);

  // Geometría del viewBox — más ancho (240) y alto (200) que la versión
  // previa para hospedar los outer labels (%s alrededor del donut, con
  // leader lines radiales). Donut centrado en (120, 100), outer 70 /
  // inner 44 (grosor 26). Slices flat, "cortadas" por el bg color.
  const W = 240;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2;
  const outerR = 70;
  const innerR = 44;
  /* Distancia (en viewBox units) desde el outer edge hasta el final
   * de la leader line. El % va un poco más afuera. */
  const LEADER_OUT = 8;
  const LABEL_OUT = 14;

  type Row = {
    ticker: string;
    shortTicker: string;
    change: number;
    ars: number;
    native: number;
    currency: AssetCurrency;
  };

  const slices = useMemo(() => {
    const byKey = new Map<
      string,
      {
        ars: number;
        rows: Row[];
        cat: AssetCategory;
        name: string;
        market: MarketKey;
      }
    >();
    for (const h of holdings) {
      const key = groupBy === "ticker" ? h.asset.ticker : h.asset.category;
      const entry = byKey.get(key) ?? {
        ars: 0,
        rows: [],
        cat: h.asset.category,
        name: h.asset.name,
        market: chartMarketFor(h.asset),
      };
      entry.ars += h.ars;
      entry.rows.push({
        ticker: h.asset.ticker,
        shortTicker: shortCryptoTicker(h.asset.ticker),
        change: h.asset.change,
        ars: h.ars,
        native: h.native,
        currency: assetCurrency(h.asset),
      });
      byKey.set(key, entry);
    }
    const sorted = Array.from(byKey.entries())
      .map(([key, { ars, rows, cat, name, market }]) => ({
        key,
        cat,
        market,
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
      onActiveMarketChange?.(
        next != null ? slicesRef.current[next].market : null,
      );
      if (next !== null) Haptics.selectionAsync().catch(() => {});
    },
    [onActiveMarketChange],
  );

  const activeSlice =
    activeIdx !== null ? slices[activeIdx] ?? null : null;
  const dimmedFill = c.surfaceSunken;

  // Cuando el user holdea un mercado en la AllocationBar (dimMarket
  // != null), reemplazamos el texto del centro por el % agregado del
  // mercado + su label. La info "balance + Distribución" cede a la
  // que está en foco — así el chart "responde" al hold de la barra.
  const dimMarketPct = useMemo(() => {
    if (dimMarket == null) return null;
    return slices
      .filter((sl) => sl.market === dimMarket)
      .reduce((acc, sl) => acc + sl.pct, 0);
  }, [dimMarket, slices]);

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
          {/* Slices del donut — flat con bordes marcados. Cada slice
           *  lleva un stroke de c.text (almost-ink en light, almost-
           *  white en dark) de 1.2 pt que perfila tanto los radios
           *  entre slices como los arcos outer/inner. Da un acabado
           *  más constructivo/handcrafted que el "gap por bg color".
           *
           *  Dimming de 2 fuentes:
           *   - activeIdx: el slice activo del propio touch del pie.
           *   - dimMarket: el mercado highlighted desde la barra
           *     (cross-highlight). Si la slice no es de ese mercado
           *     se atenúa también. */}
          {slices.map((slice, i) => {
            const dimmedByActive =
              activeIdx !== null && activeIdx !== i;
            const dimmedByMarket =
              dimMarket != null && slice.market !== dimMarket;
            const dimmed = dimmedByActive || dimmedByMarket;
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
                stroke={c.text}
                strokeWidth={1.2}
                strokeLinejoin="round"
              />
            );
          })}

          {/* Outer labels — % de cada slice afuera del ring, conectado
           *  con una leader line radial corta. Las labels de slices
           *  dimmed bajan a opacity 0.25 para que sigan la atenuación
           *  del slice correspondiente. Slices muy chicos (< 2%) ocultan
           *  la label para evitar overlap visual. */}
          {slices.map((slice, i) => {
            if (slice.pct < 2) return null;
            const dimmedByActive =
              activeIdx !== null && activeIdx !== i;
            const dimmedByMarket =
              dimMarket != null && slice.market !== dimMarket;
            const dimmed = dimmedByActive || dimmedByMarket;
            const mid = (slice.startAngle + slice.endAngle) / 2;
            const cosMid = Math.cos(mid);
            const sinMid = Math.sin(mid);
            const innerX = cx + (outerR + 1) * cosMid;
            const innerY = cy + (outerR + 1) * sinMid;
            const outerX = cx + (outerR + LEADER_OUT) * cosMid;
            const outerY = cy + (outerR + LEADER_OUT) * sinMid;
            const labelX = cx + (outerR + LABEL_OUT) * cosMid;
            const labelY = cy + (outerR + LABEL_OUT) * sinMid;
            const anchor =
              cosMid > 0.15 ? "start" : cosMid < -0.15 ? "end" : "middle";
            const opacity = dimmed ? 0.25 : 1;
            return (
              <G key={`olabel-${slice.key}`} opacity={opacity}>
                <Line
                  x1={innerX}
                  y1={innerY}
                  x2={outerX}
                  y2={outerY}
                  stroke={c.text}
                  strokeWidth={0.6}
                  strokeLinecap="round"
                />
                <SvgText
                  x={labelX}
                  y={labelY}
                  fontFamily={fontFamily[600]}
                  fontSize={9}
                  fill={c.text}
                  textAnchor={anchor}
                  alignmentBaseline="middle"
                >
                  {formatSliceOuterPct(slice.pct)}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Center text — por default balance + 'Distribución'. Cuando
            el user holdea un mercado desde la AllocationBar (dimMarket
            != null), swapeamos a "X %" grande + nombre del mercado. */}
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
            {activeSlice ? (
              /* Hold sobre un slice — el centro del donut espeja el %
               * + label de la categoría tocada (mismo treatment visual
               * que el cross-highlight desde la AllocationBar). */
              <>
                <Text
                  style={[s.pieCenterMarketPct, { color: c.text }]}
                  numberOfLines={1}
                >
                  {activeSlice.pct >= 10
                    ? Math.round(activeSlice.pct).toString()
                    : activeSlice.pct.toFixed(1).replace(".", ",")}
                  <Text style={{ color: c.textMuted }}>%</Text>
                </Text>
                <Text
                  style={[s.pieCenterMarketLabel, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {activeSlice.label}
                </Text>
              </>
            ) : dimMarketPct != null ? (
              <>
                <Text
                  style={[s.pieCenterMarketPct, { color: c.text }]}
                  numberOfLines={1}
                >
                  {dimMarketPct >= 10
                    ? Math.round(dimMarketPct).toString()
                    : dimMarketPct.toFixed(1).replace(".", ",")}
                  <Text style={{ color: c.textMuted }}>%</Text>
                </Text>
                <Text
                  style={[s.pieCenterMarketLabel, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {marketLabelFull(dimMarket as MarketKey)}
                </Text>
              </>
            ) : (
              /* Default state — balance compact arriba + delta del
               * día abajo (▲/▼ en tone color + pct). Coincide con el
               * delta del hero. */
              <>
                <Text
                  style={[s.pieCenterPrimary, { color: c.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatCenterMoney(totalDisplay, currency)}
                </Text>
                <View style={s.pieCenterDeltaRow}>
                  <Text
                    style={[
                      s.pieCenterDeltaTri,
                      { color: dayUp ? c.brand : c.red },
                    ]}
                  >
                    {dayUp ? "▲" : "▼"}
                  </Text>
                  <Text
                    style={[
                      s.pieCenterDeltaPct,
                      { color: dayUp ? c.brand : c.red },
                    ]}
                  >
                    {fmtPctAbs(dayPct)}
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : null}
      </View>

      {/* Tooltip — aparece al holdear un slice. Mismo patrón visual
          que el FloorBrick: pill ink + label uppercase + pct en
          brand + lista de tickers con su variación. Posicionado
          ENCIMA del donut, centrado horizontalmente. Caret apunta
          hacia abajo. translateY(-tooltipH) lo levanta sobre el
          punto anchor (top = arriba del donut). */}
      {activeSlice && containerW > 0 ? (
        <Animated.View
          key={`pie-tip-${activeIdx}`}
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(100)}
          pointerEvents="none"
          onLayout={(e) => setTooltipH(e.nativeEvent.layout.height)}
          style={[
            s.tooltipAnchor,
            {
              left: containerW / 2,
              top: ((cy - outerR - 6) * containerW) / W,
              transform: [{ translateY: -tooltipH }],
            },
          ]}
        >
          <View style={[s.tooltipPill, { backgroundColor: c.ink }]}>
            <View style={s.tooltipHeader}>
              <Text style={[s.tooltipLabel, { color: c.bg }]}>
                {activeSlice.label}
              </Text>
              <Text style={[s.tooltipPct, { color: c.brand }]}>
                {formatTooltipPct(activeSlice.pct)}
              </Text>
            </View>
            {/* DINERO usa el formato cash (currency code + monto en
                native) en vez del change %. Single-ticker mode (crypto
                grouped by ticker) muestra shortTicker + change. */}
            {activeSlice.market !== "DINERO" &&
            groupBy === "ticker" &&
            activeSlice.rows.length === 1 ? (
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
                            : c.red,
                      },
                    ]}
                  >
                    {activeSlice.rows[0].change >= 0 ? "▲ " : "▼ "}
                    {fmtPctAbs(activeSlice.rows[0].change)}
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
                  <TooltipRowEntry
                    key={r.ticker}
                    isCash={activeSlice.market === "DINERO"}
                    row={r}
                    c={c}
                  />
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
          <View style={[s.tooltipCaretDown, { backgroundColor: c.ink }]} />
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
  /** Cross-highlight desde la AllocationBar — atenúa los bloques
   *  cuyo mercado no es el highlighted. */
  dimMarket?: MarketKey | null;
  /** Cross-highlight inverso (chart → barra) — emite el mercado
   *  del bloque activo o null al soltar. */
  onActiveMarketChange?: (m: MarketKey | null) => void;
}

function FloorBrick({
  holdings,
  totalArs,
  groupBy,
  onHoldChange,
  dimMarket,
  onActiveMarketChange,
}: FloorBrickProps) {
  const { c } = useTheme();
  const [containerW, setContainerW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  /* Dimensiones medidas del tooltip — height para translateY(-h) y
   * width para clamp horizontal cuando el bloque vive contra el
   * borde de la pantalla. */
  const [tooltipH, setTooltipH] = useState(0);
  const [tooltipW, setTooltipW] = useState(0);

  /* Geometría — ladrillo más profundo (depth 50 vs 32 previo) para
   * que se sienta como un bloque sólido en vez de una pared chata.
   * wallW reducido a 260 para que la proporción depth:width sea más
   * chunky. yTop bajado y H subido un toque para que el top inclinado
   * (yTop - topShift = 14.5) y la sombra (yBot + 14 + ry) quepan
   * holgados en el viewBox. */
  const W = 340;
  const H = 190;
  const wallW = 260;
  const wallH = 100;
  const depth = 50;
  const xL = (W - (wallW + depth)) / 2;
  const yTop = 42;
  const yBot = yTop + wallH;
  const topShift = depth * 0.55;

  type Row = {
    ticker: string;
    shortTicker: string;
    change: number;
    ars: number;
    native: number;
    currency: AssetCurrency;
  };
  const blocks = useMemo(() => {
    const byKey = new Map<
      string,
      {
        ars: number;
        rows: Row[];
        cat: AssetCategory;
        name: string;
        market: MarketKey;
      }
    >();
    for (const h of holdings) {
      const key =
        groupBy === "ticker" ? h.asset.ticker : h.asset.category;
      const entry = byKey.get(key) ?? {
        ars: 0,
        rows: [],
        cat: h.asset.category,
        name: h.asset.name,
        market: chartMarketFor(h.asset),
      };
      entry.ars += h.ars;
      entry.rows.push({
        ticker: h.asset.ticker,
        shortTicker: shortCryptoTicker(h.asset.ticker),
        change: h.asset.change,
        ars: h.ars,
        native: h.native,
        currency: assetCurrency(h.asset),
      });
      byKey.set(key, entry);
    }
    const sorted = Array.from(byKey.entries())
      .map(([key, { ars, rows, cat, name, market }]) => ({
        key,
        cat,
        market,
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

  const handleTouch = useCallback(
    (touchPx: number | null) => {
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
      onActiveMarketChange?.(
        next != null ? blocksRef.current[next].market : null,
      );
      if (next !== null) Haptics.selectionAsync().catch(() => {});
      // xL y wallW son constantes locales — no cambian.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [onActiveMarketChange],
  );

  const dimmedFront = c.surfaceSunken;
  const dimmedTop = c.surfaceHover;
  const dimmedRight = c.border;

  const activeBlock =
    activeIdx !== null ? blocks[activeIdx] ?? null : null;
  const tooltipLeftPx =
    activeBlock && containerW > 0
      ? (((activeBlock.x0 + activeBlock.x1) / 2) / W) * containerW
      : 0;
  const isCashBlock = activeBlock?.market === "DINERO";

  /* Clamp horizontal — el anchor (y caret) sigue clavado en el centro
   * del bloque para no perder la referencia visual, pero el pill se
   * desplaza con translateX si su minWidth lo saca del viewport. */
  const tooltipPillOffsetX = useMemo(() => {
    if (!activeBlock || tooltipW === 0 || containerW === 0) return 0;
    const pad = 8;
    const minCenter = tooltipW / 2 + pad;
    const maxCenter = containerW - tooltipW / 2 - pad;
    if (minCenter > maxCenter) return 0;
    const clampedCenter = Math.max(
      minCenter,
      Math.min(maxCenter, tooltipLeftPx),
    );
    return clampedCenter - tooltipLeftPx;
  }, [activeBlock, tooltipW, containerW, tooltipLeftPx]);

  // % agregado del mercado highlighted desde la AllocationBar — si
  // el user holdea AR en la barra, sumamos los pcts de los bloques
  // de mercado AR para mostrarlo en una pill flotante sobre el chart.
  const dimMarketPct = useMemo(() => {
    if (dimMarket == null) return null;
    return blocks
      .filter((b) => b.market === dimMarket)
      .reduce((acc, b) => acc + b.pct, 0);
  }, [dimMarket, blocks]);
  const dimMarketLeftPx = useMemo(() => {
    if (dimMarket == null || containerW === 0) return null;
    const matching = blocks.filter((b) => b.market === dimMarket);
    if (matching.length === 0) return null;
    const x0 = matching[0].x0;
    const x1 = matching[matching.length - 1].x1;
    return (((x0 + x1) / 2) / W) * containerW;
  }, [dimMarket, blocks, containerW]);

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
            cy={yBot + 16}
            rx={wallW / 2 + 18}
            ry={9}
            fill="rgba(14,15,12,0.10)"
          />
          {blocks.map((blk, i) => {
            const dimmedByActive = activeIdx !== null && activeIdx !== i;
            const dimmedByMarket =
              dimMarket != null && blk.market !== dimMarket;
            const dimmed = dimmedByActive || dimmedByMarket;
            const front = dimmed ? dimmedFront : blk.color;
            const top = dimmed ? dimmedTop : shadeHex(blk.color, 0.22);
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
              </G>
            );
          })}
          {blocks.length > 0
            ? (() => {
                const last = blocks[blocks.length - 1];
                const lastIdx = blocks.length - 1;
                const dimmedByActive =
                  activeIdx !== null && activeIdx !== lastIdx;
                const dimmedByMarket =
                  dimMarket != null && last.market !== dimMarket;
                const dimmed = dimmedByActive || dimmedByMarket;
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
          {/* Bordes ink del ladrillo — strokeWidth 2.4 (era 1.5) para
              que el contorno del bloque + las divisiones entre slices
              se vean robustos, en línea con el acabado handcrafted. */}
          <G
            stroke="#0E0F0C"
            strokeWidth={2.4}
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

      {/* Labels de % — renderizados como RN Text en lugar de SvgText
          para evitar bugs cross-plataforma del text-anchor middle con
          ExtraBold + glyph "%". Cada label se ancla al centro PRECISO
          de la cara frontal del block, calculado en pixels del
          container con la misma escala viewBox→container del SVG.
          El wrapper View de 80 px de ancho + alignItems "center"
          garantiza el centrado horizontal exacto (el Text se auto-
          dimensiona al contenido). */}
      {containerW > 0
        ? blocks.map((blk, i) => {
            const dimmedByActive =
              activeIdx !== null && activeIdx !== i;
            const dimmedByMarket =
              dimMarket != null && blk.market !== dimMarket;
            const dimmed = dimmedByActive || dimmedByMarket;
            const labelWvb = blk.x1 - blk.x0;
            if (labelWvb <= 46 || dimmed) return null;
            const scale = containerW / W;
            const cxPx = ((blk.x0 + blk.x1) / 2) * scale;
            const cyPx = ((yTop + yBot) / 2) * scale;
            return (
              <View
                key={`pct-${blk.key}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: cxPx - 40,
                  top: cyPx - 12,
                  width: 80,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamily[800],
                    fontSize: 17,
                    letterSpacing: -0.4,
                    color: textOnHex(blk.color),
                  }}
                  numberOfLines={1}
                >
                  {Math.round(blk.pct)}%
                </Text>
              </View>
            );
          })
        : null}

      {/* Market summary pill — aparece cuando el user holdea un
          mercado en la AllocationBar (dimMarket != null). Pill ink
          flotando sobre el centro del rango de bloques de ese
          mercado, "Argentina · 65 %". Persistente mientras dura
          el hold de la barra. */}
      {dimMarket != null &&
      dimMarketPct != null &&
      dimMarketLeftPx != null &&
      activeIdx === null ? (
        <Animated.View
          key={`brick-mkt-${dimMarket}`}
          entering={FadeInDown.duration(120)}
          exiting={FadeOutUp.duration(100)}
          pointerEvents="none"
          style={[
            s.tooltipAnchor,
            {
              left: dimMarketLeftPx,
              top: ((yTop + yBot) / 2) * (containerW / W) - 14,
            },
          ]}
        >
          <View
            style={[s.marketOverlayPill, { backgroundColor: c.ink }]}
          >
            <Text style={[s.marketOverlayLabel, { color: c.bg }]}>
              {marketLabelFull(dimMarket)}
            </Text>
            <Text style={[s.marketOverlayPct, { color: c.brand }]}>
              {dimMarketPct >= 10
                ? Math.round(dimMarketPct).toString()
                : dimMarketPct.toFixed(1).replace(".", ",")}
              %
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {activeBlock && containerW > 0 ? (
        <Animated.View
          key={`tip-${activeIdx}`}
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(100)}
          pointerEvents="none"
          style={[
            s.tooltipAnchor,
            {
              left: tooltipLeftPx,
              /* Position ENCIMA del bloque tocado — apuntando desde
               * arriba. El anchor sentado al ras del top inclinado del
               * brick (yTop - topShift) y el translateY(-tooltipH)
               * eleva el pill por encima del dedo. */
              top: ((yTop - topShift - 6) * containerW) / W,
              transform: [{ translateY: -tooltipH }],
            },
          ]}
        >
          <View
            onLayout={(e) => {
              setTooltipH(e.nativeEvent.layout.height);
              setTooltipW(e.nativeEvent.layout.width);
            }}
            style={[
              s.tooltipPill,
              {
                backgroundColor: c.ink,
                transform: [{ translateX: tooltipPillOffsetX }],
              },
            ]}
          >
            <View style={s.tooltipHeader}>
              <Text style={[s.tooltipLabel, { color: c.bg }]}>
                {activeBlock.label}
              </Text>
              <Text style={[s.tooltipPct, { color: c.brand }]}>
                {formatTooltipPct(activeBlock.pct)}
              </Text>
            </View>
            {/* DINERO usa el formato cash (currency code + monto en
                native) en vez del change %. */}
            {!isCashBlock &&
            groupBy === "ticker" &&
            activeBlock.rows.length === 1 ? (
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
                            : c.red,
                      },
                    ]}
                  >
                    {activeBlock.rows[0].change >= 0 ? "▲ " : "▼ "}
                    {fmtPctAbs(activeBlock.rows[0].change)}
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
                  <TooltipRowEntry
                    key={r.ticker}
                    isCash={isCashBlock}
                    row={r}
                    c={c}
                  />
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
          <View style={[s.tooltipCaretDown, { backgroundColor: c.ink }]} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ─── RankingList — barras horizontales ordenadas ────────────────
 *
 * Muestra cada categoría como una row con label + pct + barra de
 * fondo proporcional. Mismo dual-dimming que FloorPie/FloorBrick:
 *   - Hold sobre una row → highlightea (resto a opacity 0.35).
 *   - dimMarket → atenúa rows de otros mercados.
 * onActiveMarketChange espeja al padre.
 *
 * Layout: cada row es un Pressable con bg-bar absoluto detrás del
 * contenido (label + pct). El bg-bar usa color de la paleta + opacity
 * sólida, así la barra se "ve" del lado izquierdo y se desvanece a
 * la derecha (efecto de fill horizontal).
 */

interface RankingListProps {
  holdings: Holding[];
  totalArs: number;
  onHoldChange?: (holding: boolean) => void;
  dimMarket?: MarketKey | null;
  onActiveMarketChange?: (m: MarketKey | null) => void;
}

function RankingList({
  holdings,
  totalArs,
  onHoldChange,
  dimMarket,
  onActiveMarketChange,
}: RankingListProps) {
  const { c } = useTheme();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [containerW, setContainerW] = useState(0);
  const [tooltipH, setTooltipH] = useState(0);
  /* Layout cache de cada row — para anclar el tooltip en el centro
   * del row holdeado. */
  const [rowLayouts, setRowLayouts] = useState<
    Record<string, { y: number; h: number }>
  >({});

  type Row = {
    ticker: string;
    shortTicker: string;
    change: number;
    ars: number;
    native: number;
    currency: AssetCurrency;
  };
  const rows = useMemo(() => {
    const byKey = new Map<
      string,
      {
        ars: number;
        cat: AssetCategory;
        market: MarketKey;
        rows: Row[];
      }
    >();
    for (const h of holdings) {
      const key = h.asset.category;
      const entry = byKey.get(key) ?? {
        ars: 0,
        cat: h.asset.category,
        market: chartMarketFor(h.asset),
        rows: [],
      };
      entry.ars += h.ars;
      entry.rows.push({
        ticker: h.asset.ticker,
        shortTicker: shortCryptoTicker(h.asset.ticker),
        change: h.asset.change,
        ars: h.ars,
        native: h.native,
        currency: assetCurrency(h.asset),
      });
      byKey.set(key, entry);
    }
    return Array.from(byKey.entries())
      .map(([key, v], i) => ({
        key,
        cat: v.cat,
        market: v.market,
        label: categoryLabels[v.cat],
        ars: v.ars,
        pct: (v.ars / totalArs) * 100,
        color: BRICK_PALETTE[i % BRICK_PALETTE.length],
        rows: v.rows.sort((a, b) => b.ars - a.ars),
        tickers: v.rows.length,
      }))
      .sort((a, b) => b.pct - a.pct)
      .map((r, i) => ({ ...r, color: BRICK_PALETTE[i % BRICK_PALETTE.length] }));
  }, [holdings, totalArs]);

  const handleHold = useCallback(
    (idx: number | null) => {
      setActiveIdx(idx);
      onHoldChange?.(idx !== null);
      onActiveMarketChange?.(idx != null ? rows[idx].market : null);
      if (idx !== null) Haptics.selectionAsync().catch(() => {});
    },
    [onHoldChange, onActiveMarketChange, rows],
  );

  const activeRow = activeIdx !== null ? rows[activeIdx] ?? null : null;
  const activeLayout = activeRow ? rowLayouts[activeRow.key] : null;
  /* Anchor del tooltip — centro vertical del row, translateY(-h)
   * después lo eleva por encima del dedo. */
  const tooltipTopPx = activeLayout
    ? activeLayout.y + activeLayout.h / 2 - 8
    : 0;

  return (
    <View
      style={s.rankingWrap}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      {rows.map((r, i) => {
        const dimmedByActive = activeIdx !== null && activeIdx !== i;
        const dimmedByMarket =
          dimMarket != null && r.market !== dimMarket;
        const dimmed = dimmedByActive || dimmedByMarket;
        const widthPct = Math.max(2, Math.min(100, r.pct));
        const abbrev = abbrevLabel(r.label);
        const valueArs = formatRankingValue(r.ars);
        return (
          <Pressable
            key={r.key}
            onPressIn={() => handleHold(i)}
            onPressOut={() => handleHold(null)}
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              setRowLayouts((prev) =>
                prev[r.key]?.y === y && prev[r.key]?.h === height
                  ? prev
                  : { ...prev, [r.key]: { y, h: height } },
              );
            }}
            style={[
              s.rankRow,
              i > 0 && {
                borderTopColor: c.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
              { opacity: dimmed ? 0.35 : 1 },
            ]}
          >
            <View style={s.rankBody}>
              {/* Category icon — squircle 36 con bg de la paleta del
                  brick + abbreviation 2-char en blanco bold. */}
              <View
                style={[
                  s.rankIcon,
                  { backgroundColor: r.color },
                ]}
              >
                <Text
                  style={[
                    s.rankIconText,
                    { color: textOnHex(r.color) },
                  ]}
                >
                  {abbrev}
                </Text>
              </View>
              <View style={s.rankCenter}>
                <Text
                  style={[s.rankLabel, { color: c.text }]}
                  numberOfLines={1}
                >
                  {r.label}
                </Text>
                <Text
                  style={[s.rankMeta, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {r.tickers}{" "}
                  {r.tickers === 1 ? "posición" : "posiciones"}
                </Text>
              </View>
              <View style={s.rankRight}>
                <Text style={[s.rankPct, { color: c.text }]}>
                  {r.pct >= 10
                    ? Math.round(r.pct).toString()
                    : r.pct.toFixed(1).replace(".", ",")}
                  <Text style={[s.rankPctSign, { color: c.textMuted }]}>
                    {" "}%
                  </Text>
                </Text>
                <Text
                  style={[s.rankValue, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {valueArs}
                </Text>
              </View>
            </View>
            {/* Progress bar al fondo del row — fill de la categoría
                hasta widthPct, fondo neutro. Robinhood signature
                "weight indicator". */}
            <View
              style={[
                s.rankProgressTrack,
                { backgroundColor: c.surfaceHover },
              ]}
            >
              <View
                style={[
                  s.rankProgressFill,
                  {
                    backgroundColor: r.color,
                    width: `${widthPct}%`,
                  },
                ]}
              />
            </View>
          </Pressable>
        );
      })}

      {/* Tooltip — pill ink ENCIMA del row holdeado. Mismo lenguaje
          que FloorPie/FloorBrick: label uppercase + pct brand + lista
          de tickers con su variación. */}
      {activeRow && containerW > 0 && activeLayout ? (
        <Animated.View
          key={`rank-tip-${activeRow.key}`}
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(100)}
          pointerEvents="none"
          onLayout={(e) => setTooltipH(e.nativeEvent.layout.height)}
          style={[
            s.tooltipAnchor,
            {
              left: containerW / 2,
              top: tooltipTopPx,
              transform: [{ translateY: -tooltipH }],
            },
          ]}
        >
          <View style={[s.tooltipPill, { backgroundColor: c.ink }]}>
            <View style={s.tooltipHeader}>
              <Text style={[s.tooltipLabel, { color: c.bg }]}>
                {activeRow.label}
              </Text>
              <Text style={[s.tooltipPct, { color: c.brand }]}>
                {formatTooltipPct(activeRow.pct)}
              </Text>
            </View>
            {/* DINERO usa el formato cash (currency code + monto en
                native) en lugar del change %, que no aplica para cash. */}
            {activeRow.rows.length > 0 ? (
              <View
                style={[
                  s.tooltipDivider,
                  { backgroundColor: "rgba(255,255,255,0.12)" },
                ]}
              />
            ) : null}
            {activeRow.rows.slice(0, 5).map((rr) => (
              <TooltipRowEntry
                key={rr.ticker}
                isCash={activeRow.market === "DINERO"}
                row={rr}
                c={c}
              />
            ))}
            {activeRow.rows.length > 5 ? (
              <Text
                style={[
                  s.tooltipMore,
                  { color: "rgba(255,255,255,0.45)" },
                ]}
              >
                +{activeRow.rows.length - 5} más
              </Text>
            ) : null}
          </View>
          <View style={[s.tooltipCaretDown, { backgroundColor: c.ink }]} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** 2-char uppercase del label para el icon — CEDEARs → CE,
 *  Acciones AR → AR, Bonos → BO, Crypto → CR, etc. Si el label
 *  tiene espacio, agarra primera letra de cada palabra (max 2).
 *  Caso default: primeras 2 chars del label. */
function abbrevLabel(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

/** Compact format del valor de un grupo en el ranking — "$ 5,7 M",
 *  "$ 8 K", o el monto entero si es chico. */
function formatRankingValue(ars: number): string {
  if (ars >= 1e9)
    return `$ ${(ars / 1e9).toFixed(1).replace(".", ",")} B`;
  if (ars >= 1e6)
    return `$ ${(ars / 1e6).toFixed(1).replace(".", ",")} M`;
  if (ars >= 1e3) return `$ ${Math.round(ars / 1e3)} K`;
  return `$ ${Math.round(ars)}`;
}

/* ─── Treemap — rectángulos proporcionales (slice-and-dice) ──────
 *
 * Algoritmo simple alternando cortes vertical/horizontal por nivel.
 * Para nuestro N (3-7 categorías) es overkill un squarified, así que
 * vamos con el clásico slice-and-dice: el rect más grande arriba a
 * la izquierda, los siguientes adyacentes, alternando eje. Cada rect
 * es un Pressable independiente, con dual-dim igual que el ranking.
 *
 * Aspect ratio del canvas: 16:9 (340×190 viewBox). Mismo gesture
 * model: hold para highlightear, soltar para resetear. Gap de 2px
 * entre rects para distinción visual.
 */

interface TreemapProps {
  holdings: Holding[];
  totalArs: number;
  onHoldChange?: (holding: boolean) => void;
  dimMarket?: MarketKey | null;
  onActiveMarketChange?: (m: MarketKey | null) => void;
}

function Treemap({
  holdings,
  totalArs,
  onHoldChange,
  dimMarket,
  onActiveMarketChange,
}: TreemapProps) {
  const { c } = useTheme();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [containerW, setContainerW] = useState(0);
  /* Dimensiones medidas del pill — height para translateY(-h) y width
   * para clamp horizontal cuando el tile vive en el borde de la
   * pantalla (sino el pop-up se sale del viewport). */
  const [tooltipH, setTooltipH] = useState(0);
  const [tooltipW, setTooltipW] = useState(0);

  const aspect = 16 / 10; // wide-ish, ocupa el ancho sin ser muy alto
  const W = 340;
  const H = W / aspect;

  type Row = {
    ticker: string;
    shortTicker: string;
    change: number;
    ars: number;
    native: number;
    currency: AssetCurrency;
  };
  const tiles = useMemo(() => {
    const byKey = new Map<
      string,
      {
        ars: number;
        /** Sumatoria del delta del día (ars * change%/100) por categoría
         *  — alimenta el "▲ X,X%" en la card del mosaico. */
        dayDeltaArs: number;
        cat: AssetCategory;
        market: MarketKey;
        rows: Row[];
      }
    >();
    for (const h of holdings) {
      const key = h.asset.category;
      const entry = byKey.get(key) ?? {
        ars: 0,
        dayDeltaArs: 0,
        cat: h.asset.category,
        market: chartMarketFor(h.asset),
        rows: [],
      };
      entry.ars += h.ars;
      entry.dayDeltaArs += h.ars * (h.asset.change / 100);
      entry.rows.push({
        ticker: h.asset.ticker,
        shortTicker: shortCryptoTicker(h.asset.ticker),
        change: h.asset.change,
        ars: h.ars,
        native: h.native,
        currency: assetCurrency(h.asset),
      });
      byKey.set(key, entry);
    }
    const sorted = Array.from(byKey.entries())
      .map(([key, v]) => ({
        key,
        cat: v.cat,
        market: v.market,
        label: categoryLabels[v.cat],
        ars: v.ars,
        dayDeltaArs: v.dayDeltaArs,
        rows: v.rows.sort((a, b) => b.ars - a.ars),
      }))
      .sort((a, b) => b.ars - a.ars);

    const total = sorted.reduce((acc, t) => acc + t.ars, 0) || 1;

    // Squarified-ish layout: para cada item, decidir si cortar el
    // rect remanente vertical u horizontal según cuál ratio queda más
    // cerca de 1. Para items pequeños (< 8% del total) los apilamos
    // verticalmente en el rect remanente para que no terminen siendo
    // tiras finitas.
    type Rect = { x: number; y: number; w: number; h: number };
    const layout: Array<Rect & (typeof sorted)[number] & { color: string }> = [];
    let remaining: Rect = { x: 0, y: 0, w: W, h: H };

    for (let i = 0; i < sorted.length; i++) {
      const isLast = i === sorted.length - 1;
      const t = sorted[i];
      const remainingArs = sorted.slice(i).reduce((acc, t) => acc + t.ars, 0);
      const frac = t.ars / remainingArs;

      let rect: Rect;
      if (isLast) {
        rect = { ...remaining };
        remaining = { x: 0, y: 0, w: 0, h: 0 };
      } else if (remaining.w >= remaining.h) {
        // cortar vertical (left slice)
        const w = remaining.w * frac;
        rect = {
          x: remaining.x,
          y: remaining.y,
          w,
          h: remaining.h,
        };
        remaining = {
          x: remaining.x + w,
          y: remaining.y,
          w: remaining.w - w,
          h: remaining.h,
        };
      } else {
        // cortar horizontal (top slice)
        const h = remaining.h * frac;
        rect = {
          x: remaining.x,
          y: remaining.y,
          w: remaining.w,
          h,
        };
        remaining = {
          x: remaining.x,
          y: remaining.y + h,
          w: remaining.w,
          h: remaining.h - h,
        };
      }

      layout.push({
        ...t,
        ...rect,
        color: BRICK_PALETTE[i % BRICK_PALETTE.length],
      });
      // total no se usa después de aquí pero lo dejamos por claridad
      void total;
    }
    return layout;
  }, [holdings, W, H]);

  const handleHold = useCallback(
    (idx: number | null) => {
      setActiveIdx(idx);
      onHoldChange?.(idx !== null);
      onActiveMarketChange?.(idx != null ? tiles[idx].market : null);
      if (idx !== null) Haptics.selectionAsync().catch(() => {});
    },
    [onHoldChange, onActiveMarketChange, tiles],
  );

  // Total para % en labels
  const totalArsAll = totalArs;

  /* Tile activo + posición de su anchor para el tooltip — centro
   * horizontal del tile, top del tile. translateY(-tooltipH) lo
   * eleva por encima del dedo. */
  const activeTile = activeIdx !== null ? tiles[activeIdx] ?? null : null;
  const scale = containerW / W;
  const tooltipLeftPx = activeTile
    ? (activeTile.x + activeTile.w / 2) * scale
    : 0;
  const tooltipTopPx = activeTile ? activeTile.y * scale - 6 : 0;
  const activePct = activeTile ? (activeTile.ars / totalArsAll) * 100 : 0;
  const isCash = activeTile?.market === "DINERO";

  /* Clamp horizontal del pill — el anchor sigue clavado en el centro
   * del tile (así el caret apunta al lugar correcto), pero el pill se
   * desplaza con translateX para no salir del viewport cuando el tile
   * vive contra el borde derecho/izquierdo de la pantalla. */
  const tooltipPillOffsetX = useMemo(() => {
    if (!activeTile || tooltipW === 0 || containerW === 0) return 0;
    const pad = 8;
    const minCenter = tooltipW / 2 + pad;
    const maxCenter = containerW - tooltipW / 2 - pad;
    if (minCenter > maxCenter) return 0;
    const clampedCenter = Math.max(
      minCenter,
      Math.min(maxCenter, tooltipLeftPx),
    );
    return clampedCenter - tooltipLeftPx;
  }, [activeTile, tooltipW, containerW, tooltipLeftPx]);

  return (
    <View
      style={[s.treemapWrap, { aspectRatio: aspect }]}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      {containerW > 0
        ? tiles.map((t, i) => {
            const dimmedByActive =
              activeIdx !== null && activeIdx !== i;
            const dimmedByMarket =
              dimMarket != null && t.market !== dimMarket;
            const dimmed = dimmedByActive || dimmedByMarket;
            const scale = containerW / W;
            const tileW = t.w * scale - 3;
            const tileH = t.h * scale - 3;
            const pct = (t.ars / totalArsAll) * 100;
            const isLarge = tileW > 120 && tileH > 90;
            const isMedium = tileW > 80 && tileH > 60;
            const isWideNarrow = tileW > 120 && tileH > 30 && tileH <= 60;
            const isMini = tileW > 44 && tileH > 26;
            const ink = textOnHex(t.color);
            const onDarkBg = ink === "#FAFAF7";
            /* Label color contextual — el brand verde se perdía sobre
             * los tiles verdes. Acá: si el bg es oscuro (DINERO black),
             * uso brand para contraste; si el bg es claro (todas las
             * variantes de verde + gris CEDEARS), uso ink (almost
             * negro) para que la label tenga peso visual. */
            const labelColor = onDarkBg ? c.brand : ink;
            const pctText =
              pct >= 10
                ? Math.round(pct).toString() + "%"
                : pct.toFixed(1).replace(".", ",") + "%";
            const valueText = formatRankingValue(t.ars);
            const cardBg = dimmed ? c.surfaceSunken : t.color;
            const headerBg = dimmed
              ? c.surfaceSunken
              : shadeHex(t.color, 0.32);
            /* Gradient overlay del header — fade del headerBg lighter
             * shade en el top a fully transparent en ~55% del alto. La
             * transparencia se hace mezclando con el mismo color con
             * alpha 0 (interpola limpio en RGBA, no salta a otro tono).
             * En cards dimmed lo skipeamos porque headerBg == bg
             * (ambos surfaceSunken). */
            const showGradient = isLarge && !dimmed;
            const gradientHeight = Math.max(22, tileH * 0.55);
            return (
              <Pressable
                key={t.key}
                onPressIn={() => handleHold(i)}
                onPressOut={() => handleHold(null)}
                style={{
                  position: "absolute",
                  left: t.x * scale + 1.5,
                  top: t.y * scale + 1.5,
                  width: tileW,
                  height: tileH,
                  backgroundColor: cardBg,
                  borderCurve: "continuous",
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: c.ink,
                  opacity: dimmed ? 0.55 : 1,
                  overflow: "hidden",
                }}
              >
                {showGradient ? (
                  <LinearGradient
                    colors={[headerBg, toRgba(headerBg, 0)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      height: gradientHeight,
                    }}
                    pointerEvents="none"
                  />
                ) : null}

                {isLarge ? (
                  <View
                    style={{
                      flex: 1,
                      paddingHorizontal: 12,
                      paddingTop: 12,
                      paddingBottom: 12,
                      justifyContent: "space-between",
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: ink,
                          fontFamily: fontFamily[800],
                          fontSize: 28,
                          letterSpacing: -1,
                          lineHeight: 30,
                        }}
                        numberOfLines={1}
                      >
                        {pctText}
                      </Text>
                      <Text
                        style={{
                          color: labelColor,
                          fontFamily: fontFamily[800],
                          fontSize: 10,
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                          marginTop: 4,
                        }}
                        numberOfLines={1}
                      >
                        {t.label}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: ink,
                        fontFamily: fontFamily[700],
                        fontSize: 12,
                        letterSpacing: -0.2,
                      }}
                      numberOfLines={1}
                    >
                      {valueText}
                    </Text>
                  </View>
                ) : isWideNarrow ? (
                  /* Cards anchas y bajitas (ej. Fondos al fondo): todo
                     en una sola fila — % | label | value */
                  <View
                    style={{
                      flex: 1,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: ink,
                        fontFamily: fontFamily[800],
                        fontSize: 16,
                        letterSpacing: -0.4,
                      }}
                      numberOfLines={1}
                    >
                      {pctText}
                    </Text>
                    <Text
                      style={{
                        color: labelColor,
                        fontFamily: fontFamily[800],
                        fontSize: 10,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                      }}
                      numberOfLines={1}
                    >
                      {t.label}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text
                      style={{
                        color: ink,
                        fontFamily: fontFamily[700],
                        fontSize: 11,
                        letterSpacing: -0.1,
                      }}
                      numberOfLines={1}
                    >
                      {valueText}
                    </Text>
                  </View>
                ) : isMedium ? (
                  /* Cards medianas — pct + label arriba, value abajo,
                     todo apilado vertical con padding. */
                  <View
                    style={{
                      flex: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      justifyContent: "space-between",
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: ink,
                          fontFamily: fontFamily[800],
                          fontSize: 22,
                          letterSpacing: -0.7,
                          lineHeight: 24,
                        }}
                        numberOfLines={1}
                      >
                        {pctText}
                      </Text>
                      <Text
                        style={{
                          color: labelColor,
                          fontFamily: fontFamily[800],
                          fontSize: 9,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                          marginTop: 3,
                        }}
                        numberOfLines={1}
                      >
                        {t.label}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: ink,
                        fontFamily: fontFamily[700],
                        fontSize: 11,
                        letterSpacing: -0.1,
                      }}
                      numberOfLines={1}
                    >
                      {valueText}
                    </Text>
                  </View>
                ) : isMini ? (
                  /* Mini: solo el pct, centrado. */
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: ink,
                        fontFamily: fontFamily[800],
                        fontSize: 14,
                        letterSpacing: -0.3,
                      }}
                      numberOfLines={1}
                    >
                      {pctText}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        : null}

      {/* Tooltip — pill ink ENCIMA del tile holdeado. Mismo lenguaje
          que FloorPie/FloorBrick/RankingList. */}
      {activeTile && containerW > 0 ? (
        <Animated.View
          key={`treemap-tip-${activeTile.key}`}
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(100)}
          pointerEvents="none"
          style={[
            s.tooltipAnchor,
            {
              left: tooltipLeftPx,
              top: tooltipTopPx,
              transform: [{ translateY: -tooltipH }],
            },
          ]}
        >
          <View
            onLayout={(e) => {
              setTooltipH(e.nativeEvent.layout.height);
              setTooltipW(e.nativeEvent.layout.width);
            }}
            style={[
              s.tooltipPill,
              {
                backgroundColor: c.ink,
                transform: [{ translateX: tooltipPillOffsetX }],
              },
            ]}
          >
            <View style={s.tooltipHeader}>
              <Text style={[s.tooltipLabel, { color: c.bg }]}>
                {activeTile.label}
              </Text>
              <Text style={[s.tooltipPct, { color: c.brand }]}>
                {formatTooltipPct(activePct)}
              </Text>
            </View>
            {/* DINERO usa el formato cash (currency code + monto en
                native) en lugar del change %. */}
            {activeTile.rows.length > 0 ? (
              <>
                <View
                  style={[
                    s.tooltipDivider,
                    { backgroundColor: "rgba(255,255,255,0.12)" },
                  ]}
                />
                {activeTile.rows.slice(0, 5).map((rr) => (
                  <TooltipRowEntry
                    key={rr.ticker}
                    isCash={isCash}
                    row={rr}
                    c={c}
                  />
                ))}
                {activeTile.rows.length > 5 ? (
                  <Text
                    style={[
                      s.tooltipMore,
                      { color: "rgba(255,255,255,0.45)" },
                    ]}
                  >
                    +{activeTile.rows.length - 5} más
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
          <View style={[s.tooltipCaretDown, { backgroundColor: c.ink }]} />
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

/** Convierte un color hex o rgb(...) a rgba(...) con alpha custom.
 *  Usado para gradients que necesitan ir de "color opaco" a "color
 *  transparente del mismo tono" (interpolación cromática limpia). */
function toRgba(color: string, alpha: number): string {
  if (color.startsWith("rgba(")) {
    const inner = color.slice(5, -1).split(",").slice(0, 3).join(",");
    return `rgba(${inner},${alpha})`;
  }
  if (color.startsWith("rgb(")) {
    const inner = color.slice(4, -1);
    return `rgba(${inner},${alpha})`;
  }
  if (color.startsWith("#")) {
    const h = color.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
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

/** Pct para las outer labels del FloorPie — round a entero si >= 10,
 *  un decimal con coma si < 10 ("36%", "4,2%"). */
function formatSliceOuterPct(p: number): string {
  if (p >= 10) return Math.round(p).toString() + "%";
  return p.toFixed(1).replace(".", ",") + "%";
}

/* ─── TooltipRowEntry — fila de detalle del pill compartido entre los
 *  4 charts.
 *
 * Dos modos:
 *   - Default: ticker + variación % del día (▲/▼ con color brand/red).
 *   - isCash: ticker + monto en moneda native — para la categoría
 *     DINERO el "change" siempre es 0, así que mostramos cuánta plata
 *     hay en cada divisa (ARS/USD/USDT) que es la info útil. */
function TooltipRowEntry({
  row,
  isCash,
  c,
}: {
  row: {
    ticker: string;
    change: number;
    native: number;
    currency: AssetCurrency;
  };
  isCash: boolean;
  c: ColorMap;
}) {
  return (
    <View style={s.tooltipRow}>
      <Text style={[s.tooltipTicker, { color: c.bg }]} numberOfLines={1}>
        {row.ticker}
      </Text>
      {isCash ? (
        <Text
          style={[s.tooltipChange, { color: "rgba(255,255,255,0.85)" }]}
          numberOfLines={1}
        >
          {formatMoney(row.native, row.currency)}
        </Text>
      ) : (
        <Text
          style={[
            s.tooltipChange,
            { color: row.change >= 0 ? c.brand : c.red },
          ]}
        >
          {row.change >= 0 ? "▲ " : "▼ "}
          {fmtPctAbs(row.change)}
        </Text>
      )}
    </View>
  );
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
    /* marginBottom generoso para dejar respirar al $ del balance —
     * el lineHeight del integer es 1.05x con stretchY, lo que hace
     * que la cabeza del símbolo casi roce el descender de "Portfolio"
     * con marginBottom chico. 14 px deja aire suficiente. */
    marginBottom: 14,
  },
  heroPagerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  /* Allocation bar del hero — barra horizontal stacked AR/US/Crypto
   * en 3 opacidades del brand. Mete identidad visual al hero sin
   * agregar chrome. Caption con los % de cada mercado abajo. */
  allocBlock: {
    marginTop: 16,
  },
  /* Cuando la allocBlock vive afuera del heroBlock (debajo del
   * chart, arriba del Rendimiento) necesita su propio padding
   * horizontal — el heroBlock lo contenía con su paddingHorizontal
   * 24. También aumentamos un toque el marginTop para separarla
   * visualmente del chart. */
  allocBlockStandalone: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 4,
  },
  allocBar: {
    flexDirection: "row",
    height: 6,
    borderCurve: "continuous",
    borderRadius: 3,
    /* overflow visible para no clipear el scaleY del segmento
     * highlighted — la animación de "inflar" se sale del bound de
     * 6 px del track. */
    overflow: "visible",
  },
  /* Caption stacked: row con un slot por segmento, cada uno con
   * el mismo flex que la barra de arriba — el label queda centrado
   * bajo su porción. */
  allocCaptionRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  allocCaption: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.05,
    textAlign: "center",
  },

  /* Pill ARS/USD — chiquito, debajo del saldo. Tap → abre el
   * CurrencySheet para cambiar moneda con un acto deliberado. */
  currencyPillRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  currencyPillCode: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.5,
  },
  /* Ladrillo full-bleed — sigue al hero scrollable. Sin
   * marginHorizontal porque el ScrollView no tiene padding lateral. */
  brickContainer: {
    marginTop: 24,
  },

  /* Chart block — full width, sin card. Sin título ni header — el
   * chart se rendea directo bajo la allocation bar del hero. El
   * selector Pie/Ladrillo va DEBAJO del chart alineado a la derecha. */
  chartBlock: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  /* Selector Pie/Ladrillo en el hero — vive ARRIBA de la
   * allocation bar, alineado a la derecha. Controla la viz del
   * chart que vive abajo del hero. */
  heroSelectorRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
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
  /* Heading "álamos-style" — mismo treatment que el "Briefing" del
   * stock detail. Pareja título + arrow pegado a la derecha. */
  alamosHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  alamosHeadingText: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
  },
  /* Spacer abajo del heading "Mercados" — alamosHeadingText no trae
   * marginBottom (Posiciones lo hereda del positionsHead row), pero
   * acá el heading vive como Text suelto. */
  marketsHeading: {
    marginBottom: 12,
  },
  /* Variante compacta del heading — para el link de Rendimiento que
   * vive en un row con valor al costado y necesita más balance. */
  linkRowHeading: {
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.4,
  },
  marketRow: {
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  marketIcon: {
    /* 40 px — el ícono spans verticalmente las 2 líneas de
     * contenido (name + delta) lo que centra visualmente el
     * nombre del mercado contra el ícono. Más balanceado que
     * antes con el ícono más chico. */
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  marketContent: {
    flex: 1,
  },
  marketRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  marketRowBottom: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  /* Círculo base de los MarketFlags. Overflow hidden para que el
   * SVG se clipee al círculo (las banderas se rendean rectangulares
   * y se cortan por la wrap circular). */
  flagCircle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
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

  /* ─── Sección Rendimiento — heading principal + 2 sub-stats
   * (Mejor / Peor del día). Hairline divider arriba que la separa
   * de la allocation bar; el heading tiene jerarquía con font
   * grande, las sub-stats viven debajo más chicas. Sin dividers
   * entre las filas internas — son related stats de la misma
   * sección. */
  rendimientoBlock: {
    paddingHorizontal: 24,
    marginTop: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rendimientoHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rendimientoHeadingLabel: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.3,
  },
  rendimientoHeadingTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rendimientoHeadingValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  /* PositionsList — lista plana de holdings individuales. Sin card,
   * sin border, sin chevrons, sin swatches. Section title arriba +
   * rows separadas por hairlines. */
  positionsBlock: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  /* Header de Posiciones — title + arrow brand pegado a la derecha
   * (mismo treatment que el "Briefing" del stock detail). Toda la
   * fila es un Pressable. */
  positionsHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  positionLeft: {
    flex: 1,
  },
  positionTicker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  positionName: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  /* Mini-sparkline a la izquierda del precio — 56×22, color
   * cromático por dirección del día. Visualmente liviano: linea fina
   * que se "pierde" entre el ticker y el monto. */
  positionSpark: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  positionRight: {
    alignItems: "flex-end",
    minWidth: 90,
  },
  positionValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  positionDelta: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },

  /* Movers del día — 2 cards Robinhood-style al fondo. flex 1 cada
   * una con gap. La grilla vive 24px adentro del horizontal padding
   * del screen para alinear con el resto del contenido. */
  moversBlock: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 24,
  },
  moverCard: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 10,
  },
  /* Eyebrow display — misma fuente que el "Briefing" del stock
   * detail (fontFamily[800], fontSize 18, letterSpacing -0.4). NO
   * uppercase, NO caps tracked. Sentence case y con cromática
   * contextual (verde "Mejor", naranja "Peor"). */
  moverCardEyebrow: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.4,
  },
  moverCardHead: {
    gap: 2,
  },
  moverCardTicker: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.4,
  },
  moverCardName: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  moverCardSpark: {
    height: 28,
    marginTop: 2,
    marginBottom: 2,
    overflow: "hidden",
  },
  moverCardDelta: {
    fontFamily: fontFamily[800],
    fontSize: 16,
    letterSpacing: -0.3,
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
    textAlign: "right",
  },
  /* Stack vertical para % + "hoy" debajo. Alineado a la derecha
   * para que el % y el chevron queden bien separados. */
  linkRowValueStack: {
    alignItems: "flex-end",
  },
  linkRowValueSub: {
    fontFamily: fontFamily[600],
    fontSize: 10,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginTop: 1,
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
  /* Center text — estado neutral (sin hold). Balance compact arriba +
   * eyebrow uppercase abajo. Robinhood-style: dominant + tipográfica
   * decisiva, sin filler. */
  pieCenterPrimary: {
    fontFamily: fontFamily[800],
    fontSize: 20,
    letterSpacing: -0.6,
    lineHeight: 22,
    maxWidth: 134,
    textAlign: "center",
  },
  pieCenterSecondary: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 5,
    maxWidth: 134,
    textAlign: "center",
  },
  /* Delta hoy del donut — fila tri + pct en tone color (brand/red).
   * Vive debajo del balance en el centro del donut, mismo lenguaje
   * que el delta del hero pero más compacto. */
  pieCenterDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  pieCenterDeltaTri: {
    fontFamily: fontFamily[800],
    fontSize: 11,
  },
  pieCenterDeltaPct: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.2,
  },
  /* Variante del centro cuando el user holdea un mercado en la
   * AllocationBar — % grande dominante + label del mercado abajo. */
  pieCenterMarketPct: {
    fontFamily: fontFamily[800],
    fontSize: 30,
    letterSpacing: -1,
    lineHeight: 32,
  },
  pieCenterMarketLabel: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
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
  /* Pill flotante del cross-highlight de mercado — más chico que el
   * tooltip de slice/bloque, pill horizontal con label uppercase + pct
   * en brand. Se anchorea al centro del rango del mercado en el chart. */
  marketOverlayPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  marketOverlayLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  marketOverlayPct: {
    fontFamily: fontFamily[800],
    fontSize: 13,
    letterSpacing: -0.2,
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
  /* Caret apuntando hacia ABAJO — para tooltips que viven ENCIMA
   * del bloque/slice/tile tocado. La mitad de arriba del cuadrado
   * rotado queda oculta tras el pill, dejando solo la mitad de abajo
   * visible (forma triangular apuntando al elemento). */
  tooltipCaretDown: {
    width: 8,
    height: 8,
    marginTop: -4,
    transform: [{ rotate: "45deg" }],
  },

  /* Ranking — Robinhood-style. Cada row es un Pressable tall con:
   * icon (squircle 36 con bg color + abbr 2-char), label + meta a la
   * izq, pct + valor a la der, y barra de progreso al fondo del row
   * que muestra el "weight" relativo (signature de Robinhood). */
  rankingWrap: {
    position: "relative",
    paddingHorizontal: 0,
  },
  rankRow: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
  },
  rankBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  rankIcon: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rankIconText: {
    fontFamily: fontFamily[800],
    fontSize: 13,
    letterSpacing: -0.2,
  },
  rankCenter: {
    flex: 1,
    minWidth: 0,
  },
  rankLabel: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  rankMeta: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  rankRight: {
    alignItems: "flex-end",
    minWidth: 78,
  },
  rankPct: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.5,
  },
  rankPctSign: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.2,
  },
  rankValue: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  /* Progress bar al fondo del row — track + fill. 3 px alto, llega
   * de borde a borde del row interior. */
  rankProgressTrack: {
    height: 3,
    marginTop: 12,
    borderCurve: "continuous",
    borderRadius: 2,
    overflow: "hidden",
  },
  rankProgressFill: {
    height: 3,
    borderCurve: "continuous",
    borderRadius: 2,
  },

  /* Treemap — canvas con tiles absolutamente posicionados.
   * Tipografía proporcional al tamaño del tile (overrideado inline
   * en el render). Acá quedan los defaults base. overflow: visible
   * para que el tooltip flotando arriba no se clipee cuando el tile
   * tocado vive en el top edge. */
  treemapWrap: {
    position: "relative",
    width: "100%",
    overflow: "visible",
  },
  treemapLabel: {
    fontFamily: fontFamily[700],
    letterSpacing: -0.2,
  },
  treemapPct: {
    fontFamily: fontFamily[800],
  },
  treemapSub: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 2,
  },
});
