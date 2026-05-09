import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { fontFamily, radius, useTheme } from "../../lib/theme";
import {
  assets,
  assetCurrency,
  formatMoney,
  type Asset,
  type AssetCategory,
} from "../../lib/data/assets";
import { convertAmount } from "../../lib/data/accounts";
import {
  categorizeAsset,
  findCategoryBySlug,
  type CategorySlug,
} from "../../lib/data/marketCategories";
import { Tap } from "../../lib/components/Tap";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";

/**
 * Tus posiciones — pantalla dedicada Robinhood-style. Accedida desde
 * el chevron verde al lado del título "Posiciones" del portfolio.
 *
 * Layout:
 *   - Top bar fijo con back arrow + título + total a la derecha.
 *   - Scroll con secciones por categoría (CEDEARs, Acciones AR,
 *     Bonos USD, Crypto, etc.). Cada sección: header con label +
 *     total ARS + count + dot color de la categoría; rows de cada
 *     posición con ticker, nombre, sparkline mini, valor y delta.
 *   - Categorías ordenadas por valor descendente (la más grande
 *     arriba). Posiciones dentro de cada categoría también ordenadas
 *     por valor.
 *
 * Pull-to-refresh disponible. Tap en cualquier row → /(app)/detail.
 */

type Currency = "ARS" | "USD";

interface Holding {
  asset: Asset;
  native: number;
  ars: number;
}

/* Misma paleta del FloorBrick — los dots de cada sección hablan el
 * mismo idioma cromático que el chart de la cartera. */
const PALETTE = [
  "#00C805",
  "#0E0F0C",
  "#7EE9A6",
  "#00B864",
  "#94A3B8",
  "#5AC53A",
  "#6B6C66",
];

/* Etiqueta corta para el header del market group. */
function marketLabelShort(slug: CategorySlug): string {
  if (slug.startsWith("us-")) return "EE.UU.";
  if (slug.startsWith("cr-")) return "Crypto";
  return "Argentina";
}

