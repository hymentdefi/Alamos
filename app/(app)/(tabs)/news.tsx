import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  Image,
  Modal,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, radius } from "../../../lib/theme";

type Category = "mercado" | "cedears" | "bonos" | "macro" | "fci" | "cripto";

interface NewsItem {
  id: string;
  category: Category;
  categoryLabel: string;
  categoryColor: string;
  source: string;
  time: string;
  title: string;
  summary: string;
  /** Cuerpo completo para el detail bottom sheet. */
  body: string[];
  /** URL de la imagen principal. */
  image: string;
  tickers?: string[];
}

const CAT_COLORS: Record<Category, string> = {
  mercado: "#0ECB81",
  cripto: "#F7931A",
  cedears: "#4A7DFF",
  bonos: "#E8B84A",
  fci: "#2DD4BF",
  macro: "#B794F6",
};

const feed: NewsItem[] = [
  {
    id: "1",
    category: "mercado",
    categoryLabel: "Mercado",
    categoryColor: CAT_COLORS.mercado,
    source: "Ámbito",
    time: "hace 1h",
    title: "Bonos en dólares vuelan: el riesgo país perfora los 750 pb",
    summary:
      "El Bonar 2030 avanzó más de 2% en la rueda. Inversores interpretan los datos de reservas como señal de recompra futura.",
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
    tickers: ["AL30", "GD30", "GD35"],
    body: [
      "El mercado argentino tuvo una jornada positiva para los activos en dólares: los bonos soberanos cerraron con subas de hasta 2,3%, mientras el riesgo país continuó su tendencia descendente y perforó el nivel de 750 puntos básicos por primera vez en el año.",
      "El Bonar 2030 (AL30), uno de los más operados, cerró con un alza del 2,1%, mientras que el Global 2030 (GD30) avanzó 2,4%. Los analistas consultados coincidieron en que el movimiento está siendo impulsado por las recientes publicaciones del BCRA sobre reservas internacionales.",
      "Un operador de una ALYC local comentó: 'Los flujos que estamos viendo son consistentes con el posicionamiento institucional. Hay un consenso creciente de que el riesgo país podría seguir comprimiéndose si el gobierno mantiene la disciplina fiscal.'",
      "En paralelo, las acciones del panel líder del MERVAL también tuvieron una rueda positiva, destacándose las subas de los bancos (GGAL +3,1%, BMA +2,8%) y las energéticas (YPFD +4,2%).",
    ],
  },
  {
    id: "2",
    category: "cripto",
    categoryLabel: "Cripto",
    categoryColor: CAT_COLORS.cripto,
    source: "CoinDesk",
    time: "hace 2h",
    title: "Bitcoin roza los USD 68.000 arrastrando al sector tech",
    summary:
      "La correlación entre BTC y NASDAQ vuelve con fuerza. Los CEDEARs de Nvidia y MercadoLibre replicaron la suba.",
    image:
      "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=1200&q=80",
    tickers: ["BTC/USDT", "NVDA", "MELI"],
    body: [
      "Bitcoin continúa su escalada y se acerca a los USD 68.000, recuperando terreno perdido en las últimas semanas. La correlación con el NASDAQ, que se había debilitado, vuelve a fortalecerse impulsada por el optimismo generalizado en activos de riesgo.",
      "Los ETFs spot de BTC en Estados Unidos registraron ingresos netos por USD 483 millones en la última jornada, según datos de Farside Investors. El BlackRock IBIT lideró los flujos con más de USD 200 millones.",
      "En el mercado local, los CEDEARs del sector tecnológico replicaron el movimiento. Nvidia subió 3,4%, MercadoLibre 2,1% y Microsoft 0,9%.",
    ],
  },
  {
    id: "3",
    category: "cedears",
    categoryLabel: "CEDEARs",
    categoryColor: CAT_COLORS.cedears,
    source: "Reuters",
    time: "hace 3h",
    title: "NVIDIA cierra en máximos: el sector tech lidera Wall Street",
    summary:
      "La expectativa por los resultados del próximo trimestre impulsó al sector tecnológico. Los CEDEARs locales replicaron la suba.",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
    tickers: ["NVDA", "AAPL", "MSFT"],
    body: [
      "Las acciones de NVIDIA alcanzaron un nuevo máximo histórico ante la expectativa de resultados trimestrales que se conocerán en las próximas semanas. El papel cerró con un alza del 3,4%.",
      "El sector tecnológico en general tuvo una jornada muy positiva, con el índice de semiconductores subiendo más del 2%. Microsoft, Apple y Alphabet también cerraron en terreno positivo.",
      "En Argentina, los CEDEARs más operados fueron NVDA, AAPL y TSLA, con volúmenes que superaron el promedio de las últimas 20 ruedas.",
    ],
  },
  {
    id: "4",
    category: "macro",
    categoryLabel: "Macro",
    categoryColor: CAT_COLORS.macro,
    source: "Clarín",
    time: "hace 5h",
    title: "Inflación de marzo podría ubicarse por debajo del 3%",
    summary:
      "Consultoras como Eco Go y Orlando Ferreres proyectan IPC entre 2,6% y 2,9%. Sería el menor registro desde diciembre.",
    image:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200&q=80",
    body: [
      "Las principales consultoras del país coinciden en proyectar que la inflación de marzo se ubicará por debajo del 3%, marcando el menor registro desde diciembre. Las estimaciones oscilan entre 2,6% (Eco Go) y 2,9% (Orlando Ferreres).",
      "El dato oficial del INDEC se conocerá el próximo martes. De confirmarse la tendencia, sería la cuarta baja consecutiva del índice y daría aire al gobierno en su plan de estabilización.",
      "Los rubros que más contribuyeron a la desaceleración fueron alimentos y bebidas (2,1% mensual según relevamientos privados) y servicios regulados (congelados en el mes).",
    ],
  },
  {
    id: "5",
    category: "bonos",
    categoryLabel: "Bonos",
    categoryColor: CAT_COLORS.bonos,
    source: "El Cronista",
    time: "hace 8h",
    title: "Licitación del Tesoro: qué LECAPs rinden más del 37% TNA",
    summary:
      "Analistas recomiendan diversificar entre LECAPs de corto plazo y Boncer para carteras conservadoras.",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80",
    tickers: ["S30A5", "TX26"],
    body: [
      "El Tesoro Nacional enfrenta mañana un nuevo vencimiento por $1,8 billones, con una licitación que ofrecerá instrumentos para cubrir esos pagos y captar fondos adicionales.",
      "Entre las opciones destacadas, las LECAPs de corto plazo con rendimientos superiores al 37% TNA se posicionan como las más atractivas para carteras conservadoras, según consultoras locales.",
      "Para quienes buscan cobertura contra la inflación, los Boncer a 1 y 2 años ofrecen una combinación interesante de CER más tasa real del 8% al 10%.",
    ],
  },
  {
    id: "6",
    category: "fci",
    categoryLabel: "Fondos",
    categoryColor: CAT_COLORS.fci,
    source: "iProfesional",
    time: "ayer",
    title: "Los money market superan los $12 billones en patrimonio",
    summary:
      "Cuarto mes consecutivo con flujo positivo. Siguen siendo el instrumento preferido para el ahorro de corto plazo.",
    image:
      "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&q=80",
    tickers: ["BAL-AHO", "FIMA-AHO"],
    body: [
      "Los fondos comunes de inversión money market continúan su crecimiento y superaron los $12 billones en patrimonio administrado, según datos de la Cámara de FCI. Es el cuarto mes consecutivo con flujo positivo neto.",
      "El instrumento se consolida como el preferido de los ahorristas argentinos para posicionar pesos de corto plazo: rinden por encima del plazo fijo y mantienen liquidez diaria.",
      "Los fondos líderes del segmento (Balanz Ahorro, FIMA Ahorro Pesos, Galicia Ahorro) mostraron TNAs promedio del 37% en los últimos 30 días.",
    ],
  },
  {
    id: "7",
    category: "mercado",
    categoryLabel: "Mercado",
    categoryColor: CAT_COLORS.mercado,
    source: "La Nación",
    time: "ayer",
    title: "MERVAL en pesos vuelve a máximos con fuerte volumen",
    summary:
      "El índice líder subió 1,8% impulsado por bancos y energéticas. El volumen operado superó los $120.000 millones.",
    image:
      "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1200&q=80",
    tickers: ["GGAL", "YPFD", "PAMP"],
    body: [
      "El MERVAL en pesos alcanzó un nuevo máximo histórico al cerrar en 1.842.350 puntos, con una suba del 1,8% en la jornada. El volumen operado en acciones superó los $120.000 millones, uno de los más altos del año.",
      "Los principales impulsores fueron los bancos: Grupo Galicia (+3,1%), Banco Macro (+2,8%) y BBVA Argentina (+1,6%). Las energéticas también tuvieron un buen desempeño con YPF liderando la suba (+4,2%).",
      "Los analistas mantienen una visión constructiva sobre el equity argentino para los próximos meses, condicionada al avance de las reformas y al mantenimiento de la disciplina fiscal.",
    ],
  },
  {
    id: "8",
    category: "cripto",
    categoryLabel: "Cripto",
    categoryColor: CAT_COLORS.cripto,
    source: "The Block",
    time: "hace 10h",
    title: "Ethereum sube 5% anticipando la próxima actualización",
    summary:
      "El volumen on-chain alcanzó máximos de 6 meses. Los fondos crypto registran entradas por USD 2.4B en la semana.",
    image:
      "https://images.unsplash.com/photo-1642790551116-18e150f248e3?w=1200&q=80",
    tickers: ["ETH/USDT", "ETHUSDT.P"],
    body: [
      "Ethereum tuvo una jornada muy positiva con una suba del 5,2%, impulsada por la expectativa de una próxima actualización de la red que mejoraría la escalabilidad.",
      "El volumen on-chain alcanzó los 1,4 millones de transacciones diarias, el mayor registro en 6 meses. Las comisiones promedio se mantuvieron controladas gracias a los rollups.",
      "Los fondos crypto registraron entradas netas por USD 2.400 millones en la semana, con ETH liderando los flujos institucionales por primera vez en 3 meses, superando temporalmente a BTC.",
    ],
  },
];

