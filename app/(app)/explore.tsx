import { useState, useMemo, useRef } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet,
  Dimensions, Animated, Image, FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── Market indices ─── */
interface MarketIndex {
  name: string;
  value: string;
  change: number;
}

const marketIndices: MarketIndex[] = [
  { name: "MERVAL", value: "1.842.350", change: 1.24 },
  { name: "Dólar CCL", value: "1.285", change: -0.32 },
  { name: "Dólar MEP", value: "1.247", change: 0.15 },
  { name: "Riesgo País", value: "782", change: -2.41 },
];

/* ─── News items ─── */
interface NewsItem {
  id: string;
  source: string;
  time: string;
  headline: string;
  relatedTickers?: { ticker: string; change: number }[];
}

const newsItems: NewsItem[] = [
  {
    id: "1",
    source: "Ámbito Financiero",
    time: "2h",
    headline: "El MERVAL alcanzó un nuevo máximo histórico impulsado por acciones energéticas y bancarias",
    relatedTickers: [
      { ticker: "YPFD", change: 4.21 },
      { ticker: "GGAL", change: 3.15 },
    ],
  },
  {
    id: "2",
    source: "Infobae Economía",
    time: "3h",
    headline: "El dólar CCL retrocede y la brecha cambiaria se ubica por debajo del 15%",
    relatedTickers: [
      { ticker: "GD30", change: 1.87 },
      { ticker: "AL30", change: 0.62 },
    ],
  },
  {
    id: "3",
    source: "El Cronista",
    time: "5h",
    headline: "Milei confirmó que el cepo cambiario se levantará antes de fin de año: qué espera el mercado",
    relatedTickers: [
      { ticker: "GGAL", change: 3.15 },
    ],
  },
  {
    id: "4",
    source: "Bloomberg Línea",
    time: "6h",
    headline: "Apple reportó ingresos récord y los CEDEARs tecnológicos suben con fuerza en Buenos Aires",
    relatedTickers: [
      { ticker: "AAPL.BA", change: 0.78 },
      { ticker: "MSFT.BA", change: 0.43 },
    ],
  },
  {
    id: "5",
    source: "La Nación",
    time: "8h",
    headline: "Los bonos soberanos en dólares extienden su rally: el riesgo país perforó los 800 puntos",
    relatedTickers: [
      { ticker: "GD30", change: 1.87 },
      { ticker: "AL30", change: 0.62 },
    ],
  },
];

/* ─── Daily movers ─── */
interface Mover {
  ticker: string;
  name: string;
  change: number;
}

const dailyMovers: Mover[] = [
  { ticker: "YPFD", name: "YPF", change: 4.21 },
  { ticker: "TXAR", name: "Ternium", change: 3.15 },
  { ticker: "COME", name: "Comercial del Plata", change: 2.94 },
  { ticker: "PAMP", name: "Pampa Energía", change: -0.45 },
  { ticker: "ALUA", name: "Aluar", change: -1.33 },
  { ticker: "TSLA.BA", name: "Tesla CEDEAR", change: -2.17 },
];

/* ─── Investment categories for search ─── */
interface InvestCategory {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tickers: { ticker: string; price: number }[];
}

