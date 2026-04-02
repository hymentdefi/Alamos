import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";

const { width: SCREEN_W } = Dimensions.get("window");
const timeFilters = ["1D", "1S", "1M", "3M", "1A", "5A"];

/* ─── Mock company info by ticker ─── */
interface CompanyInfo {
  description: string;
  ceo: string;
  founded: string;
  employees: string;
  headquarters: string;
  sector: string;
}

const companyInfo: Record<string, CompanyInfo> = {
  YPFD: {
    description: "YPF S.A. es la principal empresa de energía de Argentina. Se dedica a la exploración, producción, refinación, transporte y comercialización de petróleo y gas natural, así como a la generación de energía eléctrica.",
    ceo: "Horacio Marín",
    founded: "1922",
    employees: "21.500",
    headquarters: "Buenos Aires, Argentina",
    sector: "Energía",
  },
  GD30: {
    description: "Bono Global de la República Argentina con vencimiento en 2030. Denominado en dólares estadounidenses, paga intereses semestrales y fue emitido en el marco de la reestructuración de deuda de 2020.",
    ceo: "—",
    founded: "2020",
    employees: "—",
    headquarters: "Buenos Aires, Argentina",
    sector: "Bonos soberanos",
  },
  ALUA: {
    description: "Aluar Aluminio Argentino S.A.I.C. es el mayor productor de aluminio primario de Argentina. Opera una planta de fundición en Puerto Madryn, Chubut, y comercializa productos de aluminio para diversas industrias.",
    ceo: "Javier Madanes Quintanilla",
    founded: "1970",
    employees: "2.800",
    headquarters: "Buenos Aires, Argentina",
    sector: "Materiales",
  },
  "AAPL.BA": {
    description: "CEDEAR de Apple Inc. Apple diseña, fabrica y comercializa smartphones, computadoras personales, tablets, wearables y accesorios, además de servicios digitales como iCloud, Apple Music y Apple TV+.",
    ceo: "Tim Cook",
    founded: "1976",
    employees: "164.000",
    headquarters: "Cupertino, California",
    sector: "Tecnología",
  },
  "MSFT.BA": {
    description: "CEDEAR de Microsoft Corporation. Microsoft desarrolla y licencia software, servicios en la nube (Azure), dispositivos y soluciones empresariales. Es una de las empresas más valiosas del mundo.",
    ceo: "Satya Nadella",
    founded: "1975",
    employees: "221.000",
    headquarters: "Redmond, Washington",
    sector: "Tecnología",
  },
};

const defaultInfo: CompanyInfo = {
  description: "Información detallada no disponible para este activo. Consultá la página de la CNV para más información.",
  ceo: "—",
  founded: "—",
  employees: "—",
  headquarters: "Argentina",
  sector: "General",
};

/* ─── Mock "people also own" ─── */
interface AlsoOwn {
  name: string;
  ticker: string;
  change: number;
}

const peopleAlsoOwn: Record<string, AlsoOwn[]> = {
  YPFD: [
    { name: "Pampa Energía", ticker: "PAMP", change: -0.45 },
    { name: "Ternium Argentina", ticker: "TXAR", change: 3.15 },
    { name: "Aluar Aluminio", ticker: "ALUA", change: -1.33 },
  ],
  ALUA: [
    { name: "Ternium Argentina", ticker: "TXAR", change: 3.15 },
    { name: "YPF S.A.", ticker: "YPFD", change: 4.21 },
    { name: "Pampa Energía", ticker: "PAMP", change: -0.45 },
  ],
  "AAPL.BA": [
    { name: "Microsoft (CEDEAR)", ticker: "MSFT.BA", change: 0.43 },
    { name: "Amazon (CEDEAR)", ticker: "AMZN.BA", change: 1.52 },
    { name: "Tesla (CEDEAR)", ticker: "TSLA.BA", change: -2.17 },
  ],
  default: [
    { name: "YPF S.A.", ticker: "YPFD", change: 4.21 },
    { name: "Bono Global 2030", ticker: "GD30", change: 1.87 },
    { name: "Apple (CEDEAR)", ticker: "AAPL.BA", change: 0.78 },
  ],
};

