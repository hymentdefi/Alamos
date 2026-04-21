import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { assets, formatARS } from "../../lib/data/assets";
import { useTheme } from "../../lib/theme";

const timeFilters = ["1D", "1S", "1M", "3M", "1A", "MAX"] as const;

interface CompanyInfo {
  shortName: string;
  description: string;
  sector: string;
  market: string;
  risk: string;
}

const companyInfo: Record<string, CompanyInfo> = {
  YPFD: {
    shortName: "YPF",
    description: "Principal empresa de energia de Argentina, con exposicion a petroleo, gas y refinacion.",
    sector: "Energia",
    market: "Acciones AR",
    risk: "Media",
  },
  GD30: {
    shortName: "GD30",
    description: "Bono soberano en dolares emitido por Argentina con vencimiento en 2030.",
    sector: "Bonos",
    market: "Renta fija",
    risk: "Alta",
  },
  ALUA: {
    shortName: "Aluar",
    description: "Productor argentino de aluminio con fuerte sensibilidad al ciclo industrial local.",
    sector: "Materiales",
    market: "Acciones AR",
    risk: "Media",
  },
  "AAPL.BA": {
    shortName: "Apple",
    description: "CEDEAR de Apple, una de las companias tecnologicas mas grandes del mundo.",
    sector: "Tecnologia",
    market: "CEDEAR",
    risk: "Media",
  },
  "MSFT.BA": {
    shortName: "Microsoft",
    description: "CEDEAR de Microsoft, con exposicion a software, nube e inteligencia artificial.",
    sector: "Tecnologia",
    market: "CEDEAR",
    risk: "Media",
  },
};

const defaultInfo: CompanyInfo = {
  shortName: "Activo",
  description: "Activo disponible para invertir desde Alamos.",
  sector: "General",
  market: "Mercado",
  risk: "Media",
};

const relatedByTicker: Record<string, string[]> = {
  YPFD: ["PAMP", "ALUA", "TXAR"],
  ALUA: ["TXAR", "YPFD", "PAMP"],
  "AAPL.BA": ["MSFT.BA", "AMZN.BA", "TSLA.BA"],
  default: ["YPFD", "GD30", "AAPL.BA"],
};

function chartPoints(period: (typeof timeFilters)[number], positive: boolean): number[] {
  const rising: Record<(typeof timeFilters)[number], number[]> = {
    "1D": [38, 40, 39, 43, 46, 44, 48, 50, 49, 52, 55, 57, 56, 60, 63, 62, 66, 68, 70, 73],
    "1S": [45, 44, 46, 48, 47, 49, 50, 52, 54, 53, 55, 57, 59, 60, 62, 61, 63, 64, 66, 68],
    "1M": [32, 35, 37, 36, 40, 43, 42, 46, 44, 48, 50, 49, 52, 54, 57, 56, 60, 62, 64, 67],
    "3M": [25, 28, 30, 34, 33, 37, 40, 42, 41, 45, 47, 50, 52, 55, 57, 60, 62, 64, 67, 70],
    "1A": [20, 22, 25, 29, 31, 35, 34, 39, 41, 45, 49, 48, 53, 56, 59, 61, 64, 68, 70, 74],
    "MAX": [12, 16, 20, 24, 28, 32, 31, 36, 40, 44, 49, 52, 56, 60, 63, 67, 70, 74, 77, 82],
  };

  const falling: Record<(typeof timeFilters)[number], number[]> = {
    "1D": [62, 60, 58, 59, 55, 53, 54, 51, 48, 47, 45, 43, 44, 40, 38, 36, 37, 34, 35, 33],
    "1S": [66, 64, 62, 63, 61, 59, 58, 56, 55, 54, 52, 53, 50, 49, 47, 46, 45, 43, 44, 42],
    "1M": [72, 70, 68, 66, 67, 64, 61, 60, 58, 56, 57, 53, 50, 49, 46, 45, 43, 41, 39, 38],
    "3M": [78, 75, 73, 70, 68, 66, 63, 61, 60, 57, 55, 53, 50, 49, 46, 44, 42, 39, 37, 35],
    "1A": [86, 82, 79, 75, 72, 69, 66, 62, 60, 57, 54, 51, 48, 45, 43, 41, 38, 36, 34, 32],
    "MAX": [92, 88, 84, 80, 77, 72, 68, 64, 61, 57, 54, 50, 47, 43, 40, 37, 34, 31, 29, 27],
  };

  return positive ? rising[period] : falling[period];
}

