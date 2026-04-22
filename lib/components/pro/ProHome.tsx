import { useMemo, useState } from "react";
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
import { useTheme, fontFamily, radius, spacing, proAccent } from "../../theme";
import {
  assets,
  formatPct,
  formatVolume,
  type Asset,
} from "../../data/assets";
import { useFavorites } from "../../favorites/context";
import { Sparkline, seriesFromSeed } from "../Sparkline";
import { SideMenu } from "../SideMenu";

const USDT_RATE = 1200; // ARS per USDT mock

export function ProHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { favorites } = useFavorites();
  const [menuOpen, setMenuOpen] = useState(false);

  // Convert ARS-priced held assets to USDT equivalent
  const { equityUsdt, pnlUsdt, pnlPct } = useMemo(() => {
    const held = assets.filter((a) => a.held);
    const totalArs = held.reduce((s, a) => s + a.price * (a.qty ?? 1), 0);
    const equity = totalArs / USDT_RATE;
    const pnl = equity * 0.0162;
    return { equityUsdt: equity, pnlUsdt: pnl, pnlPct: 1.62 };
  }, []);

  // Watchlist: favoritos + si hay pocos, completar con top movers cripto/futuros
  const watchlist = useMemo(() => {
    const favList = assets.filter((a) => favorites.has(a.ticker));
    if (favList.length >= 5) return favList.slice(0, 8);
    const filler = assets
      .filter(
        (a) =>
          !favorites.has(a.ticker) &&
          (a.category === "cripto" || a.category === "futuros") &&
          a.ticker !== "ARS" &&
          a.ticker !== "USD",
      )
      .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
    return [...favList, ...filler].slice(0, 8);
  }, [favorites]);

  const topGainers = useMemo(
    () =>
      [...assets]
        .filter((a) => a.category === "cripto" || a.category === "futuros")
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
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
        >
          <Feather name="menu" size={18} color={c.text} />
        </Pressable>
        <View style={s.proBadgeWrap}>
          <View style={[s.proDot, { backgroundColor: proAccent.yellow }]} />
          <Text style={[s.proBadge, { color: c.text }]}>ALAMOS PRO</Text>
        </View>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.push("/(app)/notifications")}
          hitSlop={8}
        >
          <Feather name="bell" size={18} color={c.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Equity card */}
        <View
          style={[
            s.equityCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={s.equityHead}>
            <Text style={[s.equityLabel, { color: c.textMuted }]}>
              TOTAL EQUITY
            </Text>
            <Pressable hitSlop={6}>
              <Feather name="eye" size={14} color={c.textMuted} />
            </Pressable>
          </View>
          <Text style={[s.equityValue, { color: c.text }]}>
            {equityUsdt.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            <Text style={[s.equityUnit, { color: c.textMuted }]}> USDT</Text>
          </Text>
          <Text style={[s.equityAlt, { color: c.textMuted }]}>
            ≈ $ {(equityUsdt * USDT_RATE).toLocaleString("es-AR", {
              maximumFractionDigits: 0,
            })}
          </Text>

          <View style={s.statsRow}>
            <StatBlock
              label="P&L 24h"
              value={`+${pnlUsdt.toFixed(2)}`}
              sub={`+${pnlPct.toFixed(2)}%`}
              positive
            />
            <View style={[s.statsDivider, { backgroundColor: c.border }]} />
            <StatBlock
              label="Unrealized"
              value="+84.20"
              sub="+0.54%"
              positive
            />
            <View style={[s.statsDivider, { backgroundColor: c.border }]} />
            <StatBlock
              label="Margin"
              value="42%"
              sub="available"
              muted
            />
          </View>
        </View>

        {/* Quick actions */}
        <View style={s.quickRow}>
          <QuickAction
            icon="arrow-down-left"
            label="Depositar"
            onPress={() => router.push("/(app)/transfer")}
          />
          <QuickAction
            icon="arrow-up-right"
            label="Retirar"
            onPress={() => router.push("/(app)/transfer")}
          />
          <QuickAction
            icon="repeat"
            label="Convert"
            onPress={() => router.push("/(app)/transfer")}
          />
          <QuickAction
            icon="trending-up"
            label="Trade"
            onPress={() => router.push("/(app)/explore")}
            accent
          />
        </View>

        {/* Top gainers strip */}
        <View style={s.sectionHead}>
          <Text style={[s.sectionTitle, { color: c.text }]}>Top Gainers</Text>
          <Pressable onPress={() => router.push("/(app)/explore")}>
            <Text style={[s.sectionLink, { color: c.textMuted }]}>
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
              <Text style={[s.gainerTicker, { color: c.text }]}>
                {a.ticker}
              </Text>
              <Sparkline
                series={seriesFromSeed(a.ticker, 18, a.change >= 0 ? "up" : "down")}
                color={a.change >= 0 ? c.green : c.red}
                height={36}
                withFill={false}
                style={{ marginHorizontal: 0, marginVertical: 6 }}
              />
              <Text style={[s.gainerPrice, { color: c.text }]}>
                {a.price.toLocaleString("en-US", {
                  maximumFractionDigits: 4,
                })}
              </Text>
              <Text
                style={[
                  s.gainerChange,
                  { color: a.change >= 0 ? c.green : c.red },
                ]}
              >
                {formatPct(a.change)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Watchlist */}
        <View style={s.sectionHead}>
          <Text style={[s.sectionTitle, { color: c.text }]}>Watchlist</Text>
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
                      { color: a.change >= 0 ? c.green : c.red },
                    ]}
                  >
                    {formatPct(a.change)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Announcement */}
        <View
          style={[
            s.announcement,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View
            style={[
              s.announcementTag,
              { backgroundColor: proAccent.yellowDim },
            ]}
          >
            <Text
              style={[
                s.announcementTagText,
                { color: proAccent.yellow },
              ]}
            >
              NUEVO
            </Text>
          </View>
          <Text style={[s.announcementText, { color: c.text }]}>
            Apalancamiento hasta 125x en BTCUSDT.P
          </Text>
          <Feather name="chevron-right" size={16} color={c.textMuted} />
        </View>
      </ScrollView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
  const valueColor = muted ? c.text : positive ? c.green : c.red;
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
  accent,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.quick,
        {
          backgroundColor: accent ? proAccent.yellow : c.surface,
          borderColor: accent ? proAccent.yellow : c.border,
        },
      ]}
    >
      <Feather name={icon} size={16} color={accent ? c.ink : c.text} />
      <Text
        style={[
          s.quickLabel,
          { color: accent ? c.ink : c.text },
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  proBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  proDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  proBadge: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
  },

  /* Equity card */
  equityCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 18,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  equityHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  equityLabel: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 1.2,
  },
  equityValue: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1.1,
    lineHeight: 36,
  },
  equityUnit: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  equityAlt: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 4,
  },

  /* Stats row */
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 16,
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: 4,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontFamily: fontFamily[600],
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
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
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  quick: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
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
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontFamily: fontFamily[500],
    fontSize: 12,
  },

  /* Top gainers strip */
  gainersStrip: {
    paddingHorizontal: 16,
    gap: 10,
  },
  gainerCard: {
    width: 130,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  gainerTicker: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  gainerPrice: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  gainerChange: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    marginTop: 2,
  },

  /* Watchlist */
  watchlistCard: {
    marginHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
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
    fontSize: 10,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  watchRight: {
    alignItems: "flex-end",
    minWidth: 88,
    gap: 4,
  },
  watchPrice: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  changePill: {
    paddingHorizontal: 6,
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
    marginHorizontal: 16,
    marginTop: 24,
    padding: 12,
    borderRadius: radius.md,
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
