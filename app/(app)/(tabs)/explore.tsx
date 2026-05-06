import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  RefreshControl,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { registerTabTap } from "../../../lib/tabs/activeTap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useTheme, fontFamily, radius, spacing } from "../../../lib/theme";

// Verde de acción primaria — usar `c.action` del theme. Esta constante
// quedó como literal sólo para que no rompa style.create() — donde sí
// resolvemos vía `c.action` es en los componentes que lo usan.

const FAVS_FILTER_KEY = "explore:only_favs";
const MARKET_TAB_KEY = "explore:market_tab";
import {
  assets,
  assetIconCode,
  assetMarket,
  assetCurrency,
  formatMoney,
  formatPct,
  type Asset,
  type AssetCategory,
  type AssetMarket,
  type AssetCurrency,
} from "../../../lib/data/assets";
import { accounts } from "../../../lib/data/accounts";
import { useFavorites } from "../../../lib/favorites/context";
import { FavStar } from "../../../lib/components/FavStar";
import { MagnifyIcon } from "../../../lib/components/MagnifyIcon";
import { CATEGORIES_BY_MARKET } from "../../../lib/data/marketCategories";
import { MiniSparkline, seriesFromSeed } from "../../../lib/components/Sparkline";
import { Tap } from "../../../lib/components/Tap";
import { MarketClosedIcon } from "../../../lib/components/MarketClosedIcon";
import {
  MarketSegmented,
  type MarketSegmentedValue,
} from "../../../lib/components/MarketSegmented";
import { marketSessionByMarket } from "../../../lib/market/hours";
import Reanimated, {
  FadeInUp,
  FadeOutDown,
} from "react-native-reanimated";

interface MarketTab {
  id: AssetMarket;
  label: string;
  short: string;
  currency: AssetCurrency;
  /** Categorías disponibles dentro del mercado, en orden de relevancia.
   *  La primera ("todo") siempre es el catch-all. */
  categories: { id: AssetCategory | "todo"; label: string }[];
}

const MARKET_TABS: MarketTab[] = [
  {
    id: "AR",
    label: "Argentina",
    short: "AR",
    currency: "ARS",
    categories: [
      { id: "todo", label: "Todo" },
      { id: "cedears", label: "CEDEARs" },
      { id: "acciones", label: "Acciones" },
      { id: "bonos", label: "Bonos" },
      { id: "fci", label: "Fondos" },
      { id: "obligaciones", label: "ONs" },
      { id: "letras", label: "Letras" },
      { id: "caucion", label: "Caución" },
    ],
  },
  {
    id: "US",
    label: "Estados Unidos",
    short: "EE.UU",
    currency: "USD",
    categories: [
      { id: "todo", label: "Todo" },
      { id: "acciones", label: "Acciones" },
    ],
  },
  {
    id: "CRYPTO",
    label: "Crypto",
    short: "Crypto",
    currency: "USDT",
    categories: [
      { id: "todo", label: "Todo" },
      { id: "crypto", label: "Spot" },
      { id: "futuros", label: "Futuros" },
    ],
  },
];

export default function ExploreScreen() {
  return <BaseExplore />;
}