export default function DetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTime, setActiveTime] = useState("1D");
  const [showMore, setShowMore] = useState(false);
  const [tradeVisible, setTradeVisible] = useState(false);

  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset) return null;

  const isPositive = asset.change >= 0;
  const sign = isPositive ? "+" : "";
  const changeAmt = Math.round(asset.price * Math.abs(asset.change) / 100);
  const chartColor = isPositive ? colors.brand[500] : colors.red;

  const info = companyInfo[asset.ticker] || defaultInfo;
  const alsoOwn = peopleAlsoOwn[asset.ticker] || peopleAlsoOwn.default;

  /* Derived stats */
  const open = asset.price - Math.round(asset.price * asset.change / 200);
  const hi = asset.price + Math.round(asset.price * 0.018);
  const lo = asset.price - Math.round(asset.price * 0.022);
  const hi52 = Math.round(asset.price * 1.35);
  const lo52 = Math.round(asset.price * 0.72);
  const vol = Math.round(120000 + Math.random() * 500000);
  const avgVol = Math.round(vol * 1.4);
  const mktCap = asset.price > 10000
    ? `${(asset.price * 380 / 1e6).toFixed(1)}B`
    : `${(asset.price * 15000 / 1e6).toFixed(1)}M`;

  /* Position mock */
  const held = asset.held;
  const qty = asset.qty || 0;
  const marketVal = asset.price * qty;
  const avgCost = Math.round(asset.price * 0.92);
  const todayReturn = Math.round(changeAmt * qty);
  const totalReturn = Math.round((asset.price - avgCost) * qty);
  const totalReturnPct = avgCost > 0 ? ((asset.price - avgCost) / avgCost * 100).toFixed(2) : "0";

  const stats = [
    { label: "Apertura", value: formatARS(open) },
    { label: "Volumen", value: vol.toLocaleString("es-AR") },
    { label: "Máximo", value: formatARS(hi) },
    { label: "Vol. prom.", value: avgVol.toLocaleString("es-AR") },
    { label: "Mínimo", value: formatARS(lo) },
    { label: "Cap. mercado", value: mktCap },
    { label: "Máx. 52 sem.", value: formatARS(hi52) },
    { label: "P/E ratio", value: "—" },
    { label: "Mín. 52 sem.", value: formatARS(lo52) },
    { label: "Div/rend.", value: "—" },
  ];

  return (
    <View style={s.container}>
      {/* ── Sticky header ── */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerPrice}>{formatARS(asset.price)}</Text>
          <Text style={s.headerTicker}>{asset.ticker}</Text>
        </View>
        <View style={s.headerRight}>
          <Pressable>
            <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
          </Pressable>
          <Pressable>
            <Ionicons name="add-circle-outline" size={22} color={colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Name & Price ── */}
        <View style={s.priceSection}>
          <Text style={s.tickerLabel}>{asset.ticker}</Text>
          <Text style={s.companyName}>{asset.name}</Text>
          <View style={s.priceRow}>
            <Text style={s.price}>{formatARS(asset.price)}</Text>
            <Pressable>
              <Ionicons name="open-outline" size={16} color={colors.text.muted} style={{ marginLeft: 6, marginTop: 4 }} />
            </Pressable>
          </View>
          <Text style={[s.changeLine, { color: chartColor }]}>
            {isPositive ? "▲" : "▼"} {sign}{formatARS(changeAmt)} ({sign}{asset.change.toFixed(2)}%) Hoy
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
          <View style={[s.chartLineMain, { backgroundColor: chartColor }]} />
          {/* Fullscreen button */}
          <Pressable style={s.fullscreenBtn}>
            <Ionicons name="expand-outline" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>

        {/* ── Time filters ── */}
        <View style={s.timeFilters}>
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
          <Pressable style={s.timeBtn}>
            <Ionicons name="settings-outline" size={16} color={colors.text.muted} />
          </Pressable>
        </View>

        {/* ── Your position (if held) ── */}
        {held && qty > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Text style={s.sectionTitle}>Tu posición</Text>
              <View style={s.posGrid}>
                <View style={s.posItem}>
                  <Text style={s.posLabel}>Cantidad</Text>
                  <Text style={s.posValue}>{qty}</Text>
                </View>
                <View style={s.posItem}>
                  <Text style={s.posLabel}>Valor de mercado</Text>
                  <Text style={s.posValue}>{formatARS(marketVal)}</Text>
                </View>
                <View style={s.posItem}>
                  <Text style={s.posLabel}>Costo promedio</Text>
                  <Text style={s.posValue}>{formatARS(avgCost)}</Text>
                </View>
                <View style={s.posItem}>
                  <Text style={s.posLabel}>Diversif. portfolio</Text>
                  <View style={s.posDiversity}>
                    <Text style={s.posValue}>
                      {(marketVal / 4287430 * 100).toFixed(1)}%
                    </Text>
                    <View style={s.miniPie}>
                      <View style={[s.miniPieSlice, { backgroundColor: colors.text.primary }]} />
                    </View>
                  </View>
                </View>
                <View style={s.posItemFull}>
                  <Text style={s.posLabel}>Retorno hoy</Text>
                  <Text style={[s.posValue, { color: isPositive ? colors.brand[500] : colors.red }]}>
                    {sign}{formatARS(Math.abs(todayReturn))} ({sign}{asset.change.toFixed(2)}%)
                  </Text>
                </View>
                <View style={s.posItemFull}>
                  <Text style={s.posLabel}>Retorno total</Text>
                  <Text style={[s.posValue, { color: totalReturn >= 0 ? colors.brand[500] : colors.red }]}>
                    {totalReturn >= 0 ? "+" : ""}{formatARS(Math.abs(totalReturn))} ({totalReturn >= 0 ? "+" : ""}{totalReturnPct}%)
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── Recurring investments ── */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Inversiones recurrentes</Text>
          <Text style={s.sectionBody}>
            Invertí automáticamente en {asset.ticker} con el calendario que más te convenga.
          </Text>
          <Pressable>
            <Text style={s.greenLink}>
              Crear inversión recurrente en {asset.ticker}
            </Text>
          </Pressable>
        </View>

        {/* ── About company ── */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Acerca de {asset.name}</Text>
          <Text style={s.aboutText} numberOfLines={showMore ? undefined : 3}>
            {info.description}
          </Text>
          <Pressable onPress={() => setShowMore(!showMore)}>
            <Text style={s.greenLink}>{showMore ? "Ver menos" : "Ver más"}</Text>
          </Pressable>

          {/* Company info grid */}
          <View style={s.infoGrid}>
            <View style={s.infoItem}>
              <Text style={s.infoLabel}>CEO</Text>
              <Text style={s.infoValue}>{info.ceo}</Text>
            </View>
            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Fundada</Text>
              <Text style={s.infoValue}>{info.founded}</Text>
            </View>
            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Empleados</Text>
              <Text style={s.infoValue}>{info.employees}</Text>
            </View>
            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Sede</Text>
              <Text style={s.infoValue}>{info.headquarters}</Text>
            </View>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Estadísticas</Text>
          <View style={s.statsGrid}>
            {stats.map((stat) => (
              <View key={stat.label} style={s.statItem}>
                <Text style={s.statLabel}>{stat.label}</Text>
                <Text style={s.statValue}>{stat.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── People also own ── */}
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>También invierten en</Text>
          <Text style={s.sectionBodySm}>
            Basado en los portfolios de inversores que tienen {asset.ticker}. No es una recomendación de inversión.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.alsoOwnScroll}
          >
            {alsoOwn.map((item) => {
              const isUp = item.change >= 0;
              return (
                <Pressable
                  key={item.ticker}
                  style={s.alsoOwnCard}
                  onPress={() => router.push({ pathname: "/(app)/detail", params: { ticker: item.ticker } })}
                >
                  <Text style={s.alsoOwnName} numberOfLines={2}>{item.name}</Text>
                  <View style={s.alsoOwnBottom}>
                    <Text style={[s.alsoOwnTicker, { color: isUp ? colors.brand[500] : colors.red }]}>
                      {item.ticker}
                    </Text>
                    <Text style={[s.alsoOwnChange, { color: isUp ? colors.brand[500] : colors.red }]}>
                      {isUp ? "+" : ""}{item.change.toFixed(2)}%
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Disclaimer ── */}
        <View style={s.disclaimerSection}>
          <Text style={s.disclaimerText}>
            Todas las inversiones implican riesgo, incluyendo la posible pérdida del capital invertido. Valores negociables ofrecidos a través de Álamos Capital S.A., agente registrado ante la CNV. Divulgación completa.
          </Text>
        </View>
      </ScrollView>

      {/* ── Floating bottom bar ── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.bottomBarLeft}>
          <Text style={s.volumeLabel}>Volumen hoy</Text>
          <Text style={s.volumeValue}>{vol.toLocaleString("es-AR")}</Text>
        </View>
        <Pressable style={s.tradeBtn} onPress={() => setTradeVisible(true)}>
          <Text style={s.tradeBtnText}>Operar</Text>
        </Pressable>
      </View>

      {/* ── Trade action sheet ── */}
      <Modal
        visible={tradeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTradeVisible(false)}
      >
        <Pressable style={s.overlay} onPress={() => setTradeVisible(false)} />
        <View style={[s.tradeSheet, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={s.tradeSheetBtn}
            onPress={() => {
              setTradeVisible(false);
              router.push({ pathname: "/(app)/options", params: { ticker: asset.ticker } });
            }}
          >
            <Text style={s.tradeSheetBtnText}>Operar opciones</Text>
          </Pressable>
          {held && qty > 0 && (
            <Pressable
              style={s.tradeSheetBtn}
              onPress={() => {
                setTradeVisible(false);
                router.push({ pathname: "/(app)/buy", params: { ticker: asset.ticker, mode: "sell" } });
              }}
            >
              <Text style={s.tradeSheetBtnText}>Vender</Text>
            </Pressable>
          )}
          <Pressable
            style={s.tradeSheetBtn}
            onPress={() => {
              setTradeVisible(false);
              router.push({ pathname: "/(app)/buy", params: { ticker: asset.ticker, mode: "buy" } });
            }}
          >
            <Text style={s.tradeSheetBtnText}>Comprar</Text>
          </Pressable>
          <Pressable
            style={s.tradeSheetCancel}
            onPress={() => setTradeVisible(false)}
          >
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </Pressable>
        </View>
      </Modal>
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
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerTicker: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: "500",
  },
  headerRight: {
    flexDirection: "row",
    gap: 16,
  },

  /* Price section */
  priceSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  tickerLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: "500",
    marginBottom: 2,
  },
  companyName: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
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
    height: 220,
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
    opacity: 0.3,
  },
  chartLineMain: {
    height: 2,
    marginHorizontal: 20,
    borderRadius: 1,
    opacity: 0.6,
  },
  fullscreenBtn: {
    position: "absolute",
    right: 20,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Time filters */
  timeFilters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 4,
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

  /* Shared section */
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
  sectionBody: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 10,
  },
  sectionBodySm: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  greenLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand[500],
    marginTop: 6,
  },

  /* Your position */
  posGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  posItem: {
    width: "50%",
    paddingVertical: 12,
  },
  posItemFull: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  posDiversity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniPie: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface[200],
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  miniPieSlice: {
    width: 18,
    height: 9,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    position: "absolute",
    top: 0,
  },

  /* About */
  aboutText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
  },
  infoItem: {
    width: "50%",
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
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

  /* People also own */
  alsoOwnScroll: {
    gap: 12,
  },
  alsoOwnCard: {
    width: 160,
    backgroundColor: colors.surface[100],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 120,
  },
  alsoOwnName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 12,
  },
  alsoOwnBottom: {},
  alsoOwnTicker: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  alsoOwnChange: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* Disclaimer */
  disclaimerSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
  },

  /* Floating bottom bar */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface[0],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  bottomBarLeft: {},
  volumeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.primary,
  },
  volumeValue: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 1,
  },
  tradeBtn: {
    backgroundColor: colors.brand[500],
    borderRadius: 24,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  tradeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },

  /* Trade action sheet */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  tradeSheet: {
    backgroundColor: colors.surface[100],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 10,
  },
  tradeSheetBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
  },
  tradeSheetBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  tradeSheetCancel: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
