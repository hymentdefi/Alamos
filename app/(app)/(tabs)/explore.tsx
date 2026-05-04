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
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useTheme, fontFamily, radius, spacing } from "../../../lib/theme";
import { AutoMarquee } from "../../../lib/components/AutoMarquee";
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
    };
  }, [activeMarketIdx]);

  // Animación cross-fade entre la estrella de favoritos y el botón
  // 'Cancelar' cuando el input de búsqueda gana/pierde foco. Antes era
  // un swap brusco (un Pressable se desmontaba y el otro se montaba),
  // ahora ambos viven siempre en el árbol pero su opacidad/scale se
  // anima en useNativeDriver.
  const showCancel = searchFocused || query.length > 0;
  const cancelOpacity = useRef(new Animated.Value(0)).current;
  const starOpacity = useRef(new Animated.Value(1)).current;
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
    ]).start();
  }, [showCancel, cancelOpacity, starOpacity]);

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
              Para operar
            </Text>
            <Text style={[s.balance, { color: c.textSecondary }]}>
              {formatMoney(operable.balance, operable.currency)}
            </Text>
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

          {/* Slot fijo de la derecha — los dos botones (favoritos /
              cancelar) viven simultáneamente apilados en absoluto y
              crossfadeean por opacity. pointerEvents bloquea taps al
              que está fading-out así no compiten. */}
          <View style={s.rightSlot}>
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
          </View>
        </View>
      </View>

      <MarketBody
        market={market}
        activeCategory="todo"
        query={query}
        onlyFavs={onlyFavs}
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
}: {
  market: AssetMarket;
  /** Reservado por compatibilidad — el glyph mantiene los mismos
   *  colores en estado activo e inactivo desde que el segmented pasó
   *  a estilo iOS (track crema + pill blanca). */
  active?: boolean;
}) {
  const { c } = useTheme();
  if (market === "AR") return <FlagIcon code="AR" size={18} />;
  if (market === "US") return <FlagIcon code="US" size={18} />;
  // Crypto: pill verde con ₿ — no hay bandera, así que armamos un
  // glyph que mantenga el peso visual de las dos primeras opciones.
  return (
    <View
      style={[gs.cryptoBadge, { backgroundColor: c.greenDark }]}
    >
      <Text style={[gs.cryptoBadgeText, { color: c.bg }]}>₿</Text>
    </View>
  );
}

const gs = StyleSheet.create({
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
  activeCategory,
  query,
  onlyFavs,
  onOpen,
  isFavorite,
  listRef,
}: {
  market: MarketTab;
  activeCategory: AssetCategory | "todo";
  query: string;
  onlyFavs: boolean;
  onOpen: (a: Asset) => void;
  isFavorite: (t: string) => boolean;
  listRef: (ref: ScrollView | null) => void;
}) {
  const { c } = useTheme();

  const inMarket = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.category !== "efectivo" && assetMarket(a) === market.id,
      ),
    [market.id],
  );

  // Filtramos primero por categoría dentro del mercado, después por
  // search/onlyFavs. Los movers también respetan la categoría activa.
  const inCategory = useMemo(
    () =>
      activeCategory === "todo"
        ? inMarket
        : inMarket.filter((a) => a.category === activeCategory),
    [inMarket, activeCategory],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inCategory.filter((a) => {
      if (onlyFavs && !isFavorite(a.ticker)) return false;
      if (!q) return true;
      return (
        a.ticker.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
      );
    });
  }, [query, onlyFavs, isFavorite, inCategory]);

  const topMovers = useMemo(
    () =>
      [...inCategory]
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 8),
    [inCategory],
  );

  const activeCategoryLabel =
    market.categories.find((cat) => cat.id === activeCategory)?.label ??
    "Todo";

  const eyebrowLabel = query
    ? `${visible.length} resultado${visible.length === 1 ? "" : "s"}`
    : onlyFavs
    ? `Tus favoritos en ${market.short}`
    : activeCategory === "todo"
    ? `Instrumentos · ${market.label}`
    : `${activeCategoryLabel} · ${market.short}`;

  const showMovers = !query && !onlyFavs && activeCategory === "todo";

  return (
    <ScrollView
      ref={listRef}
      contentContainerStyle={{ paddingBottom: 180 }}
      showsVerticalScrollIndicator={false}
    >
      {showMovers && topMovers.length > 0 ? (
        <View style={s.moversBlock}>
          <View style={s.sectionHead}>
            <Text style={[s.eyebrow, { color: c.textMuted }]}>
              Destacados del día
            </Text>
          </View>
          <MoversMarquee movers={topMovers} onOpen={onOpen} />
        </View>
      ) : null}

      <View style={s.listBlock}>
        <View style={s.sectionHead}>
          <Text style={[s.eyebrow, { color: c.textMuted }]}>
            {eyebrowLabel}
          </Text>
        </View>

        {visible.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: c.text }]}>
              {onlyFavs
                ? "Aún no tenés favoritos"
                : query
                ? "Sin resultados"
                : `Todavía no hay instrumentos en ${market.label}`}
            </Text>
            <Text style={[s.emptySub, { color: c.textMuted }]}>
              {onlyFavs
                ? "Entrá a un activo y tocá la estrella arriba a la derecha para guardarlo."
                : query
                ? "Probá con otro ticker o nombre."
                : "Pronto vamos a sumar más opciones."}
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

const CARD_W = 160;
const GAP = 12;

function MoversMarquee({
  movers,
  onOpen,
}: {
  movers: Asset[];
  onOpen: (a: Asset) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={s.marqueeWrap}>
      <AutoMarquee speed={32} contentStyle={s.marqueeTrack}>
        {movers.map((asset) => {
          const up = asset.change >= 0;
          const currency = assetCurrency(asset);
          return (
            <Pressable
              key={asset.ticker}
              onPress={() => onOpen(asset)}
              style={[
                s.moverCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[s.moverTicker, { color: c.text }]}>
                {asset.ticker}
              </Text>
              <Text
                style={[s.moverSub, { color: c.textMuted }]}
                numberOfLines={1}
              >
                {asset.name}
              </Text>
              <Text style={[s.moverPrice, { color: c.text }]}>
                {formatMoney(asset.price, currency)}
              </Text>
              <Text
                style={[
                  s.moverChange,
                  { color: up ? c.positive : c.red },
                ]}
              >
                {up ? "▲ " : "▼ "}
                {formatPct(asset.change, false)}
              </Text>
            </Pressable>
          );
        })}
      </AutoMarquee>
    </View>
  );
}

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
  /* Container del slot de la derecha — ancho mínimo igual al ancho
   * del Cancelar (la palabra más larga de los dos), así no hay jump
   * de layout cuando crossfadea. Ambos hijos posicionan absolute
   * adentro y se animan por opacity. */
  rightSlot: {
    minWidth: 78,
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
  moversBlock: {
    paddingTop: 24,
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
  marqueeWrap: {
    overflow: "hidden",
    paddingVertical: 4,
  },
  marqueeTrack: {
    flexDirection: "row",
    gap: GAP,
    paddingHorizontal: 20,
  },
  moverCard: {
    width: CARD_W,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    gap: 2,
  },
  moverTicker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  moverSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginBottom: 10,
  },
  moverPrice: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  moverChange: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    marginTop: 2,
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