function BaseExplore() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { isFavorite } = useFavorites();
  const scrollYRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

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

  const [query, setQuery] = useState("");
  const [activeMarketIdx, setActiveMarketIdx] = useState(0);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const listRef = useRef<ScrollView | null>(null);

  // Disponible para operar en el mercado activo. Cada mercado se opera
  // contra UNA cuenta específica (mismo modelo que AvailableFundsCard
  // y buy.tsx → sourceAccountIdForMarket):
  //   AR     → ars-ar
  //   US     → usd-us
  //   CRYPTO → usdt-crypto
  // Se muestra en el header al lado del título 'Mercado'.
  const operable = useMemo(() => {
    const market = MARKET_TABS[activeMarketIdx];
    const sourceId =
      market.id === "US"
        ? "usd-us"
        : market.id === "CRYPTO"
          ? "usdt-crypto"
          : "ars-ar";
    const acc = accounts.find((a) => a.id === sourceId);
    return {
      balance: acc?.balance ?? 0,
      currency: market.currency,
      sourceId,
    };
  }, [activeMarketIdx]);

  /* Tap del + del header — lleva al ingreso de saldo en la moneda
   * del mercado activo. Crypto va directo al screen de addresses
   * USDT; ARS/USD van al floating card de transferencia bancaria
   * (mismo path que el botón '+' de las cuentas vacías del home). */
  const onAddBalance = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (operable.sourceId === "usdt-crypto") {
      router.push("/(app)/crypto-deposit");
    } else {
      router.push({
        pathname: "/(app)/transfer-deposit",
        params: { currency: operable.sourceId },
      });
    }
  }, [operable.sourceId, router]);

  // Animación cross-fade entre la estrella de favoritos y el botón
  // 'Cancelar' cuando el input de búsqueda gana/pierde foco. Antes era
  // un swap brusco (un Pressable se desmontaba y el otro se montaba),
  // ahora ambos viven siempre en el árbol pero su opacidad/scale se
  // anima en useNativeDriver.
  //
  // Además animamos el WIDTH del slot derecho — colapsa al ancho de
  // la estrella (44) cuando no hay foco, expande al ancho de
  // 'Cancelar' (~86) cuando sí. Esto elimina el agujero visual entre
  // la barra y la estrella mientras no estamos buscando. width no
  // soporta useNativeDriver, así que esta animación corre en JS,
  // pero 220ms es lo suficientemente corto para no sentirse pesado.
  const showCancel = searchFocused || query.length > 0;
  const cancelOpacity = useRef(new Animated.Value(0)).current;
  const starOpacity = useRef(new Animated.Value(1)).current;
  const slotWidth = useRef(new Animated.Value(44)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(cancelOpacity, {
        toValue: showCancel ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(starOpacity, {
        toValue: showCancel ? 0 : 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(slotWidth, {
        toValue: showCancel ? 86 : 44,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [showCancel, cancelOpacity, starOpacity, slotWidth]);

  // Cargamos preferencia de "solo favoritos" + última market tab
  // seleccionada al montar para que sobrevivan entre sesiones.
  useEffect(() => {
    SecureStore.getItemAsync(FAVS_FILTER_KEY)
      .then((v) => {
        if (v === "1") setOnlyFavs(true);
      })
      .catch(() => {});
    SecureStore.getItemAsync(MARKET_TAB_KEY)
      .then((v) => {
        const idx = MARKET_TABS.findIndex((m) => m.id === v);
        if (idx >= 0) setActiveMarketIdx(idx);
      })
      .catch(() => {});
  }, []);

  const market = MARKET_TABS[activeMarketIdx];

  const openDetail = useCallback(
    (asset: Asset) => {
      router.push({
        pathname: "/(app)/detail",
        params: { ticker: asset.ticker },
      });
    },
    [router],
  );

  const toggleFavs = () => {
    setOnlyFavs((v) => {
      const next = !v;
      SecureStore.setItemAsync(FAVS_FILTER_KEY, next ? "1" : "0").catch(
        () => {},
      );
      return next;
    });
    Haptics.selectionAsync().catch(() => {});
  };

  const switchMarket = useCallback((idx: number) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveMarketIdx(idx);
    SecureStore.setItemAsync(MARKET_TAB_KEY, MARKET_TABS[idx].id).catch(
      () => {},
    );
    listRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  // Tap-on-active-tab: scroll al tope si no estoy arriba; refresh
  // si ya estoy. Mismo patrón que Inicio / Portfolio.
  useEffect(() => {
    return registerTabTap("explore", {
      isAtTop: () => scrollYRef.current <= 8,
      scrollToTop: () =>
        listRef.current?.scrollTo({ y: 0, animated: true }),
      refresh: () => {
        if (!refreshing) onRefresh();
      },
    });
  }, [refreshing, onRefresh]);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.titleRow}>
          <View style={s.titleWithBadge}>
            <Text style={[s.title, { color: c.text }]}>Mercado</Text>
            <MarketClosedIcon
              session={marketSessionByMarket(market.id)}
              size={22}
            />
          </View>
          <View style={s.balanceWrap}>
            <Text style={[s.balanceLabel, { color: c.textFaint }]}>
              Fondos disponibles
            </Text>
            <View style={s.balanceAmountRow}>
              <Text style={[s.balance, { color: c.textSecondary }]}>
                {formatMoney(operable.balance, operable.currency)}
              </Text>
              <Pressable
                onPress={onAddBalance}
                hitSlop={10}
                style={({ pressed }) => [
                  s.addBalanceBtn,
                  {
                    borderColor: c.brand,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                <Feather name="plus" size={11} color={c.brand} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Segmented de mercado (AR / EEUU / Crypto) — componente
            compartido con Portfolio. */}
        <MarketSegmented
          value={market.id as MarketSegmentedValue}
          onChange={(v) => {
            if (v === "all") return;
            const idx = MARKET_TABS.findIndex((m) => m.id === v);
            if (idx >= 0) switchMarket(idx);
          }}
        />

        <View style={s.searchRow}>
          <View
            style={[s.searchBox, { backgroundColor: c.bgWarm }]}
          >
            <MagnifyIcon size={18} color={c.textMuted} strokeWidth={2.4} />
            <TextInput
              ref={searchInputRef}
              style={[s.searchInput, { color: c.text }]}
              placeholder={`Buscar en ${market.label}`}
              placeholderTextColor={c.textMuted}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCapitalize="characters"
              returnKeyType="search"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={10}
                style={[s.clearChip, { backgroundColor: c.borderStrong }]}
              >
                <Feather name="x" size={12} color={c.bg} />
              </Pressable>
            ) : null}
          </View>

          {/* Slot derecha — los dos botones (favoritos / cancelar)
              viven simultáneamente apilados en absoluto y crossfadeean
              por opacity. El ancho del slot también se anima: colapsa
              al ancho de la estrella cuando no hay foco (sin agujero
              entre la barra y el ícono), expande al ancho de
              'Cancelar' cuando el input está activo. */}
          <Animated.View style={[s.rightSlot, { width: slotWidth }]}>
            <Animated.View
              pointerEvents={showCancel ? "none" : "auto"}
              style={[s.rightSlotItem, { opacity: starOpacity }]}
            >
              <Tap
                onPress={toggleFavs}
                hitSlop={8}
                haptic="light"
                style={s.favBtn}
              >
                <FavStar
                  filled={onlyFavs}
                  size={22}
                  outlineColor={c.text}
                />
              </Tap>
            </Animated.View>
            <Animated.View
              pointerEvents={showCancel ? "auto" : "none"}
              style={[s.rightSlotItem, { opacity: cancelOpacity }]}
            >
              <Pressable
                onPress={() => {
                  setQuery("");
                  setSearchFocused(false);
                  searchInputRef.current?.blur();
                }}
                hitSlop={8}
                style={s.cancelBtn}
              >
                <Text style={[s.cancelText, { color: c.brand }]}>
                  Cancelar
                </Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      <MarketBody
        market={market}
        query={query}
        onlyFavs={onlyFavs}
        searchFocused={searchFocused}
        onOpen={openDetail}
        isFavorite={isFavorite}
        listRef={(r) => {
          listRef.current = r;
        }}
        onScrollY={(y) => {
          scrollYRef.current = y;
        }}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
}


/* ─── Body: movers + lista de instrumentos ─── */

function MarketBody({
  market,
  query,
  onlyFavs,
  searchFocused,
  onOpen,
  isFavorite,
  listRef,
  onScrollY,
  refreshing,
  onRefresh,
}: {
  market: MarketTab;
  query: string;
  onlyFavs: boolean;
  searchFocused: boolean;
  onOpen: (a: Asset) => void;
  isFavorite: (t: string) => boolean;
  listRef: (ref: ScrollView | null) => void;
  onScrollY: (y: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { c } = useTheme();
  const router = useRouter();

  const inMarket = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.category !== "efectivo" && assetMarket(a) === market.id,
      ),
    [market.id],
  );

  // Cuando hay query o onlyFavs, mostramos resultados planos.
  // Cuando no, mostramos la lista de categorías como navegación
  // principal (cada row drilling a /(app)/market-category).
  // Excepción: el mercado Crypto tiene una sola categoría — no
  // tiene sentido obligar al user a tappear una pseudo-list de 1
  // ítem; mostramos los assets directo.
  const isCategoryView =
    !query.trim() && !onlyFavs && market.id !== "CRYPTO";

  const visible = useMemo(() => {
    if (isCategoryView) return [];
    const q = query.trim().toLowerCase();
    return inMarket.filter((a) => {
      if (onlyFavs && !isFavorite(a.ticker)) return false;
      if (!q) return true;
      return (
        a.ticker.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
      );
    });
  }, [isCategoryView, query, onlyFavs, isFavorite, inMarket]);

  const topMovers = useMemo(
    () =>
      [...inMarket]
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 8),
    [inMarket],
  );

  const categories = CATEGORIES_BY_MARKET[market.id];

  // Pre-cómputo de cuántos assets matchea cada categoría — usamos
  // este número como display del row si la categoría no trae un
  // count hardcoded del brand.
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const cat of categories) {
      out[cat.slug] = cat.filter
        ? inMarket.filter(cat.filter).length
        : 0;
    }
    return out;
  }, [categories, inMarket]);

  // Vista de "Destacados del día" (estilo Robinhood Trending Lists):
  // grilla 2-col de pills con icon + ticker. Solo aparece cuando el
  // user tappea la barra de búsqueda y todavía no escribió nada
  // — gamificación del onboarding-to-search.
  const isTrendingView =
    searchFocused && !query.trim() && !onlyFavs;

  const eyebrowLabel = query
    ? `${visible.length} resultado${visible.length === 1 ? "" : "s"}`
    : onlyFavs
    ? `Tus favoritos en ${market.short}`
    : isTrendingView
    ? "Destacados del día"
    : isCategoryView
    ? "Categorías"
    : `Instrumentos · ${market.label}`;

  return (
    <ScrollView
      ref={listRef}
      contentContainerStyle={{ paddingBottom: 180 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onScroll={(e) => onScrollY(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      }
    >
      <View style={s.listBlock}>
        <View style={s.sectionHead}>
          <Text style={[s.eyebrow, { color: c.textMuted }]}>
            {eyebrowLabel}
          </Text>
        </View>

        {isTrendingView ? (
          /* Grilla 2-col de destacados — pills con icon redondo +
             ticker + delta pequeñito. Tappear lleva al detalle del
             activo igual que cualquier row. keyboardShouldPersistTaps
             en el ScrollView padre asegura que el primer tap sobre
             una pill registre como onPress (no solo dismiss del
             keyboard). */
          <View style={s.trendingGrid}>
            {topMovers.map((asset, i) => {
              const up = asset.change >= 0;
              return (
                <Reanimated.View
                  key={asset.ticker}
                  entering={FadeInUp.delay(i * 30).duration(220)}
                  exiting={FadeOutDown.duration(140)}
                  style={s.trendingCardWrap}
                >
                <Pressable
                  onPress={() => onOpen(asset)}
                  style={({ pressed }) => [
                    s.trendingCard,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.border,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      s.trendingIcon,
                      {
                        backgroundColor:
                          asset.iconTone === "dark"
                            ? c.ink
                            : asset.iconTone === "accent"
                              ? c.green
                              : c.surfaceSunken,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.trendingIconText,
                        {
                          color:
                            asset.iconTone === "dark"
                              ? c.bg
                              : asset.iconTone === "accent"
                                ? c.ink
                                : c.textSecondary,
                        },
                      ]}
                    >
                      {assetIconCode(asset)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[s.trendingTicker, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {asset.ticker}
                    </Text>
                    <Text
                      style={[
                        s.trendingDelta,
                        { color: up ? c.positive : c.red },
                      ]}
                    >
                      {up ? "▲ " : "▼ "}
                      {formatPct(asset.change, false)}
                    </Text>
                  </View>
                </Pressable>
                </Reanimated.View>
              );
            })}
          </View>
        ) : isCategoryView ? (
          /* Grilla 2-col de categorías — cards con glyph arriba +
             label bold + descripción larga muteada. Tap drilea a
             /market-category con el slug. Estilo inspirado en el
             selector "¿En qué querés invertir?" de IOL. */
          <View style={s.categoryGrid}>
            {categories.map((cat) => (
              <Pressable
                key={cat.slug}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/market-category",
                    params: { slug: cat.slug },
                  })
                }
                style={({ pressed }) => [
                  s.categoryCard,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text
                  style={[s.categoryCardLabel, { color: c.text }]}
                  numberOfLines={2}
                >
                  {cat.label}
                </Text>
                {cat.hint ? (
                  <Text
                    style={[s.categoryCardHint, { color: c.textMuted }]}
                    numberOfLines={3}
                  >
                    {cat.hint}
                  </Text>
                ) : null}
                {cat.count || counts[cat.slug] > 0 ? (
                  <Text
                    style={[s.categoryCardCount, { color: c.textFaint }]}
                  >
                    {cat.count ?? `${counts[cat.slug]} activos`}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : visible.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: c.text }]}>
              {onlyFavs
                ? "Aún no tenés favoritos"
                : "Sin resultados"}
            </Text>
            <Text style={[s.emptySub, { color: c.textMuted }]}>
              {onlyFavs
                ? "Entrá a un activo y tocá la estrella arriba a la derecha para guardarlo."
                : "Probá con otro ticker o nombre."}
            </Text>
          </View>
        ) : (
          visible.map((asset, i) => {
            const fav = isFavorite(asset.ticker);
            const currency = assetCurrency(asset);
            return (
              <Pressable
                key={asset.ticker}
                onPress={() => onOpen(asset)}
                style={[
                  s.row,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <View
                  style={[
                    s.icon,
                    {
                      backgroundColor:
                        asset.iconTone === "dark" ? c.ink : c.surfaceSunken,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.iconText,
                      { color: asset.iconTone === "dark" ? c.bg : c.textSecondary },
                    ]}
                  >
                    {assetIconCode(asset)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.tickerRow}>
                    <Text style={[s.rowTicker, { color: c.text }]}>
                      {asset.ticker}
                    </Text>
                    {fav ? (
                      <Ionicons name="star" size={12} color={c.greenDark} />
                    ) : null}
                  </View>
                  <Text style={[s.rowSub, { color: c.textMuted }]}>
                    {asset.subLabel}
                  </Text>
                </View>
                <View style={s.rowChart}>
                  <MiniSparkline
                    series={seriesFromSeed(
                      asset.ticker,
                      60,
                      asset.change >= 0 ? "up" : "down",
                    )}
                    color={asset.change >= 0 ? c.greenDark : c.red}
                  />
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.rowPrice, { color: c.text }]}>
                    {formatMoney(asset.price, currency)}
                  </Text>
                  {asset.annualYield != null ? (
                    /* FCI: mostramos TNA (o rendimiento 12M para RV)
                       en vez del % del día — mucho más representativo
                       para el usuario cuando mira un fondo. */
                    <Text style={[s.rowYield, { color: c.greenDark }]}>
                      TNA {formatPct(asset.annualYield)}
                    </Text>
                  ) : (
                    <Text
                      style={[
                        s.rowChange,
                        { color: asset.change >= 0 ? c.positive : c.red },
                      ]}
                    >
                      {asset.change >= 0 ? "▲ " : "▼ "}
                      {formatPct(asset.change, false)}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

/* ─── Carrusel horizontal de destacados ─── */

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  /* Fila del título — 'Mercado' a la izq, balance compacto a la
   * derecha. align-items center para que el bloque de balance
   * (eyebrow + monto) quede vertical-centered respecto al título. */
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
  },
  /* Balance chiquito arriba a la derecha — 2 líneas: 'Para operar'
   * (eyebrow) arriba, monto abajo. align-items right para que las
   * dos líneas terminen alineadas a la derecha del header. */
  balanceWrap: {
    alignItems: "flex-end",
  },
  balanceLabel: {
    fontFamily: fontFamily[600],
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.3,
  },
  /* Fila monto + botón '+' — alineados al baseline para que el
   * botón flote a la derecha del último dígito. */
  balanceAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  /* Botón '+' al estilo del WatchlistButton del stock detail —
   * círculo outline con un Feather "plus" en brand green. Sin fill,
   * border 1.4 fino. Compacto (15) para que sea un acento al lado del
   * monto de fondos disponibles, no un botón protagónico. */
  addBalanceBtn: {
    width: 15,
    height: 15,
    borderCurve: "continuous",
    borderRadius: 999,
    borderWidth: 1.4,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    /* Border-radius alineado con el container del segmented (radius.lg)
     * para que ambos elementos del header se sientan parte del mismo
     * sistema visual. Sin border, fondo gris sunken un toque más
     * oscuro que el bg para que se distinga. Padding vertical compacto. */
    borderCurve: "continuous",
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
    padding: 0,
  },
  /* Chip redondo gris dentro del input para limpiar el query — el
   * tap fácil sin tener que apuntar a un ícono fino. */
  clearChip: {
    width: 18,
    height: 18,
    borderCurve: "continuous",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  favBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Container del slot de la derecha. El width se anima desde
   * BaseExplore (slotWidth shared value): 44 colapsado, 86 expandido.
   * Ambos hijos posicionan absolute adentro y se animan por opacity. */
  rightSlot: {
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  rightSlotItem: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  cancelBtn: {
    paddingHorizontal: 6,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  sectionHead: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  listBlock: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: 14,
  },
  /* Row de categoría — icon + label/hint + count + chevron. */
  /* Grilla 'Destacados del día' (Robinhood-style trending lists):
     2 columnas de pills con icon redondo + ticker + delta. Cada
     pill ocupa ~48% del ancho con un gap de 10. */
  trendingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  trendingCardWrap: {
    width: "48.5%",
    flexGrow: 1,
    flexBasis: "48.5%",
  },
  trendingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trendingIcon: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  trendingIconText: {
    fontFamily: fontFamily[800],
    fontSize: 11,
    letterSpacing: -0.1,
  },
  trendingTicker: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  trendingDelta: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  /* Grilla 2-col de cards (estilo selector "En qué invertir" de IOL).
   * Cada card tiene glyph + label + hint + count opcional, todo
   * stack vertical. */
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  categoryCard: {
    width: "48.5%",
    flexGrow: 1,
    flexBasis: "48.5%",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  categoryCardLabel: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    marginTop: 10,
  },
  categoryCardHint: {
    fontFamily: fontFamily[500],
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  categoryCardCount: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 6,
  },
  icon: {
    width: 40,
    height: 40,
    borderCurve: "continuous",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.3,
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowTicker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  rowSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 2,
  },
  rowChart: {
    width: 56,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
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
  rowYield: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
    textAlign: "center",
    lineHeight: 20,
  },
});
