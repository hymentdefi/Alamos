import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet,
  NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, assetCategories, formatARS } from "../../lib/data/assets";

/* ─── Ticker tape data ─── */
const tickerItems = [
  // Índices
  { name: "MERVAL", value: "1.842.350", change: 1.24 },
  { name: "S&P 500", value: "5.321", change: 0.87 },
  { name: "NASDAQ", value: "16.742", change: 1.03 },
  { name: "Dow Jones", value: "39.118", change: 0.42 },
  { name: "IBEX 35", value: "11.245", change: -0.18 },
  { name: "Nikkei 225", value: "38.471", change: 0.65 },
  { name: "DAX", value: "18.322", change: 0.31 },
  { name: "Bovespa", value: "128.450", change: -0.54 },
  { name: "Riesgo País", value: "742", change: -2.31 },

  // Dólares
  { name: "Dólar CCL", value: "$1.285", change: -0.32 },
  { name: "Dólar MEP", value: "$1.272", change: -0.18 },
  { name: "Dólar Blue", value: "$1.310", change: 0.45 },
  { name: "Dólar Oficial", value: "$1.025", change: 0.08 },
  { name: "Dólar Cripto", value: "$1.295", change: -0.12 },

  // Crypto
  { name: "Bitcoin", value: "$68.432", change: 0.15 },
  { name: "Ethereum", value: "$3.284", change: -0.91 },
  { name: "Solana", value: "$142.8", change: 3.22 },
  { name: "BNB", value: "$584.3", change: 0.74 },
  { name: "XRP", value: "$0.52", change: -1.15 },
  { name: "Cardano", value: "$0.45", change: 1.87 },

  // Acciones AR
  { name: "GGAL", value: "$5.420", change: 2.15 },
  { name: "YPFD", value: "$45.280", change: 4.21 },
  { name: "PAMP", value: "$3.180", change: -1.42 },
  { name: "TXAR", value: "$3.240", change: 3.15 },
  { name: "BBAR", value: "$4.890", change: 1.56 },
  { name: "BMA", value: "$9.450", change: 0.87 },
  { name: "SUPV", value: "$2.180", change: -0.62 },
  { name: "CEPU", value: "$1.920", change: 1.45 },
  { name: "EDN", value: "$1.340", change: 0.33 },
  { name: "TRAN", value: "$890", change: -0.78 },
  { name: "ALUA", value: "$1.842", change: -1.33 },
  { name: "COME", value: "$562", change: 2.94 },
  { name: "CRES", value: "$3.450", change: 1.12 },
  { name: "LOMA", value: "$6.780", change: -0.28 },
  { name: "MIRG", value: "$12.340", change: 0.95 },
  { name: "TECO2", value: "$1.650", change: 0.41 },
  { name: "VALO", value: "$1.120", change: -0.55 },

  // Bonos
  { name: "AL30", value: "$68.420", change: 0.62 },
  { name: "GD30", value: "$72.340", change: 1.87 },
  { name: "AL35", value: "$58.200", change: 0.45 },
  { name: "GD35", value: "$61.800", change: 1.12 },
  { name: "GD41", value: "$54.300", change: 0.78 },
  { name: "AE38", value: "$49.100", change: -0.21 },
  { name: "TX26", value: "$15.420", change: 0.15 },

  // CEDEARs
  { name: "AAPL", value: "$32.150", change: 0.78 },
  { name: "MSFT", value: "$27.830", change: 0.43 },
  { name: "GOOGL", value: "$19.650", change: 1.14 },
  { name: "AMZN", value: "$28.470", change: 1.52 },
  { name: "TSLA", value: "$14.890", change: -2.17 },
  { name: "NVDA", value: "$18.740", change: 3.42 },
  { name: "META", value: "$15.320", change: 0.91 },
  { name: "MELI", value: "$42.100", change: 2.08 },
  { name: "KO", value: "$8.920", change: 0.12 },
  { name: "WMT", value: "$11.450", change: -0.34 },
  { name: "DIS", value: "$7.230", change: -1.05 },
  { name: "BABA", value: "$5.670", change: 2.34 },
  { name: "JPM", value: "$13.480", change: 0.67 },
  { name: "V", value: "$16.920", change: 0.29 },
  { name: "PFE", value: "$3.410", change: -0.88 },
  { name: "NKE", value: "$6.150", change: -1.42 },
  { name: "NFLX", value: "$22.340", change: 1.78 },
  { name: "AMD", value: "$9.870", change: 2.56 },
  { name: "INTC", value: "$2.340", change: -3.12 },
  { name: "UBER", value: "$4.560", change: 0.83 },

  // Commodities
  { name: "Oro", value: "$2.384", change: 0.52 },
  { name: "Plata", value: "$28.45", change: -0.33 },
  { name: "Petróleo WTI", value: "$78.62", change: 1.14 },
  { name: "Soja", value: "$452.3", change: -0.67 },
  { name: "Maíz", value: "$198.7", change: 0.23 },
  { name: "Trigo", value: "$245.1", change: -1.08 },
];