const categoryTabs: { id: Category | "todas"; label: string }[] = [
  { id: "todas", label: "Para vos" },
  { id: "mercado", label: "Mercado" },
  { id: "cripto", label: "Cripto" },
  { id: "cedears", label: "CEDEARs" },
  { id: "bonos", label: "Bonos" },
  { id: "fci", label: "Fondos" },
  { id: "macro", label: "Macro" },
];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Category | "todas">("todas");
  const [activeIndex, setActiveIndex] = useState(0);
  const [detail, setDetail] = useState<NewsItem | null>(null);
  const listRef = useRef<FlatList>(null);

  const { height: screenH } = Dimensions.get("window");
  const tabBarH = Platform.OS === "ios" ? 84 : 68;
  const cardH = screenH - tabBarH;

  const visible = useMemo(
    () => (filter === "todas" ? feed : feed.filter((n) => n.category === filter)),
    [filter],
  );

  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filter]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / cardH);
      if (idx !== activeIndex) {
        setActiveIndex(idx);
        Haptics.selectionAsync().catch(() => {});
      }
    },
    [activeIndex, cardH],
  );

  return (
    <View style={[s.root, { backgroundColor: "#000" }]}>
      {/* Header flotante con categorías */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catRow}
          data={categoryTabs}
          keyExtractor={(t) => t.id}
          renderItem={({ item: t }) => {
            const active = filter === t.id;
            return (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFilter(t.id);
                }}
                style={s.catTab}
              >
                <Text
                  style={[
                    s.catLabel,
                    {
                      color: active ? "#FFF" : "rgba(255,255,255,0.55)",
                      fontFamily: fontFamily[active ? 700 : 600],
                    },
                  ]}
                >
                  {t.label}
                </Text>
                {active ? <View style={s.catUnderline} /> : null}
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(n) => n.id}
        pagingEnabled
        snapToInterval={cardH}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <NewsCard
            item={item}
            height={cardH}
            indexLabel={`${index + 1} de ${visible.length}`}
            onOpenDetail={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              setDetail(item);
            }}
            isLast={index === visible.length - 1}
          />
        )}
        ListEmptyComponent={
          <View style={[s.empty, { height: cardH }]}>
            <Text style={s.emptyTitle}>Sin noticias</Text>
            <Text style={s.emptySub}>Probá con otra categoría.</Text>
          </View>
        }
      />

      <DetailSheet item={detail} onClose={() => setDetail(null)} />
    </View>
  );
}

