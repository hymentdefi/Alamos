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
  RefreshControl,
  PanResponder,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../../../lib/theme";
import {
  DisclaimerFooter,
  DisclaimerModal,
  DisclaimerOnboarding,
  DisclaimerShort,
} from "../../../lib/components/Disclaimer";
import { useLegalConsent } from "../../../lib/legal/context";
import {
  HorizontalPager,
  type HorizontalPagerHandle,
} from "../../../lib/components/HorizontalPager";
import { Tap } from "../../../lib/components/Tap";

type Category = "mercado" | "cedears" | "bonos" | "macro" | "fci" | "crypto";

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
  crypto: "#F7931A",
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
    category: "crypto",
    categoryLabel: "Crypto",
    categoryColor: CAT_COLORS.crypto,
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
    category: "crypto",
    categoryLabel: "Crypto",
    categoryColor: CAT_COLORS.crypto,
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
  { id: "crypto", label: "Crypto" },
  { id: "cedears", label: "CEDEARs" },
  { id: "bonos", label: "Bonos" },
  { id: "fci", label: "Fondos" },
  { id: "macro", label: "Macro" },
];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState(0);
  const [detail, setDetail] = useState<NewsItem | null>(null);
  const [headerH, setHeaderH] = useState(120);
  const [footerH, setFooterH] = useState(40);
  const [legalOpen, setLegalOpen] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const hintShownRef = useRef(false);
  const pagerRef = useRef<HorizontalPagerHandle>(null);
  const catScrollRef = useRef<ScrollView>(null);
  const pageListRefs = useRef<Record<string, FlatList | null>>({});
  const pageRefSetters = useRef<Record<string, (r: FlatList | null) => void>>(
    {},
  );

  const { hasAccepted, loading: consentLoading, accept } = useLegalConsent();
  const showOnboarding = !consentLoading && !hasAccepted && isFocused;

  // Hint de "deslizá para pasar": una vez por launch de la app, la primera
  // vez que el usuario entra a Noticias con el disclaimer aceptado. No
  // persistimos a SecureStore — la persistencia previa podía quedar stuck
  // y evitar que se vea el hint.
  useEffect(() => {
    if (consentLoading || !hasAccepted) return;
    if (!isFocused) return;
    if (hintShownRef.current) return;
    hintShownRef.current = true;
    setShowSwipeHint(true);
  }, [consentLoading, hasAccepted, isFocused]);

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false);
  }, []);

  const { height: screenH } = Dimensions.get("window");
  // Alto real del nav bar flotante (island_top + island + bottom gap).
  // iOS con home indicator ≈ 110, android ≈ 92.
  const tabBarH = Platform.OS === "ios" ? 110 : 92;
  // cardH tiene que ser ESTABLE: si lo hacemos variar con showSwipeHint,
  // el snapToInterval del FlatList pierde alineación cuando el hint
  // desaparece a mitad de scroll — el user ve una noticia a medias y
  // la siguiente a medias. El hint se renderiza como overlay absoluto
  // y el primer card recibe paddingTop cuando está visible.
  const cardH = screenH - tabBarH - headerH - footerH;
  const HINT_SPACE = 56;

  const filterForTab = useCallback(
    (t: { id: Category | "todas" }) =>
      t.id === "todas" ? feed : feed.filter((n) => n.category === t.id),
    [],
  );

  // Cuando cambia la tab activa, scrolleamos la lista de pills para que la
  // activa quede cerca del centro.
  useEffect(() => {
    catScrollRef.current?.scrollTo({
      x: Math.max(0, activeTab * 92 - 60),
      animated: true,
    });
  }, [activeTab]);

  const openPill = useCallback((idx: number) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveTab(idx);
    pagerRef.current?.scrollToIndex(idx, true);
  }, []);

  const setPageRef = useCallback((tabId: string) => {
    if (!pageRefSetters.current[tabId]) {
      pageRefSetters.current[tabId] = (ref) => {
        pageListRefs.current[tabId] = ref;
      };
    }
    return pageRefSetters.current[tabId];
  }, []);

  // Tap en la tab Noticias solo si YA estoy en Noticias → scroll top + refresh
  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (!isFocused) return;
      const currentId = categoryTabs[activeTab].id;
      const ref = pageListRefs.current[currentId];
      ref?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsub;
  }, [navigation, isFocused, activeTab]);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header sticky con título Noticias + tabs */}
      <View
        style={[
          s.header,
          { backgroundColor: c.bg, borderBottomColor: c.border },
        ]}
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      >
        <View style={[s.titleRow, { paddingTop: insets.top + 10 }]}>
          <Text style={[s.title, { color: c.text }]}>Noticias</Text>
        </View>
        <ScrollView
          ref={catScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catRow}
        >
          {categoryTabs.map((t, i) => {
            const active = i === activeTab;
            return (
              <Tap
                key={t.id}
                onPress={() => openPill(i)}
                haptic="selection"
                pressScale={0.93}
                style={[
                  s.catPill,
                  {
                    backgroundColor: active ? c.ink : c.surfaceHover,
                    borderColor: active ? c.ink : c.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.catPillText,
                    { color: active ? c.bg : c.textSecondary },
                  ]}
                >
                  {t.label}
                </Text>
              </Tap>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        <HorizontalPager
          ref={pagerRef}
          items={categoryTabs}
          index={activeTab}
          onIndexChange={setActiveTab}
          keyExtractor={(t) => t.id}
          extraData={showSwipeHint}
          renderItem={(t) => (
            <NewsPage
              items={filterForTab(t)}
              cardH={cardH}
              firstCardTopPad={showSwipeHint ? HINT_SPACE : 0}
              listRef={setPageRef(t.id)}
              onDismissHint={dismissSwipeHint}
              onOpenDetail={(n) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                  () => {},
                );
                setDetail(n);
              }}
            />
          )}
        />
        {/* Hint absoluto arriba del pager — no empuja el layout, pero
            el primer card tiene paddingTop para que la imagen no quede
            debajo. */}
        <SwipeHint visible={showSwipeHint} />
      </View>

      <View
        style={{ marginBottom: tabBarH }}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        <DisclaimerFooter onOpen={() => setLegalOpen(true)} />
      </View>

      <DetailSheet item={detail} onClose={() => setDetail(null)} />
      <DisclaimerModal
        visible={legalOpen}
        onClose={() => setLegalOpen(false)}
      />
      <DisclaimerOnboarding visible={showOnboarding} onAccept={accept} />
    </View>
  );
}

/* ─── Página vertical de noticias para una categoría ─── */

function NewsPage({
  items,
  cardH,
  firstCardTopPad,
  listRef,
  onDismissHint,
  onOpenDetail,
}: {
  items: NewsItem[];
  cardH: number;
  firstCardTopPad: number;
  listRef: (ref: FlatList | null) => void;
  onDismissHint: () => void;
  onOpenDetail: (n: NewsItem) => void;
}) {
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const activeIdxRef = useRef(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      setRefreshing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }, 1100);
  }, []);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      // Recién descartamos cuando el usuario ya demostró que entendió
      // el gesto (scrolleó 1/4 de card) — no apenas toca la lista.
      if (y > cardH * 0.25) onDismissHint();
      const idx = Math.round(y / cardH);
      if (idx !== activeIdxRef.current) {
        activeIdxRef.current = idx;
        Haptics.selectionAsync().catch(() => {});
      }
    },
    [cardH, onDismissHint],
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(n) => n.id}
        pagingEnabled
        snapToInterval={cardH}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.textMuted}
            colors={[c.textMuted]}
            progressBackgroundColor={c.surface}
          />
        }
        renderItem={({ item, index }) => (
          <NewsCard
            item={item}
            height={cardH}
            topPad={index === 0 ? firstCardTopPad : 0}
            onOpenDetail={() => onOpenDetail(item)}
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

/* ─── Full-screen card ─── */

function NewsCard({
  item,
  height,
  topPad = 0,
  onOpenDetail,
}: {
  item: NewsItem;
  height: number;
  topPad?: number;
  onOpenDetail: () => void;
}) {
  const { c } = useTheme();

  // Float animation — la imagen "respira" suave, loop infinito
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 8],
  });

  return (
    <View style={{ height, paddingTop: topPad, backgroundColor: c.bg }}>
      {/* Imagen que ocupa todo el espacio entre header y contenido */}
      <Pressable style={card.imageWrap} onPress={onOpenDetail}>
        <Animated.View
          style={[
            card.imageAnim,
            {
              transform: [{ translateY }],
              shadowColor: c.ink,
            },
          ]}
        >
          <Image
            source={{ uri: item.image }}
            style={card.image}
            resizeMode="cover"
          />
        </Animated.View>
      </Pressable>

      {/* Contenido debajo — todo tappable para abrir la noticia */}
      <Pressable style={card.bottom} onPress={onOpenDetail}>
        <Text style={[card.source, { color: c.textMuted }]}>
          {item.source} · {item.time}
        </Text>
        <Text style={[card.title, { color: c.text }]}>{item.title}</Text>
        <Text
          style={[card.summary, { color: c.textSecondary }]}
          numberOfLines={3}
        >
          {item.summary}
        </Text>

        {item.tickers?.length ? (
          <View style={card.tickerRow}>
            {item.tickers.map((t) => (
              <View
                key={t}
                style={[card.tickerPill, { backgroundColor: c.surfaceHover }]}
              >
                <Text style={[card.tickerText, { color: c.text }]}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[card.readBtn, { backgroundColor: c.ink }]}>
          <Feather name="chevron-up" size={16} color={c.bg} />
          <Text style={[card.readBtnText, { color: c.bg }]}>Leer noticia</Text>
        </View>
      </Pressable>
    </View>
  );
}

/* ─── Hint de primer uso: "deslizá para pasar" ─── */

function SwipeHint({ visible }: { visible: boolean }) {
  const { c } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [mounted, setMounted] = useState(visible);

  // Fade in al aparecer / fade out al descartarse. Se desmonta al terminar.
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, opacity]);

  // Bounce agresivo de la pill entera hacia abajo + pulse de scale
  // mientras está visible. Se siente como un llamado de atención:
  // "tocame y deslizá".
  useEffect(() => {
    if (!visible) return;
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 14,
          duration: 440,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 360,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(220),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 440,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 580,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    bounceLoop.start();
    pulseLoop.start();
    return () => {
      bounceLoop.stop();
      pulseLoop.stop();
    };
  }, [visible, bounce, pulse]);

  if (!mounted) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[hint.wrap, { opacity }]}
    >
      <Animated.View
        style={[
          hint.pill,
          {
            backgroundColor: c.ink,
            transform: [
              { translateY: bounce },
              { scale: pulse },
            ],
          },
        ]}
      >
        <Text style={[hint.text, { color: c.bg }]}>Deslizá para pasar</Text>
        <Feather name="chevrons-down" size={16} color={c.bg} />
      </Animated.View>
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
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);
  const { height: screenH } = Dimensions.get("window");

  // Reset translateY y scrollY cuando se abre
  useEffect(() => {
    if (item) {
      translateY.setValue(0);
      scrollYRef.current = 0;
    }
  }, [item, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        // Capture gana el gesto ANTES que los children (ScrollView).
        // Condición: scroll interno en el tope + tirando hacia abajo vertical.
        onMoveShouldSetPanResponderCapture: (_, g) => {
          return (
            scrollYRef.current <= 0 &&
            g.dy > 8 &&
            Math.abs(g.dy) > Math.abs(g.dx)
          );
        },
        onMoveShouldSetPanResponder: (_, g) => {
          return (
            scrollYRef.current <= 0 &&
            g.dy > 8 &&
            Math.abs(g.dy) > Math.abs(g.dx)
          );
        },
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 120 || g.vy > 0.8) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            Animated.timing(translateY, {
              toValue: screenH,
              duration: 220,
              useNativeDriver: true,
            }).start(onClose);
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 180,
              friction: 12,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 180,
            friction: 12,
          }).start();
        },
      }),
    [screenH, onClose, translateY],
  );

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
        <Animated.View
          style={[sheet.body, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={sheet.dragArea}>
            <View style={sheet.handle} />
          </View>
          {item ? (
            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                scrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              bounces={false}
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
                <View style={sheet.disclaimerBox}>
                  <DisclaimerShort />
                </View>
              </View>
            </ScrollView>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  titleRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 28,
    letterSpacing: -1,
  },
  catRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 12,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  catPillText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
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
  imageWrap: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 24,
  },
  imageAnim: {
    flex: 1,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  image: {
    flex: 1,
    width: "100%",
    borderRadius: 24,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  source: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.05,
    marginBottom: 8,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  summary: {
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
    marginBottom: 16,
  },
  tickerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tickerText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.2,
  },
  readBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.btn,
  },
  readBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },
});

const hint = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  text: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
});

const sheet = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    backgroundColor: "#FAFAF7",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    overflow: "hidden",
  },
  dragArea: {
    height: 56,
    paddingTop: 12,
    alignItems: "center",
  },
  handle: {
    width: 44,
    height: 5,
    backgroundColor: "rgba(14,15,12,0.25)",
    borderRadius: 3,
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
    color: "#0E0F0C",
    fontFamily: fontFamily[700],
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  meta: {
    color: "rgba(14,15,12,0.55)",
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 18,
  },
  disclaimerBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: "rgba(14,15,12,0.18)",
    marginTop: 8,
    marginBottom: 4,
  },
  body_p: {
    color: "rgba(14,15,12,0.88)",
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
    backgroundColor: "rgba(14,15,12,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  tickerText: {
    color: "#0E0F0C",
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
