import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
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
import { CryptoIcon } from "../../../lib/components/CryptoIcon";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";

/** Mismo verde brand que usa el ActionButton del home — ver
 *  app/(app)/(tabs)/index.tsx (BRAND_GREEN). */
const BRAND_GREEN = "#5ac43e";

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
import { MiniSparkline, seriesFromSeed } from "../../../lib/components/Sparkline";
import { ProMarkets } from "../../../lib/components/pro/ProMarkets";
import { useProMode } from "../../../lib/pro/context";
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
  const { isPro } = useProMode();
  if (isPro) return <ProMarkets />;
  return <BaseExplore />;
}

function BaseExplore() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { isFavorite } = useFavorites();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [query, setQuery] = useState("");
  const [activeMarketIdx, setActiveMarketIdx] = useState(0);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const listRef = useRef<ScrollView | null>(null);

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
        <Text style={[s.title, { color: c.text }]}>Mercado</Text>

        {/* Segmented tabs de mercado — el "switch" entre AR / EE.UU /
            Crypto. Estilo iOS-like: track crema, pill activa blanca
            elevada con sombra sutil. */}
        <View
          style={[
            s.marketSeg,
            { backgroundColor: c.surfaceHover },
          ]}
        >
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
                  active && [
                    s.marketSegBtnActive,
                    { backgroundColor: c.surface },
                  ],
                ]}
              >
                <MarketGlyph market={m.id} active={active} />
                <Text
                  style={[
                    s.marketSegLabel,
                    {
                      color: active ? c.text : c.textMuted,
                      fontFamily: active ? fontFamily[700] : fontFamily[600],
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

        <View style={s.searchRow}>
          <View
            style={[
              s.searchBox,
              { backgroundColor: c.surfaceHover, borderColor: c.border },
            ]}
          >
            <Feather name="search" size={16} color={c.textMuted} />
            <TextInput
              style={[s.searchInput, { color: c.text }]}
              placeholder={`Buscar en ${market.label}`}
              placeholderTextColor={c.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <Feather name="x" size={16} color={c.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <Tap
            onPress={toggleFavs}
            hitSlop={8}
            haptic="light"
            style={[
              s.favBtn,
              { backgroundColor: c.surfaceHover, borderColor: c.border },
            ]}
          >
            <Ionicons
              name={onlyFavs ? "star" : "star-outline"}
              size={18}
              color={onlyFavs ? c.greenDark : c.text}
            />
          </Tap>
        </View>
      </View>

      <MarketBody
        market={market}
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

/* ─── Card de fondos disponibles para operar ─── */

function AvailableFundsCard({ market }: { market: MarketTab }) {
  const { c } = useTheme();
  const router = useRouter();

  // Sumamos todas las cuentas en la moneda del mercado activo. Para
  // USD esto agrupa la cuenta argentina y la cuenta US.
  const balance = useMemo(
    () =>
      accounts
        .filter((a) => a.currency === market.currency)
        .reduce((s, a) => s + a.balance, 0),
    [market.currency],
  );

  const prefix =
    market.currency === "USD"
      ? "US$"
      : market.currency === "USDT"
      ? "USDT"
      : "$";

  return (
    <View
      style={[
        fs.card,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <CurrencyMark currency={market.currency} />
      <AmountDisplay
        value={balance}
        size={20}
        weight={700}
        prefix={prefix}
        style={fs.amount}
      />
      <Tap
        onPress={() =>
          router.push({
            pathname: "/(app)/transfer",
            params: { mode: "deposit" },
          })
        }
        haptic="medium"
        pressScale={0.95}
        style={[fs.ingresarBtn, { backgroundColor: BRAND_GREEN }]}
      >
        <Feather name="arrow-down-left" size={13} color="#FFFFFF" />
        <Text style={fs.ingresarBtnText}>Ingresar</Text>
      </Tap>
    </View>
  );
}

/** Logo del país (AR/US) o de Tether (USDT) que va adelante del saldo.
 *  Mismo tamaño y patrón que usa el hero del home. */
function CurrencyMark({ currency }: { currency: AssetCurrency }) {
  if (currency === "ARS") return <FlagIcon code="AR" size={24} />;
  if (currency === "USD") return <FlagIcon code="US" size={24} />;
  return (
    <CryptoIcon
      ticker="USDT"
      iconText="₮"
      bg="#26A17B"
      fg="#FFFFFF"
      size={24}
    />
  );
}

const fs = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
  },
  amount: {
    flex: 1,
  },
  ingresarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: radius.md,
  },
  ingresarBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
    color: "#FFFFFF",
  },
});

/* ─── Body: card de fondos + movers + lista de instrumentos ─── */

function MarketBody({
  market,
  query,
  onlyFavs,
  onOpen,
  isFavorite,
  listRef,
}: {
  market: MarketTab;
  query: string;
  onlyFavs: boolean;
  onOpen: (a: Asset) => void;
  isFavorite: (t: string) => boolean;
  listRef: (ref: ScrollView | null) => void;
}) {
  const { c } = useTheme();

  // Categoría activa dentro del mercado. "todo" = sin sub-filtro.
  // Se resetea cuando cambia el mercado para que no quede pegada una
  // categoría que no aplica (ej: pasar de AR/CEDEARs a US, donde no
  // hay CEDEARs).
  const [activeCategory, setActiveCategory] = useState<
    AssetCategory | "todo"
  >("todo");
  useEffect(() => {
    setActiveCategory("todo");
  }, [market.id]);

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
      <AvailableFundsCard market={market} />

      {/* Categorías dentro del mercado activo. Pills horizontales
          scrolleables — la primera ("Todo") está al ras del padding
          izquierdo para que no haya un hueco vacío al arrancar. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.categoryRow}
        contentContainerStyle={s.categoryContent}
      >
        {market.categories.map((cat) => {
          const active = cat.id === activeCategory;
          return (
            <Tap
              key={cat.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveCategory(cat.id);
              }}
              haptic="selection"
              pressScale={0.94}
              style={[
                s.categoryPill,
                {
                  backgroundColor: active ? c.text : c.surfaceHover,
                  borderColor: active ? c.text : c.border,
                },
              ]}
            >
              <Text
                style={[
                  s.categoryLabel,
                  { color: active ? c.bg : c.textSecondary },
                ]}
              >
                {cat.label}
              </Text>
            </Tap>
          );
        })}
      </ScrollView>

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
                        { color: asset.change >= 0 ? c.greenDark : c.red },
                      ]}
                    >
                      {formatPct(asset.change)}
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
                  { color: up ? c.greenDark : c.red },
                ]}
              >
                {formatPct(asset.change)}
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
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    marginBottom: 14,
  },
  marketSeg: {
    flexDirection: "row",
    borderRadius: radius.pill,
    padding: 4,
    gap: 2,
    marginBottom: 14,
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
  marketSegBtnActive: {
    // Sombra sutil para que la pill activa "flote" sobre el track crema —
    // mismo feel que el toggle Dinero/Portfolio del home y los segmented
    // controls de iOS.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
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
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
    padding: 0,
  },
  favBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryRow: {
    marginTop: 14,
  },
  categoryContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  categoryLabel: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.05,
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