const investCategories: InvestCategory[] = [
  {
    title: "20 CEDEARs más populares",
    description: "Los CEDEARs más operados del mercado argentino.",
    icon: "trending-up",
    tickers: [
      { ticker: "AAPL.BA", price: 32150 },
      { ticker: "AMZN.BA", price: 28470 },
      { ticker: "TSLA.BA", price: 14890 },
      { ticker: "MSFT.BA", price: 27830 },
      { ticker: "GOOGL.BA", price: 19650 },
    ],
  },
  {
    title: "Inversiones recurrentes populares",
    description: "Ideales para invertir de forma automática.",
    icon: "repeat",
    tickers: [
      { ticker: "YPFD", price: 45280 },
      { ticker: "GD30", price: 72340 },
      { ticker: "AAPL.BA", price: 32150 },
    ],
  },
  {
    title: "100 más populares",
    description: "Los activos más operados en el mercado.",
    icon: "flame",
    tickers: [
      { ticker: "YPFD", price: 45280 },
      { ticker: "GGAL", price: 8450 },
      { ticker: "ALUA", price: 1842 },
      { ticker: "COME", price: 562 },
    ],
  },
  {
    title: "Energía",
    description: "Empresas del sector energético argentino.",
    icon: "flash",
    tickers: [
      { ticker: "YPFD", price: 45280 },
      { ticker: "PAMP", price: 5890 },
    ],
  },
  {
    title: "Tecnología",
    description: "Accedé a gigantes tech vía CEDEARs.",
    icon: "hardware-chip",
    tickers: [
      { ticker: "AAPL.BA", price: 32150 },
      { ticker: "MSFT.BA", price: 27830 },
      { ticker: "GOOGL.BA", price: 19650 },
      { ticker: "AMZN.BA", price: 28470 },
    ],
  },
  {
    title: "Bonos soberanos",
    description: "Bonos del gobierno argentino en dólares y pesos.",
    icon: "document-text",
    tickers: [
      { ticker: "GD30", price: 72340 },
      { ticker: "AL30", price: 68420 },
    ],
  },
  {
    title: "Materiales e industria",
    description: "Empresas industriales y de materiales.",
    icon: "construct",
    tickers: [
      { ticker: "ALUA", price: 1842 },
      { ticker: "TXAR", price: 3240 },
    ],
  },
];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchFade = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  const openSearch = () => {
    setShowSearch(true);
    Animated.timing(searchFade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  };

  const closeSearch = () => {
    Animated.timing(searchFade, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowSearch(false);
      setSearchQuery("");
    });
  };

  const openDetail = (ticker: string) => {
    router.push({ pathname: "/(app)/detail", params: { ticker } });
  };

  /* Filtered categories for search */
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return investCategories;
    const q = searchQuery.toLowerCase();
    return investCategories.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.tickers.some((t) => t.ticker.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  /* Filtered assets for search results */
  const filteredAssets = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.ticker.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <View style={s.container}>
      {/* ── Main Browse View ── */}
      <ScrollView
        style={s.mainScroll}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={s.screenTitle}>Explorar</Text>
          <View style={s.topBarRight}>
            <Pressable onPress={openSearch}>
              <Ionicons name="search" size={24} color={colors.text.primary} />
            </Pressable>
            <Pressable>
              <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* ── Market indices row ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.indicesScroll}
        >
          {marketIndices.map((idx) => {
            const isUp = idx.change >= 0;
            return (
              <View key={idx.name} style={s.indexCard}>
                <Text style={s.indexName}>{idx.name}</Text>
                <Text style={s.indexValue}>{idx.value}</Text>
                <Text style={[s.indexChange, { color: isUp ? colors.brand[500] : colors.red }]}>
                  {isUp ? "+" : ""}{idx.change.toFixed(2)}%
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── News section ── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Noticias</Text>
            <Pressable>
              <Text style={s.sectionAction}>Ver más</Text>
            </Pressable>
          </View>

          {newsItems.map((item, idx) => (
            <View key={item.id}>
              <Pressable style={s.newsRow}>
                <View style={s.newsContent}>
                  <View style={s.newsMeta}>
                    <Text style={s.newsSource}>{item.source}</Text>
                    <Text style={s.newsDot}>·</Text>
                    <Text style={s.newsTime}>{item.time}</Text>
                  </View>
                  <Text style={s.newsHeadline} numberOfLines={3}>
                    {item.headline}
                  </Text>
                  {item.relatedTickers && (
                    <View style={s.newsTickerRow}>
                      {item.relatedTickers.map((rt) => {
                        const isUp = rt.change >= 0;
                        return (
                          <Pressable
                            key={rt.ticker}
                            style={s.newsTickerPill}
                            onPress={() => openDetail(rt.ticker)}
                          >
                            <Text style={s.newsTickerName}>{rt.ticker}</Text>
                            <Text
                              style={[
                                s.newsTickerChange,
                                { color: isUp ? colors.brand[500] : colors.red },
                              ]}
                            >
                              {isUp ? "+" : ""}{rt.change.toFixed(2)}%
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
                {/* News image placeholder */}
                <View style={s.newsImagePlaceholder}>
                  <Ionicons name="newspaper-outline" size={24} color={colors.text.muted} />
                </View>
              </Pressable>
              {idx < newsItems.length - 1 && <View style={s.newsItemDivider} />}
            </View>
          ))}
        </View>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Daily Movers ── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Movimientos del día</Text>
            <Pressable>
              <Text style={s.sectionAction}>Ver más</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.moversScroll}
          >
            {dailyMovers.map((m) => {
              const isUp = m.change >= 0;
              return (
                <Pressable
                  key={m.ticker}
                  style={s.moverCard}
                  onPress={() => openDetail(m.ticker)}
                >
                  {/* Icon circle */}
                  <View style={[s.moverIcon, { backgroundColor: isUp ? colors.accentDim : colors.redDim }]}>
                    <Text style={s.moverIconText}>
                      {m.ticker.substring(0, 2)}
                    </Text>
                  </View>
                  <Text style={s.moverTicker}>{m.ticker}</Text>
                  <Text style={s.moverName} numberOfLines={1}>{m.name}</Text>
                  {/* Mini chart placeholder */}
                  <View style={s.moverChartArea}>
                    <View style={[s.moverChartLine, { backgroundColor: isUp ? colors.brand[500] : colors.red }]} />
                  </View>
                  <Text style={[s.moverChange, { color: isUp ? colors.brand[500] : colors.red }]}>
                    {isUp ? "+" : ""}{m.change.toFixed(2)}%
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Find investments preview ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Encontrá inversiones</Text>
          <Text style={s.findSubtitle}>
            Explorá por categoría o buscá un activo específico.
          </Text>

          <Pressable style={s.findSearchBar} onPress={openSearch}>
            <Ionicons name="search" size={18} color={colors.text.muted} />
            <Text style={s.findSearchPlaceholder}>Buscar activos...</Text>
          </Pressable>

          {/* Category previews */}
          {investCategories.slice(0, 4).map((cat) => (
            <Pressable key={cat.title} style={s.categoryRow}>
              <View style={s.categoryIconWrap}>
                <Ionicons name={cat.icon} size={20} color={colors.brand[500]} />
              </View>
              <View style={s.categoryInfo}>
                <Text style={s.categoryTitle}>{cat.title}</Text>
                <Text style={s.categoryDesc} numberOfLines={1}>{cat.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            </Pressable>
          ))}

          <Pressable style={s.showAllBtn} onPress={openSearch}>
            <Text style={s.showAllText}>Ver todas las categorías</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Search overlay ── */}
      {showSearch && (
        <Animated.View style={[s.searchOverlay, { opacity: searchFade, paddingTop: insets.top }]}>
          {/* Search header */}
          <View style={s.searchHeader}>
            <Pressable style={s.searchCloseBtn} onPress={closeSearch}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </Pressable>
            <View style={s.searchInputWrap}>
              <Ionicons name="search" size={18} color={colors.text.muted} />
              <TextInput
                ref={searchInputRef}
                style={s.searchInput}
                placeholder="Buscar activos..."
                placeholderTextColor={colors.text.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color={colors.text.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Search results */}
          <ScrollView
            style={s.searchResults}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Direct asset matches */}
            {filteredAssets.length > 0 && (
              <View style={s.searchSection}>
                <Text style={s.searchSectionTitle}>Activos</Text>
                {filteredAssets.map((a) => {
                  const isUp = a.change >= 0;
                  return (
                    <Pressable
                      key={a.ticker}
                      style={s.searchAssetRow}
                      onPress={() => {
                        closeSearch();
                        openDetail(a.ticker);
                      }}
                    >
                      <View style={s.searchAssetIcon}>
                        <Text style={s.searchAssetIconText}>
                          {a.ticker.substring(0, 2)}
                        </Text>
                      </View>
                      <View style={s.searchAssetInfo}>
                        <Text style={s.searchAssetTicker}>{a.ticker}</Text>
                        <Text style={s.searchAssetName} numberOfLines={1}>{a.name}</Text>
                      </View>
                      <View style={s.searchAssetPriceCol}>
                        <Text style={s.searchAssetPrice}>{formatARS(a.price)}</Text>
                        <Text style={[s.searchAssetChange, { color: isUp ? colors.brand[500] : colors.red }]}>
                          {isUp ? "+" : ""}{a.change.toFixed(2)}%
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Categories */}
            {filteredCategories.map((cat) => (
              <View key={cat.title} style={s.searchCategoryBlock}>
                <View style={s.searchCategoryHeader}>
                  <View style={s.searchCategoryIconWrap}>
                    <Ionicons name={cat.icon} size={18} color={colors.brand[500]} />
                  </View>
                  <View style={s.searchCategoryHeaderInfo}>
                    <Text style={s.searchCategoryTitle}>{cat.title}</Text>
                    <Text style={s.searchCategoryDesc}>{cat.description}</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.tickerPillsScroll}
                >
                  {cat.tickers.map((t) => (
                    <Pressable
                      key={t.ticker}
                      style={s.tickerPill}
                      onPress={() => {
                        closeSearch();
                        openDetail(t.ticker);
                      }}
                    >
                      <Text style={s.tickerPillTicker}>{t.ticker}</Text>
                      <Text style={s.tickerPillPrice}>{formatARS(t.price)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ))}

            {searchQuery.length > 0 && filteredAssets.length === 0 && filteredCategories.length === 0 && (
              <View style={s.noResults}>
                <Text style={s.noResultsText}>No se encontraron resultados</Text>
                <Text style={s.noResultsHint}>Probá con otro nombre o ticker</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  mainScroll: { flex: 1 },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "300",
    color: colors.text.secondary,
    letterSpacing: -0.5,
  },
  topBarRight: { flexDirection: "row", gap: 20 },

  /* Market indices */
  indicesScroll: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 16,
  },
  indexCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 130,
  },
  indexName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 4,
  },
  indexValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 2,
  },
  indexChange: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* Shared */
  divider: {
    height: 6,
    backgroundColor: colors.surface[100],
    marginVertical: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    textDecorationLine: "underline",
  },

  /* News */
  newsRow: {
    flexDirection: "row",
    paddingVertical: 14,
    gap: 14,
  },
  newsContent: {
    flex: 1,
  },
  newsMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  newsSource: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  newsDot: {
    fontSize: 12,
    color: colors.text.muted,
  },
  newsTime: {
    fontSize: 12,
    color: colors.text.muted,
  },
  newsHeadline: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    lineHeight: 21,
  },
  newsTickerRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  newsTickerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface[100],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  newsTickerName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.primary,
  },
  newsTickerChange: {
    fontSize: 12,
    fontWeight: "600",
  },
  newsImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
  },
  newsItemDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  /* Daily Movers */
  moversScroll: {
    gap: 12,
    paddingRight: 20,
  },
  moverCard: {
    width: 140,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: "center",
  },
  moverIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  moverIconText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text.primary,
  },
  moverTicker: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 2,
  },
  moverName: {
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 8,
    textAlign: "center",
  },
  moverChartArea: {
    width: "100%",
    height: 32,
    justifyContent: "center",
    marginBottom: 8,
  },
  moverChartLine: {
    height: 1.5,
    borderRadius: 1,
    opacity: 0.7,
  },
  moverChange: {
    fontSize: 14,
    fontWeight: "700",
  },

  /* Find investments */
  findSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 20,
  },
  findSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface[100],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  findSearchPlaceholder: {
    fontSize: 15,
    color: colors.text.muted,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 2,
  },
  categoryDesc: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  showAllBtn: {
    paddingVertical: 16,
    alignItems: "center",
  },
  showAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand[500],
  },

  /* ── Search overlay ── */
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface[0],
    zIndex: 100,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface[100],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  searchResults: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  searchAssetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  searchAssetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  searchAssetIconText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text.primary,
  },
  searchAssetInfo: {
    flex: 1,
  },
  searchAssetTicker: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  searchAssetName: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  searchAssetPriceCol: {
    alignItems: "flex-end",
  },
  searchAssetPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  searchAssetChange: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },

  /* Search categories */
  searchCategoryBlock: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  searchCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 14,
  },
  searchCategoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  searchCategoryHeaderInfo: {
    flex: 1,
  },
  searchCategoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  searchCategoryDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  tickerPillsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tickerPill: {
    backgroundColor: colors.surface[100],
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tickerPillTicker: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.primary,
  },
  tickerPillPrice: {
    fontSize: 13,
    color: colors.text.secondary,
  },

  /* No results */
  noResults: {
    paddingVertical: 60,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 4,
  },
  noResultsHint: {
    fontSize: 14,
    color: colors.text.muted,
  },
});
