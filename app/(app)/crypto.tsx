import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── Time filters ─── */
const timeFilters = ["LIVE", "1D", "1S", "1M", "3M", "YTD", "1A"];
const timeLabels: Record<string, string> = {
  LIVE: "En vivo",
  "1D": "Hoy",
  "1S": "Última semana",
  "1M": "Último mes",
  "3M": "Últimos 3 meses",
  YTD: "Este año",
  "1A": "Último año",
};

const changeByTime: Record<string, { amount: number; pct: number }> = {
  LIVE: { amount: 0, pct: 0 },
  "1D": { amount: 0, pct: 0 },
  "1S": { amount: 0, pct: 0 },
  "1M": { amount: 0, pct: 0 },
  "3M": { amount: 0, pct: 0 },
  YTD: { amount: 0, pct: 0 },
  "1A": { amount: 0, pct: 0 },
};

/* ─── Crypto assets ─── */
interface CryptoAsset {
  symbol: string;
  name: string;
  priceUSD: number;
  priceARS: number;
  change24h: number;
  tradable: boolean;
  iconColor: string;
}

const cryptoAssets: CryptoAsset[] = [
  { symbol: "BTC", name: "Bitcoin", priceUSD: 67430, priceARS: 86_645_430, change24h: 2.14, tradable: true, iconColor: "#F7931A" },
  { symbol: "ETH", name: "Ethereum", priceUSD: 3520, priceARS: 4_523_200, change24h: 1.87, tradable: true, iconColor: "#627EEA" },
  { symbol: "SOL", name: "Solana", priceUSD: 142, priceARS: 182_390, change24h: -3.21, tradable: true, iconColor: "#9945FF" },
  { symbol: "USDT", name: "Tether", priceUSD: 1.00, priceARS: 1285, change24h: 0.01, tradable: true, iconColor: "#26A17B" },
  { symbol: "USDC", name: "USD Coin", priceUSD: 1.00, priceARS: 1284, change24h: -0.02, tradable: true, iconColor: "#2775CA" },
  { symbol: "XRP", name: "Ripple", priceUSD: 0.62, priceARS: 796, change24h: 0.45, tradable: true, iconColor: "#00AAE4" },
  { symbol: "ADA", name: "Cardano", priceUSD: 0.45, priceARS: 578, change24h: -1.82, tradable: true, iconColor: "#0033AD" },
  { symbol: "DOGE", name: "Dogecoin", priceUSD: 0.12, priceARS: 154, change24h: 5.23, tradable: true, iconColor: "#C2A633" },
  { symbol: "DOT", name: "Polkadot", priceUSD: 7.40, priceARS: 9_506, change24h: -0.78, tradable: false, iconColor: "#E6007A" },
  { symbol: "AVAX", name: "Avalanche", priceUSD: 35.20, priceARS: 45_232, change24h: 1.15, tradable: false, iconColor: "#E84142" },
  { symbol: "LINK", name: "Chainlink", priceUSD: 14.50, priceARS: 18_632, change24h: 2.87, tradable: false, iconColor: "#2A5ADA" },
  { symbol: "MATIC", name: "Polygon", priceUSD: 0.82, priceARS: 1053, change24h: -2.14, tradable: false, iconColor: "#8247E5" },
];

function formatCryptoARS(n: number): string {
  return "$" + n.toLocaleString("es-AR");
}