type TabId = typeof assetCategories[number]["id"];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("cedears");
  const [showCategories, setShowCategories] = useState(false);

  const activeLabel = assetCategories.find((c) => c.id === activeTab)?.label ?? "Categoría";

  /* ── Ticker tape auto-scroll ── */
  const tickerScrollRef = useRef<ScrollView>(null);
  const tickerOffset = useRef(0);
  const tickerPaused = useRef(false);

  useEffect(() => {
    const PX_PER_TICK = 1;
    const INTERVAL_MS = 30; // ~33fps, moves ~33px/s
    const id = setInterval(() => {
      if (!tickerPaused.current) {
        tickerOffset.current += PX_PER_TICK;
        tickerScrollRef.current?.scrollTo({ x: tickerOffset.current, animated: false });
      }
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const onTickerScrollBegin = useCallback(() => {
    tickerPaused.current = true;
  }, []);

  const onTickerScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    tickerOffset.current = e.nativeEvent.contentOffset.x;
  }, []);

  const onTickerScrollEnd = useCallback(() => {
    tickerPaused.current = false;
  }, []);

  const openDetail = (ticker: string) => {
    router.push({ pathname: "/(app)/detail", params: { ticker } });
  };

  /* ── Filtered assets ── */
  const filtered = useMemo(() => {
    let list = activeTab === "favoritos"
      ? assets.filter((a) => a.favorite)
      : assets.filter((a) => a.category === activeTab);

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) => a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeTab, query]);

  return (
    <View style={s.root}>
      {/* ── Fixed header ── */}
      <View style={[s.fixedTop, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Mercado</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Ticker tape ── */}
        <ScrollView
          ref={tickerScrollRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tickerStrip}
          onScrollBeginDrag={onTickerScrollBegin}
          onScroll={onTickerScroll}
          onScrollEndDrag={onTickerScrollEnd}
          onMomentumScrollEnd={onTickerScrollEnd}
          scrollEventThrottle={16}
        >
          {tickerItems.map((idx) => {
            const up = idx.change >= 0;
            return (
              <View key={idx.name} style={s.tickerCard}>
                <Text style={s.tickerName}>{idx.name}</Text>
                <Text style={s.tickerValue}>{idx.value}</Text>
                <Text style={[s.tickerChange, { color: up ? colors.brand[500] : colors.red }]}>
                  {up ? "+" : ""}{idx.change.toFixed(2)}%
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* ── Filter row: category button + search ── */}
        <View style={s.filterRow}>
          <Pressable style={s.catButton} onPress={() => setShowCategories(true)}>
            <Text style={s.catButtonText}>{activeLabel}</Text>
            <Feather name="chevron-down" size={16} color={colors.text.primary} />
          </Pressable>
          <View style={s.searchBar}>
            <Feather name="search" size={16} color={colors.text.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Buscar..."
              placeholderTextColor={colors.text.muted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Feather name="x-circle" size={16} color={colors.text.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Asset list ── */}
        <View style={s.list}>
          {filtered.map((a, index) => {
            const up = a.change >= 0;
            return (
              <Pressable
                key={a.ticker}
                style={[
                  s.row,
                  index < filtered.length - 1 && s.rowBorder,
                ]}
                onPress={() => openDetail(a.ticker)}
              >
                <View style={s.rowLeft}>
                  <Text style={s.rowTicker}>{a.ticker}</Text>
                  <Text style={s.rowName} numberOfLines={1}>{a.name}</Text>
                </View>
                <View style={s.rowRight}>
                  <Text style={s.rowPrice}>{formatARS(a.price)}</Text>
                  <Text style={[s.rowChange, { color: up ? colors.brand[500] : colors.red }]}>
                    {up ? "+" : ""}{a.change.toFixed(2)}%
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyText}>Sin resultados</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Category picker overlay ── */}
      {showCategories && (
        <>
          <Pressable
            style={s.modalBackdrop}
            onPress={() => setShowCategories(false)}
          />
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={s.modalTitle}>Categoría</Text>
            {assetCategories.map((cat) => {
              const active = activeTab === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[s.modalOption, active && s.modalOptionActive]}
                  onPress={() => {
                    setActiveTab(cat.id);
                    setShowCategories(false);
                  }}
                >
                  <Text style={[s.modalOptionText, active && s.modalOptionTextActive]}>
                    {cat.label}
                  </Text>
                  {active && <Feather name="check" size={18} color={colors.brand[500]} />}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  scroll: { flex: 1 },
  fixedTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.8,
  },

  /* Ticker tape */
  tickerStrip: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  tickerCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 14,
    minWidth: 110,
  },
  tickerName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 6,
  },
  tickerValue: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 2,
  },
  tickerChange: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* Filter row */
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  catButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  catButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },

  /* Modal */
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 50,
  },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 51,
    backgroundColor: "#141414",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  modalOptionActive: {
    borderBottomColor: "rgba(0,230,118,0.15)",
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  modalOptionTextActive: {
    color: colors.brand[500],
    fontWeight: "700",
  },

  /* List */
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowLeft: {
    flex: 1,
    marginRight: 16,
  },
  rowTicker: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  rowName: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  rowPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  rowChange: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.muted,
  },
});
