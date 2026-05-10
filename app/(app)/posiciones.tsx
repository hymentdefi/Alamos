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
} from "../../lib/data/assets";
import { convertAmount } from "../../lib/data/accounts";
import { Tap } from "../../lib/components/Tap";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";

/**
 * Tus posiciones — pantalla dedicada estilo Robinhood. Accedida desde
 * el arrow brand al lado del título "Posiciones" en el portfolio.
 *
 * Layout (Robinhood-inspired, no category grouping):
 *   1. Top bar minimalista — back arrow + "Posiciones" muted centrado.
 *   2. Hero scrollable — eyebrow + total grande + delta del día con
 *      tone color + count.
 *   3. Sort segmented — pill estilo Robinhood: Valor / Hoy / A-Z.
 *      Default: Valor (mayor → menor).
 *   4. Lista flat de holdings, ordenada según el sort seleccionado.
 *      Cada row: ticker bold + nombre muted; sparkline; valor + delta %.
 *
 * Tap en cualquier row → /(app)/detail. Pull-to-refresh disponible.
 */

type Currency = "ARS" | "USD";
type SortKey = "value" | "delta" | "alpha";

interface Holding {
  asset: Asset;
  native: number;
  ars: number;
  /** Delta del día en ARS — se usa para calcular el delta agregado del
   *  hero y para la jerarquía de color en cada row. */
  dayDeltaArs: number;
}

