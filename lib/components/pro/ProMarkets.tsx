import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius, spacing } from "../../theme";
import {
  assets,
  formatPct,
  formatVolume,
  type Asset,
  type AssetCategory,
} from "../../data/assets";
import { useFavorites } from "../../favorites/context";

type Market = "spot" | "futures" | "tradfi";
type Sort = "change" | "volume" | "price";
type SortDir = "desc" | "asc";

const marketTabs: { id: Market; label: string; hint?: string }[] = [
  { id: "spot", label: "Spot" },
  { id: "futures", label: "Futuros", hint: "Perp" },
  { id: "tradfi", label: "TradFi", hint: "AR" },
];

const subFilters: Record<Market, { id: string; label: string }[]> = {
  spot: [
    { id: "all", label: "Todo" },
    { id: "favs", label: "⭐ Favs" },
    { id: "top", label: "Top Vol" },
    { id: "gainers", label: "Gainers" },
    { id: "losers", label: "Losers" },
  ],
  futures: [
    { id: "all", label: "Todo" },
    { id: "favs", label: "⭐ Favs" },
    { id: "top", label: "Top Vol" },
    { id: "gainers", label: "Gainers" },
    { id: "losers", label: "Losers" },
  ],
  tradfi: [
    { id: "all", label: "Todo" },
    { id: "favs", label: "⭐ Favs" },
    { id: "cedears", label: "CEDEARs" },
    { id: "bonos", label: "Bonos" },
    { id: "fci", label: "Fondos" },
    { id: "acciones", label: "Acciones" },
  ],
};

