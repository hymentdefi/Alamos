import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

/* ─── Crypto data ─── */
interface CryptoData {
  symbol: string;
  name: string;
  priceUSD: number;
  priceARS: number;
  iconColor: string;
  description: string;
  marketCap: string;
  volume24h: string;
  supply: string;
  maxSupply: string;
  allTimeHigh: string;
  allTimeLow: string;
}

const cryptoData: Record<string, CryptoData> = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    priceUSD: 67430,
    priceARS: 86_645_430,
    iconColor: "#F7931A",
    description: "Bitcoin (BTC) fue creado en 2008 por una persona o grupo bajo el seudónimo Satoshi Nakamoto. Bitcoin es una moneda digital descentralizada que funciona sobre una red peer-to-peer sin necesidad de intermediarios. Es la primera y más conocida criptomoneda del mundo.",
    marketCap: "$1.32T",
    volume24h: "$28.5B",
    supply: "19.6M BTC",
    maxSupply: "21M BTC",
    allTimeHigh: "$73,750",
    allTimeLow: "$67.81",
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    priceUSD: 3520,
    priceARS: 4_523_200,
    iconColor: "#627EEA",
    description: "Ethereum (ETH) es una plataforma de blockchain descentralizada que permite la creación de contratos inteligentes y aplicaciones descentralizadas (dApps). Fue propuesta por Vitalik Buterin en 2013 y lanzada en 2015.",
    marketCap: "$423B",
    volume24h: "$15.2B",
    supply: "120.2M ETH",
    maxSupply: "Sin límite",
    allTimeHigh: "$4,891",
    allTimeLow: "$0.43",
  },
  SOL: {
    symbol: "SOL",
    name: "Solana",
    priceUSD: 142,
    priceARS: 182_390,
    iconColor: "#9945FF",
    description: "Solana (SOL) es una blockchain de alto rendimiento diseñada para aplicaciones descentralizadas y criptomonedas. Ofrece transacciones rápidas y de bajo costo utilizando un mecanismo de consenso de prueba de historia.",
    marketCap: "$64.2B",
    volume24h: "$3.8B",
    supply: "441M SOL",
    maxSupply: "Sin límite",
    allTimeHigh: "$260",
    allTimeLow: "$0.50",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether",
    priceUSD: 1.00,
    priceARS: 1285,
    iconColor: "#26A17B",
    description: "Tether (USDT) es una stablecoin respaldada por el dólar estadounidense. Cada token USDT está diseñado para mantener un valor de 1 dólar, lo que lo convierte en una herramienta popular para preservar valor en el ecosistema crypto.",
    marketCap: "$95.8B",
    volume24h: "$52.1B",
    supply: "95.8B USDT",
    maxSupply: "Sin límite",
    allTimeHigh: "$1.22",
    allTimeLow: "$0.57",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    priceUSD: 1.00,
    priceARS: 1284,
    iconColor: "#2775CA",
    description: "USD Coin (USDC) es una stablecoin respaldada por reservas en dólares y bonos del Tesoro de EE.UU. Emitida por Circle y Coinbase, es una de las stablecoins más reguladas y transparentes del mercado.",
    marketCap: "$32.4B",
    volume24h: "$8.7B",
    supply: "32.4B USDC",
    maxSupply: "Sin límite",
    allTimeHigh: "$1.17",
    allTimeLow: "$0.88",
  },
};

const defaultCrypto: CryptoData = {
  symbol: "???",
  name: "Crypto",
  priceUSD: 0,
  priceARS: 0,
  iconColor: colors.text.muted,
  description: "Información no disponible.",
  marketCap: "—",
  volume24h: "—",
  supply: "—",
  maxSupply: "—",
  allTimeHigh: "—",
  allTimeLow: "—",
};

/* ─── Time filters ─── */
const timeFilters = ["LIVE", "1D", "1S", "1M", "3M", "1A", "5A"];
type ChartType = "line" | "candle";

const changeByTime: Record<string, { amount: number; pct: number }> = {
  LIVE: { amount: 12340, pct: 0.01 },
  "1D": { amount: -78520, pct: -0.09 },
  "1S": { amount: 2_103_450, pct: 2.49 },
  "1M": { amount: 467_230, pct: 0.54 },
  "3M": { amount: -11_112_340, pct: -11.37 },
  "1A": { amount: -52_435_120, pct: -37.71 },
  "5A": { amount: 23_312_450, pct: 36.83 },
};

/* ─── News ─── */
interface CryptoNews {
  source: string;
  time: string;
  headline: string;
  tickers?: { ticker: string; change: number }[];
}

