import { useState, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

/* ─── Categories ─── */
const tabs = [
  { id: "all", label: "Todas" },
  { id: "local", label: "Mercado local" },
  { id: "dolar", label: "Dólar" },
  { id: "cedears", label: "CEDEARs" },
  { id: "bonos", label: "Bonos" },
  { id: "crypto", label: "Crypto" },
  { id: "politica", label: "Política económica" },
] as const;

type TabId = (typeof tabs)[number]["id"];

/* ─── News data ─── */
interface NewsItem {
  id: string;
  category: TabId;
  tag: string;
  headline: string;
  summary: string;
  source: string;
  time: string;
  tickers?: { ticker: string; change: number }[];
}

const allNews: NewsItem[] = [
  {
    id: "1", category: "local", tag: "MERVAL",
    headline: "El MERVAL alcanzó un nuevo máximo histórico impulsado por acciones energéticas y bancarias",
    summary: "YPF lideró las subas con +4.2% tras reportar resultados trimestrales por encima de las expectativas. El sector bancario acompañó con Galicia subiendo 3.1%.",
    source: "Ámbito Financiero", time: "Hace 2h",
    tickers: [{ ticker: "YPFD", change: 4.21 }, { ticker: "GGAL", change: 3.15 }],
  },
  {
    id: "2", category: "local", tag: "Energía",
    headline: "Pampa Energía anuncia plan de inversión de USD 500M para los próximos 3 años",
    summary: "La compañía enfocará las inversiones en generación eólica y la expansión de su capacidad de producción de gas en Vaca Muerta.",
    source: "El Cronista", time: "Hace 4h",
    tickers: [{ ticker: "PAMP", change: -0.45 }],
  },
  {
    id: "3", category: "dolar", tag: "Dólar CCL",
    headline: "El dólar CCL retrocede y la brecha cambiaria se ubica por debajo del 15%",
    summary: "La demanda de divisas se mantiene contenida mientras el BCRA acumula reservas. El MEP también operó a la baja.",
    source: "Infobae Economía", time: "Hace 3h",
    tickers: [{ ticker: "GD30", change: 1.87 }, { ticker: "AL30", change: 0.62 }],
  },
  {
    id: "4", category: "dolar", tag: "Dólar MEP",
    headline: "El dólar MEP perfora los $1.200 y marca mínimos de los últimos 2 meses",
    summary: "La estabilidad cambiaria se consolida con la entrada de dólares del agro y el cumplimiento de metas del FMI.",
    source: "Bloomberg Línea", time: "Hace 7h",
  },
  {
    id: "5", category: "cedears", tag: "Tech",
    headline: "Apple reportó ingresos récord y los CEDEARs tecnológicos suben con fuerza",
    summary: "Los CEDEARs de Apple y Microsoft lideran el volumen del día en el mercado local. Nvidia también registró fuerte demanda.",
    source: "Bloomberg Línea", time: "Hace 6h",
    tickers: [{ ticker: "AAPL.BA", change: 0.78 }, { ticker: "MSFT.BA", change: 0.43 }],
  },
  {
    id: "6", category: "cedears", tag: "Autos",
    headline: "Tesla cae 2% tras reportar entregas por debajo de lo esperado en el primer trimestre",
    summary: "El CEDEAR de Tesla fue el más operado en la rueda con ventas netas. Los analistas recortan precios objetivo.",
    source: "Reuters", time: "Hace 8h",
    tickers: [{ ticker: "TSLA.BA", change: -2.17 }],
  },
  {
    id: "7", category: "bonos", tag: "Riesgo país",
    headline: "Los bonos soberanos en dólares extienden su rally: el riesgo país perforó los 800 puntos",
    summary: "La compresión del riesgo país se aceleró después de que el gobierno cumpliera con las metas fiscales del primer trimestre.",
    source: "La Nación", time: "Hace 5h",
    tickers: [{ ticker: "GD30", change: 1.87 }, { ticker: "AL30", change: 0.62 }],
  },
  {
    id: "8", category: "bonos", tag: "Bonos AR",
    headline: "Argentina emite un nuevo bono en dólares a 10 años con una tasa del 7.8%",
    summary: "La emisión tuvo una demanda 3 veces superior a la oferta, reflejando la mejora en la percepción de riesgo del país.",
    source: "El Cronista", time: "Hace 10h",
  },
  {
    id: "9", category: "crypto", tag: "Bitcoin",
    headline: "Bitcoin supera los USD 68.000 y se acerca a su máximo histórico",
    summary: "La aprobación de ETFs spot en EEUU sigue atrayendo flujos institucionales. El halving se aproxima y los analistas esperan volatilidad.",
    source: "CoinDesk", time: "Hace 1h",
  },
  {
    id: "10", category: "crypto", tag: "Ethereum",
    headline: "Ethereum sube 5% anticipando la actualización Dencun y la posible aprobación de un ETF spot",
    summary: "El volumen de transacciones en la red alcanzó máximos de 6 meses. Los fondos crypto registran entradas por USD 2.4B en la semana.",
    source: "The Block", time: "Hace 3h",
  },
  {
    id: "11", category: "politica", tag: "Cepo",
    headline: "Milei confirmó que el cepo cambiario se levantará antes de fin de año",
    summary: "El mercado reaccionó con optimismo. Los ADRs argentinos subieron hasta 5% en Wall Street tras las declaraciones del presidente.",
    source: "Infobae", time: "Hace 5h",
    tickers: [{ ticker: "GGAL", change: 3.15 }],
  },
  {
    id: "12", category: "politica", tag: "FMI",
    headline: "El FMI aprobó un desembolso de USD 4.700M tras el cumplimiento de metas fiscales",
    summary: "El directorio del organismo destacó los avances en el frente fiscal y la reducción del déficit. Las reservas del BCRA superan los USD 30.000M.",
    source: "La Nación", time: "Hace 9h",
  },
];

export default function NewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const scrollRef = useRef<ScrollView>(null);

  const filtered = activeTab === "all"
    ? allNews
    : allNews.filter((n) => n.category === activeTab);

  const openDetail = (ticker: string) => {
    router.push({ pathname: "/(app)/detail", params: { ticker } });
  };

  return (
    <View style={s.root}>
      <View style={[s.fixedTop, { paddingTop: insets.top + 12 }]}>
        <View style={s.header}>
          <View style={s.titleRow}>
            <Text style={s.title}>News</Text>
            <View style={s.aiBadge}>
              <Feather name="cpu" size={10} color="#000" />
              <Text style={s.aiBadgeText}>IA</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Category tabs */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsScroll}
        style={[s.tabsContainer, { marginTop: insets.top + 64 }]}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* News list */}
      <ScrollView
        style={s.list}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((item, idx) => (
          <View key={item.id}>
            <View style={s.newsCard}>
              <View style={s.newsTop}>
                <View style={s.newsTagRow}>
                  <Text style={s.newsTag}>{item.tag}</Text>
                </View>
                <Text style={s.newsTime}>{item.time}</Text>
              </View>
              <Text style={s.newsHeadline}>{item.headline}</Text>
              <Text style={s.newsSummary}>{item.summary}</Text>
              <View style={s.newsBottom}>
                {item.tickers && item.tickers.length > 0 && (
                  <View style={s.tickerChips}>
                    {item.tickers.map((t) => {
                      const up = t.change >= 0;
                      return (
                        <Pressable
                          key={t.ticker}
                          style={[s.chip, { backgroundColor: up ? "rgba(0,230,118,0.10)" : "rgba(255,68,68,0.10)" }]}
                          onPress={() => openDetail(t.ticker)}
                        >
                          <Text style={[s.chipText, { color: up ? colors.brand[500] : colors.red }]}>
                            {t.ticker} {up ? "+" : ""}{t.change.toFixed(2)}%
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Text style={s.newsSource}>{item.source}</Text>
              </View>
            </View>
            {idx < filtered.length - 1 && <View style={s.cardDivider} />}
          </View>
        ))}

        {filtered.length === 0 && (
          <View style={s.empty}>
            <Feather name="inbox" size={40} color="rgba(255,255,255,0.08)" />
            <Text style={s.emptyText}>No hay noticias en esta categoría</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  fixedTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "#000000",
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.8,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.brand[500],
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#000",
  },

  /* Tabs */
  tabsContainer: {
    maxHeight: 44,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tabActive: {
    backgroundColor: colors.text.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.muted,
  },
  tabTextActive: {
    color: "#000",
  },

  /* List */
  list: { flex: 1 },

  /* News card */
  newsCard: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  newsTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  newsTagRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  newsTag: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand[500],
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  newsTime: {
    fontSize: 12,
    color: colors.text.muted,
  },
  newsHeadline: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    lineHeight: 24,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  newsSummary: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  newsBottom: {
    marginTop: 14,
    gap: 10,
  },
  tickerChips: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  newsSource: {
    fontSize: 12,
    color: colors.text.muted,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 20,
  },

  /* Empty */
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.muted,
  },
});