export default function PosicionesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [currency] = useState<Currency>("ARS");

  const holdings = useMemo<Holding[]>(() => {
    const held = assets.filter(
      (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    );
    return held
      .map((a) => {
        const native = a.price * (a.qty ?? 0);
        const ars = convertAmount(native, assetCurrency(a), "ARS");
        return { asset: a, native, ars };
      })
      .sort((x, y) => y.ars - x.ars);
  }, []);

  const totalArs = useMemo(
    () => holdings.reduce((acc, h) => acc + h.ars, 0),
    [holdings],
  );

  /* Agrupamos por slug de categoría — usa el mismo categorize que
   * el resto de la app (CEDEARs vs Acciones AR vs Bonos USD, etc). */
  const groups = useMemo(() => {
    const map = new Map<
      CategorySlug,
      {
        label: string;
        cat: AssetCategory;
        rows: Holding[];
        totalArs: number;
      }
    >();
    for (const h of holdings) {
      const slug = categorizeAsset(h.asset);
      if (!slug) continue;
      const lookup = findCategoryBySlug(slug);
      const label = lookup?.category.label ?? slug;
      const prev = map.get(slug);
      if (prev) {
        prev.rows.push(h);
        prev.totalArs += h.ars;
      } else {
        map.set(slug, {
          label,
          cat: h.asset.category,
          rows: [h],
          totalArs: h.ars,
        });
      }
    }
    // Sort por totalArs desc, dentro de cada uno por ars desc.
    const arr = [...map.entries()]
      .map(([slug, v], i) => ({
        slug,
        ...v,
        color: PALETTE[i % PALETTE.length],
        rows: [...v.rows].sort((a, b) => b.ars - a.ars),
        marketLabel: marketLabelShort(slug),
      }))
      .sort((a, b) => b.totalArs - a.totalArs);
    // Recolor en orden ya sorteado para que el más grande sea brand.
    return arr.map((g, i) => ({
      ...g,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [holdings]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  const totalDisplay =
    currency === "ARS" ? totalArs : convertAmount(totalArs, "ARS", currency);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Tap>
        <View style={s.topCenter}>
          <Text style={[s.topTitle, { color: c.text }]}>Tus posiciones</Text>
        </View>
        <View style={s.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.textMuted}
          />
        }
      >
        {/* Hero — total + count de posiciones. */}
        <View style={s.heroBlock}>
          <Text style={[s.heroEyebrow, { color: c.textMuted }]}>
            Valor de las posiciones
          </Text>
          <Text style={[s.heroAmount, { color: c.text }]}>
            {formatMoney(totalDisplay, currency)}
          </Text>
          <Text style={[s.heroCount, { color: c.textMuted }]}>
            {holdings.length}{" "}
            {holdings.length === 1 ? "posición" : "posiciones"} ·{" "}
            {groups.length}{" "}
            {groups.length === 1 ? "categoría" : "categorías"}
          </Text>
        </View>

        {groups.map((g) => {
          const groupPct =
            totalArs > 0 ? (g.totalArs / totalArs) * 100 : 0;
          return (
            <View key={g.slug} style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionLeft}>
                  <View
                    style={[s.sectionDot, { backgroundColor: g.color }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[s.sectionLabel, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {g.label}
                    </Text>
                    <Text
                      style={[s.sectionMeta, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {g.marketLabel} · {g.rows.length}{" "}
                      {g.rows.length === 1 ? "posición" : "posiciones"}
                    </Text>
                  </View>
                </View>
                <View style={s.sectionRight}>
                  <Text
                    style={[s.sectionValue, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {formatMoney(
                      currency === "ARS"
                        ? g.totalArs
                        : convertAmount(g.totalArs, "ARS", currency),
                      currency,
                    )}
                  </Text>
                  <Text
                    style={[s.sectionPct, { color: c.textMuted }]}
                  >
                    {groupPct >= 10
                      ? Math.round(groupPct).toString()
                      : groupPct.toFixed(1).replace(".", ",")}
                    %
                  </Text>
                </View>
              </View>

              <View
                style={[s.sectionRows, { borderTopColor: c.border }]}
              >
                {g.rows.map((h, i) => (
                  <PositionRow
                    key={h.asset.ticker}
                    h={h}
                    currency={currency}
                    showDivider={i > 0}
                    cBorder={c.border}
                    cText={c.text}
                    cMuted={c.textMuted}
                    cBrand={c.brand}
                    cRed={c.red}
                    onPress={() =>
                      router.push({
                        pathname: "/(app)/detail",
                        params: { ticker: h.asset.ticker },
                      })
                    }
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function PositionRow({
  h,
  currency,
  showDivider,
  cBorder,
  cText,
  cMuted,
  cBrand,
  cRed,
  onPress,
}: {
  h: Holding;
  currency: Currency;
  showDivider: boolean;
  cBorder: string;
  cText: string;
  cMuted: string;
  cBrand: string;
  cRed: string;
  onPress: () => void;
}) {
  const dayUp = h.asset.change >= 0;
  const tone = dayUp ? cBrand : cRed;
  const displayValue =
    currency === "ARS"
      ? h.ars
      : convertAmount(h.ars, "ARS", currency);
  const cleanTicker = shortCryptoTicker(h.asset.ticker);
  const spark = seriesFromSeed(h.asset.ticker, 40, dayUp ? "up" : "down");
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.posRow,
        showDivider && {
          borderTopColor: cBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={s.posLeft}>
        <Text
          style={[s.posTicker, { color: cText }]}
          numberOfLines={1}
        >
          {cleanTicker}
        </Text>
        <Text
          style={[s.posName, { color: cMuted }]}
          numberOfLines={1}
        >
          {h.asset.name}
        </Text>
      </View>
      <View style={s.posSpark}>
        <MiniSparkline
          series={spark}
          color={tone}
          width={56}
          height={22}
          strokeWidth={1.6}
        />
      </View>
      <View style={s.posRight}>
        <Text
          style={[s.posValue, { color: cText }]}
          numberOfLines={1}
        >
          {formatMoney(displayValue, currency)}
        </Text>
        <Text style={[s.posDelta, { color: tone }]} numberOfLines={1}>
          {dayUp ? "▲" : "▼"} {fmtPctAbs(h.asset.change)}
        </Text>
      </View>
    </Pressable>
  );
}

function shortCryptoTicker(ticker: string): string {
  if (ticker.includes("/USDT")) return ticker.replace("/USDT", "");
  if (ticker.endsWith("USDT.P")) return ticker.replace("USDT.P", "") + ".P";
  return ticker;
}

function fmtPctAbs(n: number): string {
  return Math.abs(n).toFixed(2).replace(".", ",") + "%";
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    flex: 1,
    alignItems: "center",
  },
  topTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },

  /* Hero — total + count, sin card. */
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  heroEyebrow: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroAmount: {
    fontFamily: fontFamily[800],
    fontSize: 34,
    letterSpacing: -1.2,
    marginBottom: 4,
  },
  heroCount: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },

  /* Sección — header + rows. */
  section: {
    marginTop: 20,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 10,
    gap: 12,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionLabel: {
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.4,
  },
  sectionMeta: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  sectionRight: {
    alignItems: "flex-end",
  },
  sectionValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
  },
  sectionPct: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  sectionRows: {
    paddingHorizontal: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  /* Position row — mismo lenguaje que el PositionsList del portfolio. */
  posRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  posLeft: {
    flex: 1,
  },
  posTicker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  posName: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  posSpark: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  posRight: {
    alignItems: "flex-end",
    minWidth: 90,
  },
  posValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  posDelta: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },
});
