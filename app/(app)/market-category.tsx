import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import {
  assets,
  assetCurrency,
  assetIconCode,
  formatMoney,
  formatPct,
  type Asset,
} from "../../lib/data/assets";
import { findCategoryBySlug } from "../../lib/data/marketCategories";
import { CategoryGlyph } from "../../lib/components/CategoryGlyph";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";
import { useFavorites } from "../../lib/favorites/context";

/**
 * Detalle de una categoría de mercado — drilling-down desde el listado
 * de categorías de /Mercado. Recibe el slug en los params.
 *
 * Si la categoría tiene un filter definido en marketCategories.ts,
 * mostramos los assets que matchean. Si no, mostramos un empty state
 * 'Próximamente' (las categorías nuevas que todavía no tienen mock).
 */
export default function MarketCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { isFavorite } = useFavorites();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const lookup = useMemo(
    () => (slug ? findCategoryBySlug(slug) : null),
    [slug],
  );

  const items = useMemo(() => {
    if (!lookup?.category.filter) return [];
    return assets
      .filter(lookup.category.filter)
      .filter((a) => a.category !== "efectivo");
  }, [lookup]);

  const onOpen = (a: Asset) =>
    router.push({
      pathname: "/(app)/detail",
      params: { ticker: a.ticker },
    });

  if (!lookup) {
    return (
      <View style={[s.root, { backgroundColor: c.bg }]}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={s.iconBtn}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={22} color={c.text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: c.text }]}>Categoría</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.empty}>
          <Text style={[s.emptyTitle, { color: c.text }]}>
            Categoría no encontrada
          </Text>
        </View>
      </View>
    );
  }

  const { category } = lookup;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]} numberOfLines={1}>
          {category.label}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero del header de categoría — icon grande + label + hint. */}
        <View style={s.hero}>
          <CategoryGlyph slug={category.slug} size={64} />
          <Text style={[s.heroLabel, { color: c.text }]}>
            {category.label}
          </Text>
          {category.hint ? (
            <Text style={[s.heroHint, { color: c.textMuted }]}>
              {category.hint}
            </Text>
          ) : null}
        </View>

        {items.length > 0 ? (
          <View style={s.listBlock}>
            <Text style={[s.eyebrow, { color: c.textMuted }]}>
              {items.length} instrumento{items.length === 1 ? "" : "s"}
            </Text>
            {items.map((asset, i) => {
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
                      s.rowIcon,
                      {
                        backgroundColor:
                          asset.iconTone === "dark"
                            ? c.ink
                            : c.surfaceSunken,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.rowIconText,
                        {
                          color:
                            asset.iconTone === "dark"
                              ? c.bg
                              : c.textSecondary,
                        },
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
                        <Ionicons
                          name="star"
                          size={12}
                          color={c.greenDark}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[s.rowSub, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
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
                      <Text style={[s.rowYield, { color: c.greenDark }]}>
                        TNA {formatPct(asset.annualYield)}
                      </Text>
                    ) : (
                      <Text
                        style={[
                          s.rowChange,
                          {
                            color:
                              asset.change >= 0 ? c.positive : c.red,
                          },
                        ]}
                      >
                        {asset.change >= 0 ? "▲ " : "▼ "}
                        {formatPct(asset.change, false)}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: c.text }]}>
              Próximamente
            </Text>
            <Text style={[s.emptySub, { color: c.textMuted }]}>
              Vamos a sumar instrumentos de esta categoría muy pronto.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    alignItems: "flex-start",
  },
  heroLabel: {
    fontFamily: fontFamily[800],
    fontSize: 28,
    letterSpacing: -1,
    marginTop: 12,
  },
  heroHint: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
    marginTop: 4,
  },
  listBlock: {
    paddingHorizontal: 20,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  rowChart: {
    width: 64,
    height: 32,
    marginRight: 4,
  },
  rowPrice: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  rowYield: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  rowChange: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  emptyTitle: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    textAlign: "center",
  },
});