/* ─── Full-screen card ─── */

function NewsCard({
  item,
  height,
  indexLabel,
  onOpenDetail,
  isLast,
}: {
  item: NewsItem;
  height: number;
  indexLabel: string;
  onOpenDetail: () => void;
  isLast: boolean;
}) {
  return (
    <View style={{ height, backgroundColor: "#000" }}>
      <Image
        source={{ uri: item.image }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.95)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top: categoría sólida + index */}
      <View style={card.topRow} pointerEvents="box-none">
        <View style={[card.catPill, { backgroundColor: item.categoryColor }]}>
          <View style={card.catDot} />
          <Text style={card.catPillText}>{item.categoryLabel}</Text>
        </View>
        <View style={card.indexPill}>
          <Text style={card.indexPillText}>{indexLabel}</Text>
        </View>
      </View>

      {/* Scroll hint */}
      {!isLast ? <ScrollHint /> : null}

      {/* Bottom content */}
      <View style={card.bottom} pointerEvents="box-none">
        <Text style={card.source}>
          {item.source} · {item.time}
        </Text>
        <Text style={card.title}>{item.title}</Text>
        <Text style={card.summary} numberOfLines={3}>
          {item.summary}
        </Text>

        {item.tickers?.length ? (
          <View style={card.tickerRow}>
            {item.tickers.map((t) => (
              <View key={t} style={card.tickerPill}>
                <Text style={card.tickerText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable style={card.readBtn} onPress={onOpenDetail}>
          <Text style={card.readBtnText}>Leer noticia</Text>
          <Feather name="arrow-up-right" size={16} color="#000" />
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Indicador animado de scroll ─── */

function ScrollHint() {
  const bounce = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(bounce, {
            toValue: -10,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(bounce, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(fade, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(fade, {
            toValue: 0.5,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, fade]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        hint.wrap,
        {
          opacity: fade,
          transform: [{ translateY: bounce }],
        },
      ]}
    >
      <Feather name="chevron-up" size={16} color="#FFF" />
      <Feather name="chevron-up" size={16} color="#FFF" style={{ marginTop: -10 }} />
      <Text style={hint.text}>Seguí deslizando</Text>
    </Animated.View>
  );
}

/* ─── Bottom sheet con noticia completa ─── */

function DetailSheet({
  item,
  onClose,
}: {
  item: NewsItem | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={!!item}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={sheet.wrap}>
        <Pressable style={sheet.backdrop} onPress={onClose} />
        <View style={sheet.body}>
          <View style={sheet.handle} />
          {item ? (
            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: item.image }} style={sheet.image} />
              <View style={sheet.content}>
                <View
                  style={[
                    sheet.catPill,
                    { backgroundColor: item.categoryColor },
                  ]}
                >
                  <Text style={sheet.catPillText}>{item.categoryLabel}</Text>
                </View>
                <Text style={sheet.title}>{item.title}</Text>
                <Text style={sheet.meta}>
                  {item.source} · {item.time}
                </Text>
                {item.body.map((p, i) => (
                  <Text key={i} style={sheet.body_p}>
                    {p}
                  </Text>
                ))}
                {item.tickers?.length ? (
                  <View style={sheet.tickersRow}>
                    {item.tickers.map((t) => (
                      <View key={t} style={sheet.tickerPill}>
                        <Text style={sheet.tickerText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </ScrollView>
          ) : null}
          <Pressable
            style={[sheet.closeBtn, { bottom: insets.bottom + 16 }]}
            onPress={onClose}
          >
            <Feather name="x" size={18} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  catRow: {
    paddingHorizontal: 16,
    gap: 18,
    paddingBottom: 8,
  },
  catTab: {
    paddingVertical: 6,
    alignItems: "center",
  },
  catLabel: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  catUnderline: {
    marginTop: 4,
    height: 2,
    width: 16,
    borderRadius: 1,
    backgroundColor: "#FFFFFF",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  emptyTitle: {
    color: "#FFF",
    fontFamily: fontFamily[700],
    fontSize: 20,
  },
  emptySub: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: fontFamily[500],
    fontSize: 14,
    marginTop: 6,
  },
});

const card = StyleSheet.create({
  topRow: {
    position: "absolute",
    top: 80,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  catPillText: {
    color: "#000",
    fontFamily: fontFamily[800],
    fontSize: 12,
    letterSpacing: 0.2,
  },
  indexPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  indexPillText: {
    color: "rgba(255,255,255,0.9)",
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.2,
  },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 40,
    paddingHorizontal: 20,
  },
  source: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.05,
    marginBottom: 8,
  },
  title: {
    color: "#FFF",
    fontFamily: fontFamily[700],
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  summary: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginBottom: 12,
  },
  tickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  tickerPill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tickerText: {
    color: "#FFF",
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.2,
  },
  readBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  readBtnText: {
    color: "#000",
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },
});

const hint = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 16,
    bottom: 200,
    alignItems: "center",
  },
  text: {
    color: "rgba(255,255,255,0.9)",
    fontFamily: fontFamily[600],
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 4,
    transform: [{ rotate: "-90deg" }],
    width: 100,
    textAlign: "center",
  },
});

const sheet = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  backdrop: {
    flex: 1,
  },
  body: {
    backgroundColor: "#0B0E11",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  image: {
    width: "100%",
    height: 240,
    marginTop: 16,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  catPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: 14,
  },
  catPillText: {
    color: "#000",
    fontFamily: fontFamily[800],
    fontSize: 12,
    letterSpacing: 0.2,
  },
  title: {
    color: "#EAECEF",
    fontFamily: fontFamily[700],
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  meta: {
    color: "rgba(234,236,239,0.6)",
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 18,
  },
  body_p: {
    color: "rgba(234,236,239,0.9)",
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: -0.1,
    marginBottom: 14,
  },
  tickersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    marginBottom: 20,
  },
  tickerPill: {
    backgroundColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  tickerText: {
    color: "#EAECEF",
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.2,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