export default function DetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const [activeTime, setActiveTime] = useState<(typeof timeFilters)[number]>("1D");
  const [showTradeSheet, setShowTradeSheet] = useState(false);

  const asset = assets.find((item) => item.ticker === ticker);
  if (!asset) return null;

  const info = companyInfo[asset.ticker] || defaultInfo;
  const related = (relatedByTicker[asset.ticker] || relatedByTicker.default)
    .map((code) => assets.find((item) => item.ticker === code))
    .filter(Boolean);

  const isPositive = asset.change >= 0;
  const chartColor = isPositive ? c.green : c.red;
  const points = chartPoints(activeTime, isPositive);
  const priceChangeAmount = Math.round(asset.price * Math.abs(asset.change) / 100);
  const held = asset.held && !!asset.qty;
  const qty = asset.qty || 0;
  const positionValue = asset.price * qty;
  const portfolioShare = ((positionValue / 4287430) * 100).toFixed(1);
  const averageCost = Math.round(asset.price * 0.91);
  const totalReturn = (asset.price - averageCost) * qty;
  const totalReturnPct = averageCost > 0 ? (((asset.price - averageCost) / averageCost) * 100).toFixed(2) : "0.00";

  const statCards = [
    { label: "Mercado", value: info.market },
    { label: "Sector", value: info.sector },
    { label: "Riesgo", value: info.risk },
  ];

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <View
        style={[
          s.fixedTop,
          {
            backgroundColor: c.bg,
            borderBottomColor: c.bg,
            paddingTop: insets.top + 6,
          },
        ]}
      >
        <View style={s.headerRow}>
          <Pressable
            style={[s.headerIcon, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
          <View style={s.headerTitleWrap}>
            <Text style={[s.headerTicker, { color: c.text }]}>{asset.ticker}</Text>
            <Text style={[s.headerName, { color: c.textSecondary }]}>{info.shortName}</Text>
          </View>
          <Pressable
            style={[s.headerIcon, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}
            onPress={() => router.push("/(app)/notifications")}
            hitSlop={12}
          >
            <Ionicons name="notifications-outline" size={18} color={c.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ paddingTop: insets.top + 78, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Text style={[s.companyName, { color: c.text }]}>{asset.name}</Text>
          <Text style={[s.price, { color: c.text }]}>{formatARS(asset.price)}</Text>
          <Text style={[s.changeLine, { color: chartColor }]}>
            {isPositive ? "+" : "-"}
            {formatARS(priceChangeAmount)} ({isPositive ? "+" : ""}
            {asset.change.toFixed(2)}%) {activeTime === "1D" ? "hoy" : "en " + activeTime.toLowerCase()}
          </Text>
        </View>

        <View style={s.chartArea}>
          <View style={[s.chartContent, { borderBottomColor: chartColor }]}>
            {points.map((point, index) => {
              if (index === 0) return null;
              const previous = points[index - 1];
              const segmentWidth = 100 / (points.length - 1);
              const minimum = Math.min(...points);
              const maximum = Math.max(...points);
              const range = maximum - minimum || 1;
              const y1 = 100 - ((previous - minimum) / range) * 100;
              const y2 = 100 - ((point - minimum) / range) * 100;

              return (
                <View
                  key={index}
                  style={{
                    position: "absolute",
                    left: `${(index - 1) * segmentWidth}%`,
                    width: `${segmentWidth}%`,
                    top: `${(y1 + y2) / 2}%`,
                    height: 2,
                    backgroundColor: chartColor,
                    borderRadius: 999,
                    transform: [{ rotate: `${Math.atan2(y2 - y1, segmentWidth) * 0.3}rad` }],
                  }}
                />
              );
            })}
          </View>
        </View>

        <View style={s.timeRow}>
          {timeFilters.map((filter) => {
            const isActive = activeTime === filter;
            return (
              <Pressable
                key={filter}
                style={[
                  s.timeButton,
                  {
                    backgroundColor: isActive ? chartColor : "transparent",
                    borderColor: isActive ? chartColor : "transparent",
                  },
                ]}
                onPress={() => setActiveTime(filter)}
              >
                <Text style={[s.timeButtonText, { color: isActive ? "#000000" : chartColor }]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.cashRow, { borderTopColor: c.border, borderBottomColor: c.border }]}>
          <Text style={[s.cashLabel, { color: c.text }]}>Efectivo disponible</Text>
          <View style={s.cashRight}>
            <Text style={[s.cashValue, { color: c.text }]}>{formatARS(342180)}</Text>
          </View>
        </View>

        {held ? (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.text }]}>Tu posicion</Text>
            <View style={s.positionCard}>
              <View style={[s.positionRow, { borderBottomColor: c.border }]}>
                <Text style={[s.positionLabel, { color: c.textSecondary }]}>Tenes</Text>
                <Text style={[s.positionValue, { color: c.text }]}>{qty} un.</Text>
              </View>
              <View style={[s.positionRow, { borderBottomColor: c.border }]}>
                <Text style={[s.positionLabel, { color: c.textSecondary }]}>Valor actual</Text>
                <Text style={[s.positionValue, { color: c.text }]}>{formatARS(positionValue)}</Text>
              </View>
              <View style={[s.positionRow, { borderBottomColor: c.border }]}>
                <Text style={[s.positionLabel, { color: c.textSecondary }]}>Costo promedio</Text>
                <Text style={[s.positionValue, { color: c.text }]}>{formatARS(averageCost)}</Text>
              </View>
              <View style={s.positionRow}>
                <Text style={[s.positionLabel, { color: c.textSecondary }]}>Resultado total</Text>
                <Text style={[s.positionValue, { color: totalReturn >= 0 ? c.green : c.red }]}>
                  {totalReturn >= 0 ? "+" : "-"}
                  {formatARS(Math.abs(totalReturn))} ({totalReturn >= 0 ? "+" : ""}
                  {totalReturnPct}%)
                </Text>
              </View>
            </View>
            <Text style={[s.positionFootnote, { color: c.textMuted }]}>
              Representa {portfolioShare}% de tu portfolio.
            </Text>
          </View>
        ) : (
          <View style={s.section}>
            <View style={[s.learnCard, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
              <Text style={[s.learnTitle, { color: c.text }]}>Todavia no invertiste en este activo</Text>
              <Text style={[s.learnBody, { color: c.textSecondary }]}>
                Podes empezar con un monto simple en pesos y sumar despues si te convence.
              </Text>
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>Lo importante</Text>
          <Text style={[s.description, { color: c.textSecondary }]}>{info.description}</Text>
          <View style={s.statsRow}>
            {statCards.map((stat) => (
              <View
                key={stat.label}
                style={[s.statCard, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}
              >
                <Text style={[s.statLabel, { color: c.textMuted }]}>{stat.label}</Text>
                <Text style={[s.statValue, { color: c.text }]}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.text }]}>Tambien miran</Text>
          <View style={s.relatedList}>
            {related.map((item) => {
              if (!item) return null;
              const up = item.change >= 0;

              return (
                <Pressable
                  key={item.ticker}
                  style={[s.relatedRow, { borderBottomColor: c.border }]}
                  onPress={() => router.push({ pathname: "/(app)/detail", params: { ticker: item.ticker } })}
                >
                  <View>
                    <Text style={[s.relatedTicker, { color: c.text }]}>{item.ticker}</Text>
                    <Text style={[s.relatedName, { color: c.textSecondary }]}>{item.name}</Text>
                  </View>
                  <Text style={[s.relatedChange, { color: up ? c.green : c.red }]}>
                    {up ? "+" : ""}
                    {item.change.toFixed(2)}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          s.bottomBar,
          {
            backgroundColor: c.bg,
            borderTopColor: c.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <Pressable
          style={[s.secondaryButton, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}
          onPress={() => router.push("/(app)/explore")}
        >
          <Text style={[s.secondaryButtonText, { color: c.text }]}>Explorar</Text>
        </Pressable>
        <Pressable
          style={[s.primaryButton, { backgroundColor: chartColor }]}
          onPress={() => setShowTradeSheet(true)}
        >
          <Text style={s.primaryButtonText}>{held ? "Operar" : "Comprar"}</Text>
        </Pressable>
      </View>

      <Modal
        visible={showTradeSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTradeSheet(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowTradeSheet(false)} />
        <View style={[s.sheet, { backgroundColor: c.surfaceRaised, paddingBottom: insets.bottom + 16 }]}>
          <Text style={[s.sheetTitle, { color: c.text }]}>{asset.ticker}</Text>
          <Pressable
            style={[s.sheetButton, { backgroundColor: c.green }]}
            onPress={() => {
              setShowTradeSheet(false);
              router.push({ pathname: "/(app)/buy", params: { ticker: asset.ticker, mode: "buy" } });
            }}
          >
            <Text style={s.sheetPrimaryText}>Comprar</Text>
          </Pressable>
          {held ? (
            <Pressable
              style={[s.sheetButton, { backgroundColor: c.surfaceHover, borderColor: c.border, borderWidth: 1 }]}
              onPress={() => {
                setShowTradeSheet(false);
                router.push({ pathname: "/(app)/buy", params: { ticker: asset.ticker, mode: "sell" } });
              }}
            >
              <Text style={[s.sheetSecondaryText, { color: c.text }]}>Vender</Text>
            </Pressable>
          ) : null}
          <Pressable style={s.sheetClose} onPress={() => setShowTradeSheet(false)}>
            <Ionicons name="close" size={22} color={c.text} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTicker: {
    fontSize: 15,
    fontWeight: "700",
  },
  headerName: {
    fontSize: 12,
    marginTop: 2,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  companyName: {
    fontSize: 30,
    fontWeight: "500",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  price: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.6,
  },
  changeLine: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
  },
  chartArea: {
    height: 290,
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 12,
  },
  chartContent: {
    height: 240,
    position: "relative",
    borderBottomWidth: 0,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  timeButton: {
    minWidth: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  timeButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  cashRow: {
    marginHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  cashLabel: {
    fontSize: 17,
    fontWeight: "500",
  },
  cashRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cashValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  positionCard: {
    borderRadius: 22,
    overflow: "hidden",
  },
  positionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  positionLabel: {
    fontSize: 14,
  },
  positionValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  positionFootnote: {
    fontSize: 13,
    marginTop: 10,
  },
  learnCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
  },
  learnTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  learnBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  relatedList: {},
  relatedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  relatedTicker: {
    fontSize: 15,
    fontWeight: "700",
  },
  relatedName: {
    fontSize: 13,
    marginTop: 4,
  },
  relatedChange: {
    fontSize: 14,
    fontWeight: "700",
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    width: 92,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  sheetButton: {
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrimaryText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
  },
  sheetSecondaryText: {
    fontSize: 16,
    fontWeight: "700",
  },
  sheetClose: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
