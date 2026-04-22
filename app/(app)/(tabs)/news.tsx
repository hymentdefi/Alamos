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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, radius } from "../../../lib/theme";

type Category = "mercado" | "cedears" | "bonos" | "macro" | "fci" | "cripto";

interface NewsItem {
  id: string;
  category: Category;
  categoryLabel: string;
  source: string;
  time: string;
  title: string;
  summary: string;
  /** 2 colores para el gradient de fondo. */
  heroColors: [string, string];
  tickers?: string[];
  likes: number;
  views: string;
}

const feed: NewsItem[] = [
  {
    id: "1",
    category: "mercado",
    categoryLabel: "Mercado",
    source: "Ámbito",
    time: "hace 1h",
    title: "Bonos en dólares vuelan: el riesgo país perfora los 750 pb",
    summary:
      "El Bonar 2030 avanzó más de 2% en la rueda. Inversores interpretan los datos de reservas como señal de recompra futura.",
    heroColors: ["#0E3B1E", "#022712"],
    tickers: ["AL30", "GD30", "GD35"],
    likes: 1284,
    views: "24.3K",
  },
  {
    id: "2",
    category: "cripto",
    categoryLabel: "Cripto",
    source: "CoinDesk",
    time: "hace 2h",
    title: "Bitcoin roza los USD 68.000 arrastrando al sector tech",
    summary:
      "La correlación entre BTC y NASDAQ vuelve con fuerza. Los CEDEARs de Nvidia y MercadoLibre replicaron la suba.",
    heroColors: ["#3B1E0E", "#271202"],
    tickers: ["BTC/USDT", "NVDA", "MELI"],
    likes: 3840,
    views: "82.1K",
  },
  {
    id: "3",
    category: "cedears",
    categoryLabel: "CEDEARs",
    source: "Reuters",
    time: "hace 3h",
    title: "NVIDIA cierra en máximos: el sector tech lidera Wall Street",
    summary:
      "La expectativa por los resultados del próximo trimestre impulsó al sector tecnológico. Los CEDEARs locales replicaron la suba.",
    heroColors: ["#0E2E3B", "#021822"],
    tickers: ["NVDA", "AAPL", "MSFT"],
    likes: 2156,
    views: "44.8K",
  },
  {
    id: "4",
    category: "macro",
    categoryLabel: "Macro",
    source: "Clarín",
    time: "hace 5h",
    title: "Inflación de marzo podría ubicarse por debajo del 3%",
    summary:
      "Consultoras como Eco Go y Orlando Ferreres proyectan IPC entre 2,6% y 2,9%. Sería el menor registro desde diciembre.",
    heroColors: ["#2E0E3B", "#180222"],
    likes: 982,
    views: "18.2K",
  },
  {
    id: "5",
    category: "bonos",
    categoryLabel: "Bonos",
    source: "El Cronista",
    time: "hace 8h",
    title: "Licitación del Tesoro: qué LECAPs rinden más del 37% TNA",
    summary:
      "Analistas recomiendan diversificar entre LECAPs de corto plazo y Boncer para carteras conservadoras.",
    heroColors: ["#3B2E0E", "#221802"],
    tickers: ["S30A5", "TX26"],
    likes: 547,
    views: "9.4K",
  },
  {
    id: "6",
    category: "fci",
    categoryLabel: "Fondos",
    source: "iProfesional",
    time: "ayer",
    title: "Los money market superan los $12 billones en patrimonio",
    summary:
      "Cuarto mes consecutivo con flujo positivo. Siguen siendo el instrumento preferido para el ahorro de corto plazo.",
    heroColors: ["#0E3B34", "#022421"],
    tickers: ["BAL-AHO", "FIMA-AHO"],
    likes: 724,
    views: "12.6K",
  },
  {
    id: "7",
    category: "mercado",
    categoryLabel: "Mercado",
    source: "La Nación",
    time: "ayer",
    title: "MERVAL en pesos vuelve a máximos con fuerte volumen",
    summary:
      "El índice líder subió 1,8% impulsado por bancos y energéticas. El volumen operado superó los $120.000 millones.",
    heroColors: ["#0E3B1E", "#022712"],
    tickers: ["GGAL", "YPFD", "PAMP"],
    likes: 1923,
    views: "31.7K",
  },
  {
    id: "8",
    category: "cripto",
    categoryLabel: "Cripto",
    source: "The Block",
    time: "hace 10h",
    title: "Ethereum sube 5% anticipando la próxima actualización",
    summary:
      "El volumen on-chain alcanzó máximos de 6 meses. Los fondos crypto registran entradas por USD 2.4B en la semana.",
    heroColors: ["#3B1E0E", "#271202"],
    tickers: ["ETH/USDT", "ETHUSDT.P"],
    likes: 2412,
    views: "56.2K",
  },
  {
    id: "9",
    category: "macro",
    categoryLabel: "Macro",
    source: "Infobae",
    time: "hace 12h",
    title: "FMI aprobó desembolso de USD 4.700M tras cumplimiento de metas",
    summary:
      "El directorio destacó los avances fiscales. Las reservas del BCRA superan los USD 30.000 M.",
    heroColors: ["#2E0E3B", "#180222"],
    likes: 1632,
    views: "28.4K",
  },
  {
    id: "10",
    category: "cedears",
    categoryLabel: "CEDEARs",
    source: "Bloomberg Línea",
    time: "hace 1d",
    title: "Apple reportó ingresos récord y los CEDEARs tech lideran volumen",
    summary:
      "AAPL y MSFT fueron los más operados en la rueda local. Los analistas actualizan targets al alza.",
    heroColors: ["#0E2E3B", "#021822"],
    tickers: ["AAPL", "MSFT", "GOOGL"],
    likes: 1104,
    views: "21.9K",
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
      {/* Header flotante */}
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

      {/* Feed vertical */}
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
            indexLabel={`${index + 1}/${visible.length}`}
          />
        )}
        ListEmptyComponent={
          <View style={[s.empty, { height: cardH }]}>
            <Text style={s.emptyTitle}>Sin noticias</Text>
            <Text style={s.emptySub}>Probá con otra categoría.</Text>
          </View>
        }
      />
    </View>
  );
}