const cryptoNews: CryptoNews[] = [
  {
    source: "CoinDesk",
    time: "2h",
    headline: "Bitcoin supera los $67.000 y los analistas esperan un nuevo máximo histórico antes de fin de año",
  },
  {
    source: "Infobae Crypto",
    time: "5h",
    headline: "Argentina lidera la adopción de stablecoins en Latinoamérica: USDT y USDC como refugio de valor",
    tickers: [
      { ticker: "USDT", change: 0.01 },
      { ticker: "USDC", change: -0.02 },
    ],
  },
  {
    source: "CriptoNoticias",
    time: "8h",
    headline: "Ethereum se prepara para su próxima actualización: qué esperar del mercado",
    tickers: [
      { ticker: "ETH", change: 1.87 },
    ],
  },
];

function formatCryptoARS(n: number): string {
  return "$" + n.toLocaleString("es-AR");
}

export default function CryptoDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTime, setActiveTime] = useState("1D");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [showMore, setShowMore] = useState(false);

  const coin = cryptoData[symbol || "BTC"] || defaultCrypto;
  const change = changeByTime[activeTime] || { amount: 0, pct: 0 };
  const isPositive = change.pct >= 0;
  const chartColor = isPositive ? colors.brand[500] : colors.red;

  return (
    <View style={s.container}>
      {/* ── Sticky header ── */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerPrice}>{formatCryptoARS(coin.priceARS)}</Text>
          <Text style={s.headerName}>{coin.name}</Text>
        </View>
        <View style={s.headerRight}>
          <Pressable>
            <Ionicons name="share-outline" size={20} color={colors.text.primary} />
          </Pressable>
          <Pressable>
            <Ionicons name="checkmark-circle" size={22} color={colors.brand[500]} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero gradient area ── */}
        <View style={s.heroArea}>
          <View style={[s.heroGradient, { backgroundColor: isPositive ? "#0a2a1a" : "#2a0a0a" }]} />
        </View>

        {/* ── Price section ── */}
        <View style={s.priceSection}>
          <Text style={s.symbolLabel}>{coin.symbol}</Text>
          <Text style={s.coinName}>{coin.name}</Text>
          <Text style={s.price}>{formatCryptoARS(coin.priceARS)}</Text>
          <Text style={[s.changeLine, { color: chartColor }]}>
            {isPositive ? "▲" : "▼"} {formatCryptoARS(Math.abs(change.amount))} ({isPositive ? "+" : ""}{change.pct.toFixed(2)}%) {activeTime === "1D" ? "Hoy" : activeTime}
          </Text>
        </View>

        {/* ── Chart area ── */}
        <View style={s.chartArea}>
          <View style={s.chartGrid}>
            <View style={[s.chartGridLine, { top: "0%" }]} />
            <View style={[s.chartGridLine, { top: "33%" }]} />
            <View style={[s.chartGridLine, { top: "66%" }]} />
            <View style={[s.chartGridLine, { top: "100%" }]} />
          </View>
          {chartType === "line" ? (
            <View style={[s.chartLineMain, { backgroundColor: chartColor }]} />
          ) : (
            /* Candlestick placeholder */
            <View style={s.candlePlaceholder}>
              {Array.from({ length: 20 }).map((_, i) => {
                const up = Math.random() > 0.45;
                const h = 20 + Math.random() * 60;
                return (
                  <View key={i} style={s.candleCol}>
                    <View style={[s.candleWick, { height: h * 0.3, backgroundColor: up ? colors.brand[500] : colors.red }]} />
                    <View style={[s.candleBody, { height: h * 0.5, backgroundColor: up ? colors.brand[500] : colors.red }]} />
                    <View style={[s.candleWick, { height: h * 0.2, backgroundColor: up ? colors.brand[500] : colors.red }]} />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Time filters ── */}
        <View style={s.timeFilters}>
          {activeTime === "LIVE" && <View style={s.liveDot} />}
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
          {/* Chart type toggle */}
          <Pressable
            style={s.chartToggle}
            onPress={() => setChartType(chartType === "line" ? "candle" : "line")}
          >
            <Ionicons
              name={chartType === "line" ? "bar-chart" : "analytics"}
              size={16}
              color={colors.text.muted}
            />
          </Pressable>
        </View>

        {/* ── Your position ── */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Tu posición</Text>
          <View style={s.posGrid}>
            <View style={s.posItem}>
              <Text style={s.posLabel}>Cantidad</Text>
              <Text style={s.posValue}>0.00</Text>
            </View>
            <View style={s.posItem}>
              <Text style={s.posLabel}>Valor</Text>
              <Text style={s.posValue}>{formatCryptoARS(0)}</Text>
            </View>
          </View>

          {/* Send / Receive buttons */}
          <View style={s.actionBtns}>
            <Pressable style={s.actionBtn}>
              <Text style={s.actionBtnText}>Enviar</Text>
            </Pressable>
            <Pressable style={s.actionBtn}>
              <Text style={s.actionBtnText}>Recibir</Text>
            </Pressable>
          </View>
        </View>

        {/* ── About ── */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Acerca de</Text>
          <Text style={s.aboutText} numberOfLines={showMore ? undefined : 3}>
            {coin.description}
          </Text>
          <Pressable onPress={() => setShowMore(!showMore)}>
            <Text style={s.greenLink}>{showMore ? "Ver menos" : "Ver más"}</Text>
          </Pressable>
        </View>

        {/* ── Stats ── */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Estadísticas</Text>
          <View style={s.statsGrid}>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Cap. mercado</Text>
              <Text style={s.statValue}>{coin.marketCap}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Volumen 24h</Text>
              <Text style={s.statValue}>{coin.volume24h}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Circulante</Text>
              <Text style={s.statValue}>{coin.supply}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Supply máx.</Text>
              <Text style={s.statValue}>{coin.maxSupply}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Máximo histórico</Text>
              <Text style={s.statValue}>{coin.allTimeHigh}</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statLabel}>Mínimo histórico</Text>
              <Text style={s.statValue}>{coin.allTimeLow}</Text>
            </View>
          </View>
        </View>

        {/* ── News ── */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Noticias</Text>
          {cryptoNews.map((item, idx) => (
            <View key={idx}>
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
                  {item.tickers && (
                    <View style={s.newsTickerRow}>
                      {item.tickers.map((t) => {
                        const isUp = t.change >= 0;
                        return (
                          <View key={t.ticker} style={s.newsTickerPill}>
                            <Text style={s.newsTickerName}>{t.ticker}</Text>
                            <Text style={[s.newsTickerChange, { color: isUp ? colors.brand[500] : colors.red }]}>
                              {isUp ? "+" : ""}{t.change.toFixed(2)}%
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
                <View style={s.newsImagePlaceholder}>
                  <Ionicons name="image-outline" size={20} color={colors.text.muted} />
                </View>
              </Pressable>
              {idx < cryptoNews.length - 1 && <View style={s.newsItemDivider} />}
            </View>
          ))}
          <Pressable>
            <Text style={s.greenLink}>Ver más noticias</Text>
          </Pressable>
        </View>

        {/* ── Disclaimer ── */}
        <View style={s.disclaimerSection}>
          <Text style={s.disclaimerText}>
            Las criptomonedas no son valores negociables y no están reguladas por la CNV ni garantizadas por el Estado argentino. Las inversiones en criptomonedas implican riesgo significativo, incluyendo la posible pérdida total del capital. Podés aprender más en el Centro de Ayuda de Álamos.
          </Text>
        </View>
      </ScrollView>

      {/* ── Floating Buy button ── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable style={s.buyBtn}>
          <Text style={s.buyBtnText}>Comprar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerName: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  headerRight: {
    flexDirection: "row",
    gap: 14,
  },

  /* Hero gradient */
  heroArea: {
    position: "relative",
    height: 20,
  },
  heroGradient: {
    position: "absolute",
    top: -100,
    left: 0,
    right: 0,
    height: 160,
    opacity: 0.5,
  },

  /* Price section */
  priceSection: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 4,
  },
  symbolLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: "500",
    marginBottom: 2,
  },
  coinName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1,
  },
  changeLine: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },

  /* Chart */
  chartArea: {
    height: 240,
    paddingHorizontal: 4,
    marginTop: 8,
    position: "relative",
    justifyContent: "center",
  },
  chartGrid: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 20,
    bottom: 20,
  },
  chartGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.2,
  },
  chartLineMain: {
    height: 2,
    marginHorizontal: 20,
    borderRadius: 1,
    opacity: 0.6,
  },
  candlePlaceholder: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 160,
    marginHorizontal: 20,
  },
  candleCol: {
    alignItems: "center",
    width: 8,
  },
  candleWick: {
    width: 1,
  },
  candleBody: {
    width: 6,
    borderRadius: 1,
  },

  /* Time filters */
  timeFilters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
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
    fontSize: 12,
    fontWeight: "600",
    color: colors.text.muted,
  },
  chartToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Shared */
  divider: {
    height: 6,
    backgroundColor: colors.surface[100],
    marginVertical: 4,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  greenLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand[500],
    marginTop: 8,
  },

  /* Position */
  posGrid: {
    flexDirection: "row",
    marginBottom: 16,
  },
  posItem: {
    flex: 1,
  },
  posLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  posValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  actionBtns: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* About */
  aboutText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 4,
  },

  /* Stats */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  statItem: {
    width: "50%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingRight: 20,
  },
  statLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.primary,
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
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
  },
  newsItemDivider: {
    height: 1,
    backgroundColor: colors.border,
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

  /* Bottom bar */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.surface[0],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buyBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface[0],
  },
});
