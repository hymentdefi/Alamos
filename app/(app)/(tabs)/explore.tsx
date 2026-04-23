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
import { useTheme, fontFamily, radius, spacing } from "../../../lib/theme";
import {
  assets,
  assetIconCode,
  formatARS,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../../lib/data/assets";
import { useFavorites } from "../../../lib/favorites/context";
import { MiniSparkline, seriesFromSeed } from "../../../lib/components/Sparkline";
import { ProMarkets } from "../../../lib/components/pro/ProMarkets";
import { useProMode } from "../../../lib/pro/context";
import { Tap } from "../../../lib/components/Tap";
import { isMarketOpen, marketClosedMessage } from "../../../lib/market/hours";

type Filter = "todo" | AssetCategory;

const filters: { id: Filter; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "cedears", label: "CEDEARs" },
  { id: "fci", label: "Fondos" },
  { id: "crypto", label: "Crypto" },
  { id: "bonos", label: "Bonos" },
  { id: "acciones", label: "Acciones" },
  { id: "obligaciones", label: "ONs" },
  { id: "letras", label: "Letras" },
  { id: "caucion", label: "Caución" },
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
  const [activeIdx, setActiveIdx] = useState(0);
  const [onlyFavs, setOnlyFavs] = useState(false);
  const filterScrollRef = useRef<ScrollView>(null);
  const listRef = useRef<ScrollView | null>(null);

  const filter = filters[activeIdx];

  const topMovers = useMemo(
    () =>
      [...assets]
        .filter((a) => a.category !== "efectivo")
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 8),
    [],
  );

  const navLock = useRef(false);
  const openDetail = useCallback(
    (asset: Asset) => {
      if (navLock.current) return;
      navLock.current = true;
      router.push({
        pathname: "/(app)/detail",
        params: { ticker: asset.ticker },
      });
      setTimeout(() => {
        navLock.current = false;
      }, 700);
    },
    [router],
  );

  const toggleFavs = () => {
    setOnlyFavs((v) => !v);
    Haptics.selectionAsync().catch(() => {});
  };

  // Scroll de los pills para centrar la categoría activa
  useEffect(() => {
    filterScrollRef.current?.scrollTo({
      x: Math.max(0, activeIdx * 92 - 60),
      animated: true,
    });
  }, [activeIdx]);

  const openFilter = useCallback((idx: number) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveIdx(idx);
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

  const marketOpen = isMarketOpen();

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[s.title, { color: c.text }]}>Mercado</Text>

        {!marketOpen ? (
          <View
            style={[
              s.closedBanner,
              { backgroundColor: c.surfaceHover, borderColor: c.border },
            ]}
          >
            <View style={[s.closedDot, { backgroundColor: c.green }]} />
            <Text
              style={[s.closedText, { color: c.textSecondary }]}
              numberOfLines={2}
            >
              {marketClosedMessage()}
            </Text>
          </View>
        ) : null}

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
              placeholder="Buscar por ticker o nombre"
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

        <ScrollView
          ref={filterScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.filterRow}
          contentContainerStyle={s.filterContent}
        >
          {filters.map((f, i) => {
            const active = i === activeIdx;
            return (
              <Tap
                key={f.id}
                onPress={() => openFilter(i)}
                haptic="selection"
                pressScale={0.93}
                style={[
                  s.filterPill,
                  {
                    backgroundColor: active ? c.ink : c.surfaceHover,
                    borderColor: active ? c.ink : c.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.filterLabel,
                    { color: active ? c.bg : c.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </Tap>
            );
          })}
        </ScrollView>
      </View>

      <MarketPage
        filter={filter.id}
        label={filter.label}
        query={query}
        onlyFavs={onlyFavs}
        topMovers={topMovers}
        onOpen={openDetail}
        isFavorite={isFavorite}
        listRef={(r) => {
          listRef.current = r;
        }}
      />
    </View>
  );
}

/* ─── Página de lista filtrada por categoría ─── */

function MarketPage({
  filter,
  label,
  query,
  onlyFavs,
  topMovers,
  onOpen,
  isFavorite,
  listRef,
}: {
  filter: Filter;
  label: string;
  query: string;
  onlyFavs: boolean;
  topMovers: Asset[];
  onOpen: (a: Asset) => void;
  isFavorite: (t: string) => boolean;
  listRef: (ref: ScrollView | null) => void;
}) {
  const { c } = useTheme();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (a.category === "efectivo") return false;
      if (onlyFavs && !isFavorite(a.ticker)) return false;
      if (filter !== "todo" && a.category !== filter) return false;
      if (!q) return true;
      return (
        a.ticker.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
      );
    });
  }, [query, filter, onlyFavs, isFavorite]);

  const eyebrowLabel = query
    ? `${visible.length} resultado${visible.length === 1 ? "" : "s"}`
    : onlyFavs
    ? filter === "todo"
      ? "Tus favoritos"
      : `Favoritos · ${label}`
    : label;

  const showMovers = !query && !onlyFavs && filter === "todo";

  return (
    <ScrollView
      ref={listRef}
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      {showMovers ? (
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
              {onlyFavs ? "Aún no tenés favoritos" : "Sin resultados"}
            </Text>
            <Text style={[s.emptySub, { color: c.textMuted }]}>
              {onlyFavs
                ? "Entrá a un activo y tocá la estrella arriba a la derecha para guardarlo."
                : "Probá con otro ticker o categoría."}
            </Text>
          </View>
        ) : (
          visible.map((asset, i) => {
            const fav = isFavorite(asset.ticker);
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
                    {formatARS(asset.price)}
                  </Text>
                  <Text
                    style={[
                      s.rowChange,
                      { color: asset.change >= 0 ? c.greenDark : c.red },
                    ]}
                  >
                    {formatPct(asset.change)}
                  </Text>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.marqueeTrack}
        decelerationRate="normal"
      >
        {movers.map((asset) => {
          const up = asset.change >= 0;
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
                {formatARS(asset.price)}
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
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    marginBottom: 14,
  },
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  closedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  closedText: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
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
  filterRow: {
    marginTop: 14,
    marginHorizontal: -20,
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterLabel: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  moversBlock: {
    paddingTop: 20,
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
  },
  emptySub: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
    textAlign: "center",
    lineHeight: 20,
  },
});