export function ProMarkets() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { favorites, isFavorite, toggle: toggleFav } = useFavorites();

  const [market, setMarket] = useState<Market>("spot");
  const [sub, setSub] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const onMarketChange = (m: Market) => {
    Haptics.selectionAsync().catch(() => {});
    setMarket(m);
    setSub("all");
  };

  const list = useMemo(() => {
    let arr: Asset[];
    if (market === "spot") {
      arr = assets.filter((a) => a.category === "cripto");
    } else if (market === "futures") {
      arr = assets.filter((a) => a.category === "futuros");
    } else {
      const tradfiCats: AssetCategory[] = [
        "cedears",
        "bonos",
        "fci",
        "acciones",
        "obligaciones",
        "letras",
      ];
      arr = assets.filter((a) => tradfiCats.includes(a.category));
    }

    // Sub filter
    if (sub === "favs") arr = arr.filter((a) => favorites.has(a.ticker));
    else if (sub === "gainers") arr = arr.filter((a) => a.change > 0);
    else if (sub === "losers") arr = arr.filter((a) => a.change < 0);
    else if (sub === "top") {
      arr = [...arr].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
    } else if (
      sub !== "all" &&
      market === "tradfi"
    ) {
      arr = arr.filter((a) => a.category === sub);
    }

    // Search
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(
        (a) =>
          a.ticker.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      );
    }

    // Sort (if not already sorted by "top")
    if (sub !== "top") {
      arr = [...arr].sort((a, b) => {
        let diff = 0;
        if (sort === "change") diff = a.change - b.change;
        else if (sort === "volume")
          diff = (a.volume24h ?? 0) - (b.volume24h ?? 0);
        else if (sort === "price") diff = a.price - b.price;
        return sortDir === "desc" ? -diff : diff;
      });
    }

    return arr;
  }, [market, sub, query, sort, sortDir, favorites]);

  const openTrade = (a: Asset) => {
    router.push({
      pathname: "/(app)/trade",
      params: { ticker: a.ticker },
    });
  };

  const cycleSort = (col: Sort) => {
    Haptics.selectionAsync().catch(() => {});
    if (col === sort) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(col);
      setSortDir("desc");
    }
  };

  const arrow = (col: Sort) =>
    col === sort ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View
          style={[
            s.searchBox,
            { backgroundColor: c.surfaceHover, borderColor: c.border },
          ]}
        >
          <Feather name="search" size={14} color={c.textMuted} />
          <TextInput
            style={[s.searchInput, { color: c.text }]}
            placeholder="Buscar pares"
            placeholderTextColor={c.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="characters"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Feather name="x" size={14} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Market tabs */}
        <View style={s.marketTabsRow}>
          {marketTabs.map((m) => {
            const active = market === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => onMarketChange(m.id)}
                style={s.marketTab}
              >
                <Text
                  style={[
                    s.marketTabLabel,
                    { color: active ? c.text : c.textMuted },
                  ]}
                >
                  {m.label}
                </Text>
                {m.hint ? (
                  <Text
                    style={[
                      s.marketTabHint,
                      { color: active ? c.greenDark : c.textFaint },
                    ]}
                  >
                    {m.hint}
                  </Text>
                ) : null}
                {active ? (
                  <View
                    style={[
                      s.marketTabUnderline,
                      { backgroundColor: c.greenDark },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Sub filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.subRow}
          style={s.subWrap}
        >
          {subFilters[market].map((f) => {
            const active = sub === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setSub(f.id)}
                style={[
                  s.subPill,
                  {
                    backgroundColor: active
                      ? c.surfaceHover
                      : "transparent",
                    borderColor: active ? c.borderStrong : c.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.subPillLabel,
                    { color: active ? c.text : c.textMuted },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Column headers with sort */}
        <View style={[s.colHeader, { borderBottomColor: c.border }]}>
          <Text style={[s.colHeaderText, s.colLeft, { color: c.textMuted }]}>
            Par
          </Text>
          <Pressable
            onPress={() => cycleSort("price")}
            style={s.colPrice}
            hitSlop={8}
          >
            <Text style={[s.colHeaderText, { color: c.textMuted, textAlign: "right" }]}>
              Precio{arrow("price")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => cycleSort("change")}
            style={s.colChange}
            hitSlop={8}
          >
            <Text style={[s.colHeaderText, { color: c.textMuted, textAlign: "right" }]}>
              24h%{arrow("change")}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {list.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: c.text }]}>Sin pares</Text>
            <Text style={[s.emptySub, { color: c.textMuted }]}>
              Cambiá el mercado o el filtro.
            </Text>
          </View>
        ) : (
          list.map((a) => {
            const fav = isFavorite(a.ticker);
            const up = a.change >= 0;
            return (
              <Pressable
                key={a.ticker}
                onPress={() => openTrade(a)}
                style={[s.row, { borderBottomColor: c.border }]}
              >
                <View style={s.colLeft}>
                  <View style={s.rowTickerLine}>
                    <Pressable
                      onPress={() => toggleFav(a.ticker)}
                      hitSlop={8}
                      style={{ marginRight: 6 }}
                    >
                      <Ionicons
                        name={fav ? "star" : "star-outline"}
                        size={14}
                        color={fav ? c.greenDark : c.textFaint}
                      />
                    </Pressable>
                    <Text style={[s.rowTicker, { color: c.text }]}>
                      {a.ticker}
                    </Text>
                    {a.maxLeverage ? (
                      <View
                        style={[
                          s.levBadge,
                          { backgroundColor: c.greenDim },
                        ]}
                      >
                        <Text
                          style={[
                            s.levBadgeText,
                            { color: c.greenDark },
                          ]}
                        >
                          {a.maxLeverage}x
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[s.rowSub, { color: c.textMuted }]}>
                    {a.volume24h
                      ? `Vol ${formatVolume(a.volume24h)}`
                      : a.subLabel}
                  </Text>
                </View>
                <View style={s.colPrice}>
                  <Text style={[s.rowPrice, { color: c.text }]}>
                    {a.price.toLocaleString("en-US", {
                      maximumFractionDigits: a.price < 1 ? 4 : 2,
                    })}
                  </Text>
                  {a.fundingRate != null ? (
                    <Text
                      style={[
                        s.rowFunding,
                        {
                          color:
                            a.fundingRate >= 0 ? c.textMuted : c.red,
                        },
                      ]}
                    >
                      F: {(a.fundingRate * 100).toFixed(4)}%
                    </Text>
                  ) : null}
                </View>
                <View style={s.colChange}>
                  <View
                    style={[
                      s.changePill,
                      {
                        backgroundColor: up ? c.green : c.red,
                      },
                    ]}
                  >
                    <Text style={[s.changePillText, { color: "#FFFFFF" }]}>
                      {formatPct(a.change)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    padding: 0,
  },

  /* Market tabs */
  marketTabsRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 20,
  },
  marketTab: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingBottom: 10,
  },
  marketTabLabel: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  marketTabHint: {
    fontFamily: fontFamily[600],
    fontSize: 9,
    letterSpacing: 0.6,
  },
  marketTabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },

  /* Sub filters */
  subWrap: {
    marginTop: 8,
    marginHorizontal: -16,
  },
  subRow: {
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 12,
  },
  subPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  subPillLabel: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* Column headers */
  colHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colHeaderText: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.2,
  },
  colLeft: {
    flex: 1.5,
  },
  colPrice: {
    flex: 1.1,
    alignItems: "flex-end",
  },
  colChange: {
    flex: 0.9,
    alignItems: "flex-end",
  },

  /* Rows */
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTickerLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowTicker: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  levBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  levBadgeText: {
    fontFamily: fontFamily[700],
    fontSize: 9,
    letterSpacing: 0.2,
  },
  rowSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  rowPrice: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  rowFunding: {
    fontFamily: fontFamily[500],
    fontSize: 10,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  changePill: {
    paddingVertical: 6,
    minWidth: 68,
    alignItems: "center",
    borderRadius: 4,
  },
  changePillText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    textAlign: "center",
  },
});
