import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useTheme, fontFamily, radius, spacing } from "../../../lib/theme";
import { FlagIcon } from "../../../lib/components/FlagIcon";

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
import { CategoryGlyph } from "../../../lib/components/CategoryGlyph";
import { CATEGORIES_BY_MARKET } from "../../../lib/data/marketCategories";
import { MiniSparkline, seriesFromSeed } from "../../../lib/components/Sparkline";
import { Tap } from "../../../lib/components/Tap";

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

/**
 * Formatter para el balance de 'Disponible para operar' del header.
 * Convención de prefix unificado: ARS '$', USD 'US$', USDT 'USDT'
 * — todos delante del número (a diferencia del formatUSD/formatUSDT
 * canónicos, que los ponen al final). Convención del header del
 * Mercado solamente.
 */
function formatOperable(n: number, currency: AssetCurrency): string {
  const opts =
    currency === "ARS"
      ? undefined
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const num = Math.abs(n).toLocaleString("es-AR", opts);
  if (currency === "ARS") return `$ ${num}`;
  if (currency === "USD") return `US$ ${num}`;
  return `USDT ${num}`;
}

function BaseExplore() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode } = useTheme();
  const isDark = mode === "dark";
  const { isFavorite } = useFavorites();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

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

  // Tap sobre la tab Mercado estando en Mercado → scroll al tope
  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (!isFocused) return;
      listRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation, isFocused]);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: c.text }]}>Mercado</Text>
          <View style={s.balanceWrap}>
            <Text style={[s.balanceLabel, { color: c.textFaint }]}>
              Disponible para operar
            </Text>
            <View style={s.balanceAmountRow}>
              <Text style={[s.balance, { color: c.textSecondary }]}>
                {formatOperable(operable.balance, operable.currency)}
              </Text>
              <Pressable
                onPress={onAddBalance}
                hitSlop={10}
                style={({ pressed }) => [
                  s.addBalanceBtn,
                  {
                    backgroundColor: c.brandDim,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="plus-thick"
                  size={12}
                  color={c.brand}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Segmented de mercado (AR / EEUU / Crypto). Sin pills de
            categorías abajo — el filtro por categoría se eliminó.
            La pill activa usa el mismo verde brand translúcido que la
            tab activa del nav bar para mantener identidad visual. */}
        <View
          style={[
            s.marketControl,
            { backgroundColor: c.surfaceHover },
          ]}
        >
          <View style={s.marketSeg}>
            {MARKET_TABS.map((m, i) => {
              const active = i === activeMarketIdx;
              return (
                <Tap
                  key={m.id}
                  onPress={() => switchMarket(i)}
                  haptic="selection"
                  pressScale={0.96}
                  rippleContained
                  style={[
                    s.marketSegBtn,
                    active && {
                      backgroundColor: isDark
                        ? "rgba(14, 203, 129, 0.14)"
                        : "rgba(0, 200, 5, 0.10)",
                      borderColor: isDark
                        ? "rgba(14, 203, 129, 0.20)"
                        : "rgba(0, 200, 5, 0.16)",
                      borderWidth: 1,
                    },
                  ]}
                >
                  <MarketGlyph market={m.id} active={active} />
                  <Text
                    style={[
                      s.marketSegLabel,
                      {
                        color: active ? c.brand : c.textMuted,
                        fontFamily: active
                          ? fontFamily[800]
                          : fontFamily[600],
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {m.short}
                  </Text>
                </Tap>
              );
            })}
          </View>
        </View>

        <View style={s.searchRow}>
          <View
            style={[
              s.searchBox,
              { backgroundColor: c.surfaceHover, borderColor: c.border },
            ]}
          >
            <MagnifyIcon size={20} color={c.textMuted} strokeWidth={3} />
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
      />
    </View>
  );
}

/* ─── Glyph del mercado para los segmented tabs ─── */

function MarketGlyph({
  market,
  active,
}: {
  market: AssetMarket;
  /** Cuando active=true, le aplicamos una capa verde sutil al glyph
   *  para diferenciar claramente el mercado seleccionado del que no.
   *  Para AR/US es un overlay round (pill) sobre la bandera; para
   *  crypto, como ya es un pill verde brand, no hace falta. */
  active?: boolean;
}) {
  const { c } = useTheme();
  if (market === "AR" || market === "US") {
    return (
      <View style={gs.flagWrap}>
        <FlagIcon code={market === "AR" ? "AR" : "US"} size={18} />
        {active ? (
          <View
            pointerEvents="none"
            style={[
              gs.flagTint,
              { backgroundColor: "rgba(0, 200, 5, 0.10)" },
            ]}
          />
        ) : null}
      </View>
    );
  }
  // Crypto: pill verde con ₿ — no hay bandera, así que armamos un
  // glyph que mantenga el peso visual de las dos primeras opciones.
  // Como el bg ya es verde brand, no necesita el tint extra.
  return (
    <View
      style={[gs.cryptoBadge, { backgroundColor: c.greenDark }]}
    >
      <Text style={[gs.cryptoBadgeText, { color: c.bg }]}>₿</Text>
    </View>
  );
}

const gs = StyleSheet.create({
  flagWrap: {
    width: 18,
    height: 18,
    position: "relative",
  },
  /* Overlay verde sutil sobre la bandera del mercado activo —
   * 22% de alpha para que tinte sin tapar. Round-pill matching
   * la bandera (que tiene borderRadius 999). */
  flagTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
  },
  cryptoBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cryptoBadgeText: {
    fontFamily: fontFamily[800],
    fontSize: 11,
    lineHeight: 13,
  },
});

/* ─── Body: movers + lista de instrumentos ─── */

function MarketBody({
  market,
  query,
  onlyFavs,
  searchFocused,
  onOpen,
  isFavorite,
  listRef,
}: {
  market: MarketTab;
  query: string;
  onlyFavs: boolean;
  searchFocused: boolean;
  onOpen: (a: Asset) => void;
  isFavorite: (t: string) => boolean;
  listRef: (ref: ScrollView | null) => void;
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
    ? `Categorías · ${market.label}`
    : `Instrumentos · ${market.label}`;

  return (
    <ScrollView
      ref={listRef}
      contentContainerStyle={{ paddingBottom: 180 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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
            {topMovers.map((asset) => {
              const up = asset.change >= 0;
              return (
                <Pressable
                  key={asset.ticker}
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
              );
            })}
          </View>
        ) : isCategoryView ? (
          /* Lista de categorías — cada una drilling a la pantalla
             /market-category con el slug en los params. */
          categories.map((cat, i) => (
            <Pressable
              key={cat.slug}
              onPress={() =>
                router.push({
                  pathname: "/(app)/market-category",
                  params: { slug: cat.slug },
                })
              }
              style={[
                s.categoryRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.border,
                },
              ]}
            >
              <CategoryGlyph slug={cat.slug} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[s.categoryRowLabel, { color: c.text }]}>
                  {cat.label}
                </Text>
                {cat.hint ? (
                  <Text
                    style={[s.categoryRowHint, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {cat.hint}
                  </Text>
                ) : null}
              </View>
              {cat.count || counts[cat.slug] > 0 ? (
                <Text
                  style={[s.categoryRowCount, { color: c.textMuted }]}
                >
                  {cat.count ?? `${counts[cat.slug]}`}
                </Text>
              ) : null}
              <Feather
                name="chevron-right"
                size={18}
                color={c.textFaint}
              />
            </Pressable>
          ))
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
                      28,
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
  /* Botón '+' alamos-style — pill chiquita con tint verde brand
   * (c.brandDim) y un plus-thick adentro en c.brand. Mismo
   * lenguaje que los acentos verdes del resto de la app. */
  addBalanceBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  marketControl: {
    borderRadius: radius.lg,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 14,
  },
  marketSeg: {
    flexDirection: "row",
    gap: 2,
  },
  marketSegBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  marketSegLabel: {
    fontSize: 13,
    letterSpacing: -0.1,
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
    borderWidth: 1,
    /* Bordes menos redondeados (era radius.pill ≈ 999): pasa a md
     * para que el rectángulo se sienta más estructurado, estilo iOS
     * search. */
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
  trendingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "48.5%",
    flexGrow: 1,
    flexBasis: "48.5%",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trendingIcon: {
    width: 36,
    height: 36,
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
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  categoryRowLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  categoryRowHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  categoryRowCount: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
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