export default function CryptoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTime, setActiveTime] = useState("1D");
  const [activeFilter, setActiveFilter] = useState<"tradable" | "non-tradable">("tradable");

  const change = changeByTime[activeTime];
  const isPositive = change.pct >= 0;
  const chartColor = isPositive ? colors.brand[500] : colors.red;

  const filteredCrypto = cryptoAssets.filter((c) =>
    activeFilter === "tradable" ? c.tradable : !c.tradable
  );

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top bar ── */}
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={{ width: 48 }} />
          <View style={s.topBarRight}>
            <Pressable onPress={() => router.push("/(app)/explore")}>
              <Ionicons name="search" size={24} color={colors.text.primary} />
            </Pressable>
            <Pressable>
              <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* ── Gradient header area ── */}
        <View style={s.heroArea}>
          <View style={s.heroGradient} />
          <View style={s.heroContent}>
            <Text style={s.heroTitle}>Crypto</Text>
            <View style={s.heroValueRow}>
              <Text style={s.heroValue}>{formatCryptoARS(0)}</Text>
              <Pressable>
                <Ionicons name="information-circle-outline" size={18} color={colors.text.muted} style={{ marginLeft: 6 }} />
              </Pressable>
            </View>
            <Text style={[s.heroChange, { color: chartColor }]}>
              {isPositive ? "▲" : "▼"} {formatCryptoARS(Math.abs(change.amount))} ({isPositive ? "+" : ""}{change.pct.toFixed(2)}%) {timeLabels[activeTime]}
            </Text>
          </View>
        </View>

        {/* ── Chart area ── */}
        <View style={s.chartArea}>
          <View style={[s.chartLine, { backgroundColor: chartColor }]} />
        </View>

        {/* ── Time filters ── */}
        <View style={s.timeFilters}>
          {activeTime === "LIVE" && (
            <View style={s.liveDot} />
          )}
          {timeFilters.map((t) => (
            <Pressable
              key={t}
              style={[s.timeBtn, activeTime === t && [s.timeBtnActive, { borderColor: chartColor }]]}
              onPress={() => setActiveTime(t)}
            >
              <Text style={[s.timeBtnText, activeTime === t && { color: colors.text.primary }]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Explore cryptocurrencies ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Explorá criptomonedas</Text>

          {/* Filter tabs */}
          <View style={s.filterRow}>
            <Pressable
              style={[s.filterTab, activeFilter === "tradable" && s.filterTabActive]}
              onPress={() => setActiveFilter("tradable")}
            >
              <Text style={[s.filterTabText, activeFilter === "tradable" && s.filterTabTextActive]}>
                Operables
              </Text>
            </Pressable>
            <Pressable
              style={[s.filterTab, activeFilter === "non-tradable" && s.filterTabActive]}
              onPress={() => setActiveFilter("non-tradable")}
            >
              <Text style={[s.filterTabText, activeFilter === "non-tradable" && s.filterTabTextActive]}>
                No operables
              </Text>
            </Pressable>
          </View>

          {/* Crypto list */}
          {filteredCrypto.map((coin) => {
            const isUp = coin.change24h >= 0;
            return (
              <Pressable
                key={coin.symbol}
                style={s.coinRow}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/crypto-detail",
                    params: { symbol: coin.symbol },
                  })
                }
              >
                <View style={s.coinLeft}>
                  <View style={[s.coinIcon, { backgroundColor: coin.iconColor + "20" }]}>
                    <Text style={[s.coinIconText, { color: coin.iconColor }]}>
                      {coin.symbol.substring(0, 2)}
                    </Text>
                  </View>
                  <View style={s.coinInfo}>
                    <Text style={s.coinSymbol}>{coin.symbol}</Text>
                    <Text style={s.coinName}>{coin.name}</Text>
                  </View>
                </View>

                {/* Mini chart placeholder */}
                <View style={s.coinMiniChart}>
                  <View style={[s.coinMiniLine, { backgroundColor: isUp ? colors.brand[500] : colors.red }]} />
                </View>

                {/* Price badge */}
                <View style={[s.coinPriceBadge, { backgroundColor: isUp ? "rgba(0,230,118,0.15)" : "rgba(255,68,68,0.15)" }]}>
                  <Text style={[s.coinPriceText, { color: isUp ? colors.brand[500] : colors.red }]}>
                    {formatCryptoARS(coin.priceARS)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Security notice ── */}
        <View style={s.section}>
          <View style={s.securityCard}>
            <Ionicons name="shield-checkmark" size={28} color={colors.brand[500]} />
            <View style={s.securityInfo}>
              <Text style={s.securityTitle}>Protegé tus crypto</Text>
              <Text style={s.securityDesc}>
                Álamos nunca te va a pedir que actives transferencias de crypto por teléfono o email.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Disclaimer ── */}
        <View style={s.disclaimerSection}>
          <Text style={s.disclaimerText}>
            Las criptomonedas no son valores negociables y no están cubiertas por la CNV ni garantizadas por el Estado. Las inversiones en criptomonedas implican un alto riesgo y pueden perder todo su valor. Operá con precaución.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 0,
    zIndex: 10,
  },
  topBarRight: { flexDirection: "row", gap: 20 },

  /* Hero */
  heroArea: {
    position: "relative",
    paddingBottom: 8,
  },
  heroGradient: {
    position: "absolute",
    top: -80,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "#0a2a1a",
    opacity: 0.6,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "300",
    color: colors.text.secondary,
    letterSpacing: -0.5,
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroValue: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1,
  },
  heroChange: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },

  /* Chart */
  chartArea: {
    height: 220,
    paddingHorizontal: 4,
    marginTop: 8,
    justifyContent: "center",
  },
  chartLine: {
    height: 2,
    marginHorizontal: 20,
    borderRadius: 1,
    opacity: 0.5,
  },

  /* Time filters */
  timeFilters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 4,
    alignItems: "center",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand[500],
    marginRight: 2,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  timeBtnActive: {
    borderWidth: 1,
  },
  timeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.muted,
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
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 14,
  },

  /* Filter tabs */
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },
  filterTabTextActive: {
    color: colors.surface[0],
  },

  /* Coin row */
  coinRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  coinLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coinIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  coinIconText: {
    fontSize: 13,
    fontWeight: "800",
  },
  coinInfo: {},
  coinSymbol: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  coinName: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  coinMiniChart: {
    width: 56,
    height: 28,
    justifyContent: "center",
    marginHorizontal: 10,
  },
  coinMiniLine: {
    height: 1.5,
    borderRadius: 1,
  },
  coinPriceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  coinPriceText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* Security card */
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface[100],
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  securityInfo: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 4,
  },
  securityDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  /* Disclaimer */
  disclaimerSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
  },
});
