import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../theme";
import {
  assets,
  formatPct,
  formatVolume,
  type Asset,
} from "../../data/assets";
import { useFavorites } from "../../favorites/context";
import { Sparkline, seriesFromSeed } from "../Sparkline";
import { AmountDisplay } from "../AmountDisplay";

const USDT_RATE = 1200; // ARS per USDT mock

export function ProHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { favorites } = useFavorites();

  const { equityArs, pnlArs, pnlPct } = useMemo(() => {
    const held = assets.filter((a) => a.held);
    const totalArs = held.reduce((s, a) => s + a.price * (a.qty ?? 1), 0);
    const pnl = totalArs * 0.0162;
    return { equityArs: totalArs, pnlArs: pnl, pnlPct: 1.62 };
  }, []);

  const watchlist = useMemo(() => {
    const favList = assets.filter((a) => favorites.has(a.ticker));
    if (favList.length >= 5) return favList.slice(0, 8);
    const filler = assets
      .filter(
        (a) =>
          !favorites.has(a.ticker) &&
          (a.category === "crypto" || a.category === "futuros") &&
          a.ticker !== "ARS" &&
          a.ticker !== "USD",
      )
      .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
    return [...favList, ...filler].slice(0, 8);
  }, [favorites]);

  const topGainers = useMemo(
    () =>
      [...assets]
        .filter((a) => a.category === "crypto" || a.category === "futuros")
        .sort((a, b) => b.change - a.change)
        .slice(0, 4),
    [],
  );

  const openTrade = (a: Asset) => {
    router.push({
      pathname: "/(app)/trade",
      params: { ticker: a.ticker },
    });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={s.topActions}>
          <Pressable
            style={[s.topPill, { backgroundColor: c.surfaceHover }]}
            onPress={() =>
              router.push({
                pathname: "/(app)/transfer",
                params: { mode: "deposit" },
              })
            }
            hitSlop={8}
          >
            <Feather name="arrow-down-left" size={14} color={c.text} />
            <Text style={[s.topPillText, { color: c.text }]}>Ingresar</Text>
          </Pressable>
          <Pressable
            style={[s.topPill, { backgroundColor: c.surfaceHover }]}
            onPress={() =>
              router.push({
                pathname: "/(app)/transfer",
                params: { mode: "send" },
              })
            }
            hitSlop={8}
          >
            <Feather name="arrow-up-right" size={14} color={c.text} />
            <Text style={[s.topPillText, { color: c.text }]}>Enviar</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Equity hero — editorial ─── */}
        <View style={s.heroBlock}>
          <Text style={[s.heroLabel, { color: c.textMuted }]}>
            Tu mesa de operaciones
          </Text>
          <AmountDisplay
            value={equityArs}
            size={42}
            style={{ marginVertical: 6 }}
          />
          <View style={s.deltaRow}>
            <Text style={[s.deltaTri, { color: c.greenDark }]}>▲</Text>
            <Text style={[s.deltaText, { color: c.greenDark }]}>
              $ {Math.round(pnlArs).toLocaleString("es-AR")}
            </Text>
            <Text style={[s.deltaSep, { color: c.greenDark }]}>·</Text>
            <Text style={[s.deltaText, { color: c.greenDark }]}>
              {formatPct(pnlPct)} hoy
            </Text>
          </View>
        </View>

        {/* ─── Stats strip ─── */}
        <View
          style={[
            s.statsCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <StatBlock
            label="P&L 24h"
            value={`+$ ${Math.round(pnlArs).toLocaleString("es-AR")}`}
            sub={`+${pnlPct.toFixed(2)}%`}
            positive
          />
          <View style={[s.statsDivider, { backgroundColor: c.border }]} />
          <StatBlock
            label="Sin realizar"
            value="+$ 10.104"
            sub="+0,54%"
            positive
          />
          <View style={[s.statsDivider, { backgroundColor: c.border }]} />
          <StatBlock
            label="Margen"
            value="42%"
            sub="disponible"
            muted
          />
        </View>

        {/* ─── Quick actions ─── */}
        <View style={s.quickRow}>
          <QuickAction
            icon="arrow-down-left"
            label="Depositar"
            onPress={() => router.push("/(app)/transfer")}
          />
          <QuickAction
            icon="arrow-up-right"
            label="Enviar"
            onPress={() =>
              router.push({
                pathname: "/(app)/transfer",
                params: { mode: "send" },
              })
            }
          />
          <QuickAction
            icon="repeat"
            label="Convert"
            onPress={() => router.push("/(app)/transfer")}
          />
          <QuickAction
            icon="trending-up"
            label="Operar"
            onPress={() => router.push("/(app)/explore")}
            primary
          />
        </View>

        {/* ─── Destacados del día ─── */}
        <View style={s.sectionHead}>
          <Text style={[s.sectionEyebrow, { color: c.textMuted }]}>
            DESTACADOS DEL DÍA
          </Text>
          <Pressable onPress={() => router.push("/(app)/explore")}>
            <Text style={[s.sectionLink, { color: c.text }]}>
              Ver todo →
            </Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.gainersStrip}
        >
          {topGainers.map((a) => (
            <Pressable
              key={a.ticker}
              onPress={() => openTrade(a)}
              style={[
                s.gainerCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <View style={s.gainerTop}>
                <Text style={[s.gainerTicker, { color: c.text }]}>
                  {a.ticker}
                </Text>
                {a.maxLeverage ? (
                  <View
                    style={[
                      s.levTag,
                      { backgroundColor: c.greenDim },
                    ]}
                  >
                    <Text style={[s.levTagText, { color: c.greenDark }]}>
                      {a.maxLeverage}x
                    </Text>
                  </View>
                ) : null}
              </View>
              <Sparkline
                series={seriesFromSeed(a.ticker, 18, a.change >= 0 ? "up" : "down")}
                color={a.change >= 0 ? c.green : c.red}
                height={38}
                withFill={false}
                style={{ marginHorizontal: 0, marginVertical: 8 }}
              />
              <Text style={[s.gainerPrice, { color: c.text }]}>
                {a.price.toLocaleString("en-US", {
                  maximumFractionDigits: 4,
                })}
              </Text>
              <Text
                style={[
                  s.gainerChange,
                  { color: a.change >= 0 ? c.greenDark : c.red },
                ]}
              >
                {formatPct(a.change)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ─── Watchlist ─── */}
        <View style={s.sectionHead}>
          <Text style={[s.sectionEyebrow, { color: c.textMuted }]}>
            WATCHLIST
          </Text>
          <Pressable onPress={() => router.push("/(app)/explore")}>
            <Feather name="settings" size={14} color={c.textMuted} />
          </Pressable>
        </View>
        <View
          style={[
            s.watchlistCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          {watchlist.map((a, i) => (
            <Pressable
              key={a.ticker}
              onPress={() => openTrade(a)}
              style={[
                s.watchRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.watchTicker, { color: c.text }]}>
                  {a.ticker}
                </Text>
                {a.volume24h ? (
                  <Text style={[s.watchVol, { color: c.textMuted }]}>
                    Vol {formatVolume(a.volume24h)}
                  </Text>
                ) : (
                  <Text style={[s.watchVol, { color: c.textMuted }]}>
                    {a.subLabel}
                  </Text>
                )}
              </View>
              <Sparkline
                series={seriesFromSeed(
                  `wl-${a.ticker}`,
                  16,
                  a.change >= 0 ? "up" : "down",
                )}
                color={a.change >= 0 ? c.green : c.red}
                height={28}
                withFill={false}
                style={{
                  width: 70,
                  marginHorizontal: 0,
                  marginRight: 12,
                }}
              />
              <View style={s.watchRight}>
                <Text style={[s.watchPrice, { color: c.text }]}>
                  {a.price.toLocaleString("en-US", {
                    maximumFractionDigits: a.price < 10 ? 4 : 2,
                  })}
                </Text>
                <View
                  style={[
                    s.changePill,
                    {
                      backgroundColor:
                        a.change >= 0 ? c.greenDim : c.redDim,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.changePillText,
                      { color: a.change >= 0 ? c.greenDark : c.red },
                    ]}
                  >
                    {formatPct(a.change)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ─── Novedad ─── */}
        <View
          style={[
            s.announcement,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View
            style={[
              s.announcementTag,
              { backgroundColor: c.greenDim },
            ]}
          >
            <Text
              style={[
                s.announcementTagText,
                { color: c.greenDark },
              ]}
            >
              NUEVO
            </Text>
          </View>
          <Text style={[s.announcementText, { color: c.text }]}>
            Futuros perpetuos con apalancamiento hasta 125x
          </Text>
          <Feather name="chevron-right" size={16} color={c.textMuted} />
        </View>
      </ScrollView>
    </View>
  );
}

function StatBlock({
  label,
  value,
  sub,
  positive,
  muted,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
  muted?: boolean;
}) {
  const { c } = useTheme();
  const valueColor = muted ? c.text : positive ? c.greenDark : c.red;
  return (
    <View style={s.stat}>
      <Text style={[s.statLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={[s.statSub, { color: c.textMuted }]}>{sub}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.quick,
        {
          backgroundColor: primary ? c.ink : c.surface,
          borderColor: primary ? c.ink : c.border,
        },
      ]}
    >
      <Feather name={icon} size={16} color={primary ? c.bg : c.text} />
      <Text
        style={[
          s.quickLabel,
          { color: primary ? c.bg : c.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  topActions: {
    flexDirection: "row",
    gap: 8,
  },
  topPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  topPillText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },

  /* Hero editorial */
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deltaTri: {
    fontFamily: fontFamily[700],
    fontSize: 12,
  },
  deltaText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  deltaSep: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    opacity: 0.6,
  },

  /* Stats card */
  statsCard: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: 4,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  statLabel: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.1,
  },
  statValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  statSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },

  /* Quick actions */
  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  quick: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  quickLabel: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.1,
  },

  /* Section heads */
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 10,
  },
  sectionEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
  },
  sectionLink: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* Top gainers strip */
  gainersStrip: {
    paddingHorizontal: 20,
    gap: 10,
  },
  gainerCard: {
    width: 140,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  gainerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gainerTicker: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  levTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  levTagText: {
    fontFamily: fontFamily[700],
    fontSize: 9,
    letterSpacing: 0.4,
  },
  gainerPrice: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  gainerChange: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    marginTop: 2,
  },

  /* Watchlist */
  watchlistCard: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md + 2,
    paddingHorizontal: 14,
    gap: 10,
  },
  watchTicker: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  watchVol: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  watchRight: {
    alignItems: "flex-end",
    minWidth: 92,
    gap: 4,
  },
  watchPrice: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  changePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  changePillText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
  },

  /* Announcement */
  announcement: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  announcementTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  announcementTagText: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 0.8,
  },
  announcementText: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
});