function NewsCard({
  item,
  height,
  indexLabel,
}: {
  item: NewsItem;
  height: number;
  indexLabel: string;
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;

  const triggerLike = (force: boolean) => {
    if (force && liked) return;
    const willLike = force ? true : !liked;
    setLiked(willLike);
    Haptics.impactAsync(
      willLike
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
    if (willLike) {
      heartScale.setValue(0);
      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 1,
          tension: 120,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 0,
          delay: 400,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const toggleLike = () => triggerLike(false);
  const toggleSave = () => {
    setSaved((v) => !v);
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Pressable
      onPress={() => {}}
      onLongPress={() => triggerLike(true)}
      style={{ height, backgroundColor: item.heroColors[1] }}
    >
      <LinearGradient
        colors={[item.heroColors[0], item.heroColors[1], "#000"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Heart flotante */}
      <Animated.View
        pointerEvents="none"
        style={[
          st.floatingHeart,
          {
            opacity: heartScale,
            transform: [
              {
                scale: heartScale.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1.4],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="heart" size={120} color="#FF3F5C" />
      </Animated.View>

      {/* Top badges */}
      <View style={st.topRow} pointerEvents="box-none">
        <View style={st.catPill}>
          <Text style={st.catPillText}>{item.categoryLabel.toUpperCase()}</Text>
        </View>
        <View style={st.indexPill}>
          <Text style={st.indexPillText}>{indexLabel}</Text>
        </View>
      </View>

      {/* Actions side column */}
      <View style={st.actionsCol} pointerEvents="box-none">
        <Pressable onPress={toggleLike} style={st.actionBtn} hitSlop={10}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={28}
            color={liked ? "#FF3F5C" : "#FFF"}
          />
          <Text style={st.actionCount}>
            {(item.likes + (liked ? 1 : 0)).toLocaleString("es-AR")}
          </Text>
        </Pressable>

        <Pressable onPress={toggleSave} style={st.actionBtn} hitSlop={10}>
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={26}
            color="#FFF"
          />
          <Text style={st.actionCount}>Guardar</Text>
        </Pressable>

        <Pressable style={st.actionBtn} hitSlop={10}>
          <Feather name="share" size={24} color="#FFF" />
          <Text style={st.actionCount}>Enviar</Text>
        </Pressable>

        <View style={st.viewsBadge}>
          <Ionicons name="eye-outline" size={12} color="rgba(255,255,255,0.7)" />
          <Text style={st.viewsText}>{item.views}</Text>
        </View>
      </View>

      {/* Bottom content */}
      <View style={st.bottom} pointerEvents="box-none">
        <Text style={st.source}>
          {item.source} · {item.time}
        </Text>
        <Text style={st.title}>{item.title}</Text>
        <Text style={st.summary}>{item.summary}</Text>

        {item.tickers?.length ? (
          <View style={st.tickerRow}>
            {item.tickers.map((t) => (
              <View key={t} style={st.tickerPill}>
                <Text style={st.tickerText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

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

const st = StyleSheet.create({
  floatingHeart: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
  },
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
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  catPillText: {
    color: "#FFF",
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1,
  },
  indexPill: {
    backgroundColor: "rgba(0,0,0,0.4)",
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
  actionsCol: {
    position: "absolute",
    right: 14,
    bottom: 220,
    alignItems: "center",
    gap: 22,
  },
  actionBtn: {
    alignItems: "center",
    gap: 4,
  },
  actionCount: {
    color: "#FFF",
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
  },
  viewsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 6,
  },
  viewsText: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fontFamily[500],
    fontSize: 10,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 80,
    bottom: 36,
    paddingHorizontal: 20,
  },
  source: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.05,
    marginBottom: 8,
  },
  title: {
    color: "#FFF",
    fontFamily: fontFamily[700],
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  summary: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginBottom: 14,
  },
  tickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tickerPill: {
    backgroundColor: "rgba(255,255,255,0.14)",
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
});