export default function PosicionesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [currency] = useState<Currency>("ARS");
  const [sort, setSort] = useState<SortKey>("value");

  const holdings = useMemo<Holding[]>(() => {
    const held = assets.filter(
      (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    );
    return held.map((a) => {
      const native = a.price * (a.qty ?? 0);
      const ars = convertAmount(native, assetCurrency(a), "ARS");
      const dayDeltaArs = ars * (a.change / 100);
      return { asset: a, native, ars, dayDeltaArs };
    });
  }, []);

  const totalArs = useMemo(
    () => holdings.reduce((acc, h) => acc + h.ars, 0),
    [holdings],
  );
  const dayDeltaArs = useMemo(
    () => holdings.reduce((acc, h) => acc + h.dayDeltaArs, 0),
    [holdings],
  );
  const dayPct = totalArs > 0 ? (dayDeltaArs / totalArs) * 100 : 0;
  const dayUp = dayDeltaArs >= 0;
  const tone = dayUp ? c.brand : c.red;

  const sortedHoldings = useMemo(() => {
    const arr = [...holdings];
    if (sort === "value") {
      arr.sort((a, b) => b.ars - a.ars);
    } else if (sort === "delta") {
      arr.sort((a, b) => b.asset.change - a.asset.change);
    } else {
      arr.sort((a, b) =>
        a.asset.ticker.localeCompare(b.asset.ticker, "es-AR"),
      );
    }
    return arr;
  }, [holdings, sort]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  const totalDisplay =
    currency === "ARS" ? totalArs : convertAmount(totalArs, "ARS", currency);
  const dayDisplay =
    currency === "ARS"
      ? dayDeltaArs
      : convertAmount(dayDeltaArs, "ARS", currency);

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
          <Text style={[s.topTitle, { color: c.textMuted }]}>Posiciones</Text>
        </View>
        <View style={s.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.textMuted}
          />
        }
      >
        {/* Hero — eyebrow + total dominante + delta del día tone-color
            + count. La jerarquía visual es la misma que el portfolio
            tab (eyebrow uppercase + amount 800 + delta). */}
        <View style={s.heroBlock}>
          <Text style={[s.heroEyebrow, { color: c.textMuted }]}>
            Tus posiciones
          </Text>
          <Text style={[s.heroAmount, { color: c.text }]} numberOfLines={1}>
            {formatMoney(totalDisplay, currency)}
          </Text>
          <View style={s.heroDeltaRow}>
            <Text style={[s.heroDeltaTri, { color: tone }]}>
              {dayUp ? "▲" : "▼"}
            </Text>
            <Text style={[s.heroDeltaText, { color: tone }]}>
              {formatMoney(Math.abs(dayDisplay), currency)}
            </Text>
            <Text style={[s.heroDeltaText, { color: tone }]}>
              ({fmtPctAbs(dayPct)})
            </Text>
            <Text style={[s.heroDeltaText, { color: c.textMuted }]}>hoy</Text>
          </View>
          <Text style={[s.heroCount, { color: c.textMuted }]}>
            {holdings.length}{" "}
            {holdings.length === 1 ? "posición" : "posiciones"}
          </Text>
        </View>

        {/* Sort segmented — pill estilo Robinhood debajo del hero,
            alineado a la izquierda. Track translúcido + thumb elevado
            en el activo. */}
        <View style={s.sortRow}>
          <View style={[s.sortSeg, { backgroundColor: c.surfaceHover }]}>
            {(
              [
                { key: "value", label: "Valor" },
                { key: "delta", label: "Hoy" },
                { key: "alpha", label: "A-Z" },
              ] as const
            ).map(({ key, label }) => {
              const active = sort === key;
              return (
                <Tap
                  key={key}
                  haptic="selection"
                  pressScale={0.97}
                  onPress={() => setSort(key)}
                  style={[
                    s.sortSegBtn,
                    active && {
                      backgroundColor: c.bg,
                      shadowColor: "#0E0F0C",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.sortSegLabel,
                      {
                        color: active ? c.text : c.textMuted,
                        fontFamily: fontFamily[active ? 800 : 600],
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Tap>
              );
            })}
          </View>
        </View>

        {/* Lista flat — sin grouping por categoría. Cada row es un
            tap target al detalle. Hairline divider entre rows. */}
        <View style={s.list}>
          {sortedHoldings.map((h, i) => (
            <PositionRow
              key={h.asset.ticker}
              h={h}
              currency={currency}
              showDivider={i > 0}
              c={c}
              onPress={() =>
                router.push({
                  pathname: "/(app)/detail",
                  params: { ticker: h.asset.ticker },
                })
              }
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── PositionRow — un holding individual estilo Robinhood.
 *
 * Layout: ticker bold + nombre muted a la izquierda; sparkline mini al
 * centro; valor + delta % apilados a la derecha. Sparkline + delta %
 * usan tone color (brand cuando up, red cuando down). */
function PositionRow({
  h,
  currency,
  showDivider,
  c,
  onPress,
}: {
  h: Holding;
  currency: Currency;
  showDivider: boolean;
  c: ReturnType<typeof useTheme>["c"];
  onPress: () => void;
}) {
  const dayUp = h.asset.change >= 0;
  const tone = dayUp ? c.brand : c.red;
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
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <View style={s.posLeft}>
        <Text
          style={[s.posTicker, { color: c.text }]}
          numberOfLines={1}
        >
          {cleanTicker}
        </Text>
        <Text
          style={[s.posName, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {h.asset.name}
        </Text>
      </View>
      <View style={s.posSpark}>
        <MiniSparkline
          series={spark}
          color={tone}
          width={64}
          height={26}
          strokeWidth={1.6}
        />
      </View>
      <View style={s.posRight}>
        <Text
          style={[s.posValue, { color: c.text }]}
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

  /* Top bar minimalista — back arrow izquierda + título muted
   * centrado + spacer derecha. Sin border bottom: el peso visual
   * lo lleva el hero. */
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
    borderCurve: "continuous",
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

  /* Hero — eyebrow uppercase + total grande + delta + count. Mismo
   * lenguaje que el hero del portfolio tab. */
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
  },
  heroEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroAmount: {
    fontFamily: fontFamily[800],
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.4,
  },
  heroDeltaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  heroDeltaTri: {
    fontFamily: fontFamily[800],
    fontSize: 12,
  },
  heroDeltaText: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  heroCount: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 10,
  },

  /* Sort segmented — pill ARS-style debajo del hero. */
  sortRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sortSeg: {
    flexDirection: "row",
    padding: 3,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  sortSegBtn: {
    minWidth: 56,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  sortSegLabel: {
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* Lista flat — sin secciones. Padding horizontal único, hairlines
   * entre rows. */
  list: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },

  /* Position row — Robinhood-style: ticker bold + nombre muted; mini
   * sparkline al centro; valor bold + delta % tone-color a la derecha. */
  posRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    gap: 12,
  },
  posLeft: {
    flex: 1,
  },
  posTicker: {
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.4,
  },
  posName: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  posSpark: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  posRight: {
    alignItems: "flex-end",
    minWidth: 96,
  },
  posValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
  },
  posDelta: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },
});
