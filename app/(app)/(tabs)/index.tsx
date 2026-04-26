import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  Animated,
  Easing,
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Tap } from "../../../lib/components/Tap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { LinearGradient } from "expo-linear-gradient";
import {
  useTheme,
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from "../../../lib/theme";
import {
  assets,
  assetIconCode,
  categoryLabels,
  formatARS,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../../lib/data/assets";
import { useAuth } from "../../../lib/auth/context";
import { Sparkline, seriesFromSeed } from "../../../lib/components/Sparkline";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { MoneyIcon } from "../../../lib/components/MoneyIcon";
import { FlagIcon } from "../../../lib/components/FlagIcon";
import { AlamosLogo } from "../../../lib/components/Logo";
import { ProHome } from "../../../lib/components/pro/ProHome";
import { useProMode } from "../../../lib/pro/context";

type Range = "1min" | "1H" | "1D" | "1S" | "1M" | "3M" | "YTD";
type TabId = "dinero" | "portfolio";

/** Tipo de cambio ARS/USD mock. En producción vendría de la API. */
const USD_RATE = 1200;

/** Mismo verde que la pill activa del nav bar — ver app/(app)/(tabs)/_layout.tsx. */
const BRAND_GREEN = "#5ac43e";

/** Constantes del nav bar flotante (espejadas de _layout.tsx) — necesarias
 *  para posicionar la action bar de Inicio justo arriba del nav. */
const NAV_ISLAND_HEIGHT = 68;
const NAV_SIDE_GAP = 16;

const ranges: Range[] = ["1min", "1H", "1D", "1S", "1M", "3M", "YTD"];

/** Variación % por rango — determina el trend y color del chart. */
const rangeChanges: Record<Range, number> = {
  "1min": 0.08,
  "1H": 0.42,
  "1D": 1.96,
  "1S": 3.24,
  "1M": -2.1,
  "3M": 8.45,
  YTD: 15.3,
};

export default function HomeScreen() {
  const { isPro } = useProMode();
  if (isPro) return <ProHome />;
  return <BaseHome />;
}

function BaseHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [range, setRange] = useState<Range>("1D");
  // Tab activo (Dinero / Portfolio). Persisto en SecureStore para que
  // al cerrar y reabrir la app vuelva a la tab que el user dejó.
  const [tab, setTabState] = useState<TabId>("portfolio");
  useEffect(() => {
    SecureStore.getItemAsync("home:active_tab")
      .then((v) => {
        if (v === "dinero" || v === "portfolio") setTabState(v);
      })
      .catch(() => {});
  }, []);
  const setTab = useCallback((next: TabId) => {
    setTabState(next);
    SecureStore.setItemAsync("home:active_tab", next).catch(() => {});
  }, []);
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const toggleCurrency = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setCurrency((p) => (p === "ARS" ? "USD" : "ARS"));
  }, []);

  // Coachmark: la primera vez que el user entra al Inicio, mostramos
  // una pill debajo de la bandera explicando que es tappeable. Se
  // auto-dismissea a los 6s, o cuando el user toca la bandera. Se
  // persiste en SecureStore para no volver a aparecer.
  const [currencyHintSeen, setCurrencyHintSeen] = useState(true);
  const currencyHintOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    SecureStore.getItemAsync("hero:currency_hint_seen")
      .then((v) => {
        if (!v) setCurrencyHintSeen(false);
      })
      .catch(() => {});
  }, []);
  const markCurrencyHintSeen = useCallback(() => {
    Animated.timing(currencyHintOpacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setCurrencyHintSeen(true));
    SecureStore.setItemAsync("hero:currency_hint_seen", "1").catch(() => {});
  }, [currencyHintOpacity]);
  useEffect(() => {
    if (currencyHintSeen) return;
    // Fade in con un pequeño delay para que no aparezca exactamente
    // al mount.
    const t = setTimeout(() => {
      Animated.timing(currencyHintOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start();
    }, 450);
    // Auto-dismiss a los 6s.
    const d = setTimeout(markCurrencyHintSeen, 6000);
    return () => {
      clearTimeout(t);
      clearTimeout(d);
    };
  }, [currencyHintSeen, currencyHintOpacity, markCurrencyHintSeen]);
  // Swipe horizontal sobre el hero para cambiar de moneda.
  const currencyPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 40) {
          Haptics.selectionAsync().catch(() => {});
          setCurrency((p) => (g.dx < 0 ? "USD" : "ARS"));
        }
      },
    }),
  ).current;
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

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
      scrollYRef.current = e.nativeEvent.contentOffset.y;
    },
    [],
  );

  // Tap sobre la tab Inicio estando en Inicio:
  //   · si no estoy arriba → scroll al tope
  //   · si ya estoy arriba → disparar refresh (con animación de pull-to-refresh)
  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (!isFocused) return;
      if (scrollYRef.current > 8) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else if (!refreshing) {
        onRefresh();
      }
    });
    return unsub;
  }, [navigation, isFocused, refreshing, onRefresh]);

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";

  // Saludo según la hora local: 05-12 buen día, 12-20 buenas tardes, resto
  // buenas noches.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Buen día";
    if (h >= 12 && h < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const held = useMemo(() => assets.filter((a) => a.held), []);
  // Portfolios separados: los activos denominados en pesos van por un
  // lado y los denominados en dólares por otro. No convertimos — sólo
  // sumamos los que ya cotizan en cada moneda.
  const arsTotal = useMemo(
    () =>
      held
        .filter((a) => a.category !== "crypto" && a.ticker !== "USD")
        .reduce((sum, a) => sum + a.price * (a.qty ?? 1), 0),
    [held],
  );
  const usdTotal = useMemo(
    () =>
      held
        .filter((a) => a.category === "crypto" || a.ticker === "USD")
        .reduce((sum, a) => {
          // Los USD ya están en USD (qty directo). Crypto acá está
          // priceada en ARS mock, así que sacamos su equivalente USD
          // para exhibir la tenencia en su moneda nativa.
          if (a.ticker === "USD") return sum + (a.qty ?? 0);
          return sum + (a.price * (a.qty ?? 1)) / USD_RATE;
        }, 0),
    [held],
  );
  // `total` sigue siendo el valor combinado en ARS — se usa para el
  // chart del período (la serie de puntos se genera en base a este).
  const total = arsTotal + usdTotal * USD_RATE;

  const series = useMemo(
    () => generateSeries(total, rangeChanges[range], `home-${range}`),
    [total, range],
  );

  const rangePct = rangeChanges[range];
  const isUp = rangePct >= 0;
  const trendColor = isUp ? c.greenDark : c.red;
  // Color del trazo del chart: verde Alamos específico para charts
  // (#5ac43e), separado del trendColor que usamos para textos y pills.
  const chartColor = isUp ? "#5ac43e" : c.red;

  const current = scrubIndex != null ? series[scrubIndex] : series[series.length - 1];
  const rangeStart = series[0];
  const displayDelta = current - rangeStart;
  const displayPct = (displayDelta / rangeStart) * 100;
  const displayIsUp = displayDelta >= 0;
  // Valores 'vigentes' por moneda — durante el scrub, cada portfolio
  // escala por el mismo ratio que el total (current/total).
  const scrubRatio = total > 0 ? current / total : 1;
  const arsCurrent = arsTotal * scrubRatio;
  const usdCurrent = usdTotal * scrubRatio;
  // Delta del período expresado en cada moneda.
  const deltaRatio = total > 0 ? displayDelta / total : 0;
  const arsDelta = arsTotal * deltaRatio;
  const usdDelta = usdTotal * deltaRatio;

  const timeLabel =
    scrubIndex != null
      ? indexLabel(range, scrubIndex, series.length)
      : rangeSubtitle(range);

  const byCategory = useMemo(() => {
    const map = new Map<AssetCategory, { total: number; items: Asset[] }>();
    for (const a of held) {
      const v = a.price * (a.qty ?? 1);
      const entry = map.get(a.category) ?? { total: 0, items: [] };
      entry.total += v;
      entry.items.push(a);
      map.set(a.category, entry);
    }
    return [...map.entries()].sort((a, b) => {
      // Dinero siempre arriba de todo
      if (a[0] === "efectivo") return -1;
      if (b[0] === "efectivo") return 1;
      return b[1].total - a[1].total;
    });
  }, [held]);

  const openDetail = (asset: Asset) => {
    if (asset.category === "efectivo") {
      router.push("/(app)/transfer");
      return;
    }
    router.push({
      pathname: "/(app)/detail",
      params: { ticker: asset.ticker },
    });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Text
          style={[s.topBarGreet, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {greeting}, {firstName}
        </Text>
        <View style={s.topActions}>
          <Tap
            style={[s.topBtn, { backgroundColor: BRAND_GREEN }]}
            onPress={() =>
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ).catch(() => {})
            }
            hitSlop={8}
            haptic="medium"
          >
            <Feather name="gift" size={18} color="#FFFFFF" />
          </Tap>
          <Tap
            style={[s.topBtn, { backgroundColor: c.surfaceHover }]}
            onPress={() => router.push("/(app)/activity")}
            hitSlop={8}
            haptic="selection"
          >
            <Feather name="activity" size={18} color={c.text} />
          </Tap>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 260 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrubIndex == null}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.textMuted}
            colors={[c.textMuted]}
            progressBackgroundColor={c.surface}
          />
        }
      >
        <View style={s.heroBlock}>
          <Pressable
            style={s.amountRow}
            onPress={() => {
              toggleCurrency();
              if (!currencyHintSeen) markCurrencyHintSeen();
            }}
            {...currencyPan.panHandlers}
          >
            <View style={s.flagWrap} pointerEvents="none">
              <FlagIcon code={currency === "ARS" ? "AR" : "US"} size={26} />
              {/* Indicador persistente — chip chiquito con icono de
                  swap en el borde. Le avisa al ojo que la bandera es
                  interactiva. */}
              <View
                style={[
                  s.flagSwapBadge,
                  { backgroundColor: c.ink, borderColor: c.bg },
                ]}
              >
                <Feather name="repeat" size={7} color={c.bg} />
              </View>
            </View>
            <AmountDisplay
              value={currency === "ARS" ? arsCurrent : usdCurrent}
              size={58}
              weight={700}
              prefix={currency === "ARS" ? "$" : "US$"}
            />
            {/* Coachmark: sólo la primera vez, pill debajo de la
                bandera con una flecha para arriba indicando que sea
                tappeada. */}
            {!currencyHintSeen ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  s.currencyHintWrap,
                  { opacity: currencyHintOpacity },
                ]}
              >
                <View
                  style={[s.currencyHintArrow, { borderBottomColor: c.ink }]}
                />
                <View
                  style={[s.currencyHintPill, { backgroundColor: c.ink }]}
                >
                  <Text style={[s.currencyHintText, { color: c.bg }]}>
                    Tocá para ver en {currency === "ARS" ? "USD" : "ARS"}
                  </Text>
                </View>
              </Animated.View>
            ) : null}
          </Pressable>

          <View style={s.deltaRow}>
            <Text style={[s.deltaTri, { color: trendColor }]}>
              {displayIsUp ? "▲" : "▼"}
            </Text>
            <Text style={[s.deltaText, { color: trendColor }]}>
              {currency === "ARS"
                ? formatARS(Math.abs(arsDelta))
                : `US$ ${Math.abs(usdDelta).toLocaleString("es-AR", {
                    maximumFractionDigits: 2,
                  })}`}
            </Text>
            <Text style={[s.deltaSep, { color: trendColor }]}>·</Text>
            <Text style={[s.deltaText, { color: trendColor }]}>
              {formatPct(displayPct)}
            </Text>
            <Text style={[s.deltaSep, { color: c.textMuted }]}>·</Text>
            <Text style={[s.timeLabel, { color: c.textMuted }]}>{timeLabel}</Text>
          </View>

          <View style={[s.chartWrap, { marginTop: 18 }]}>
            <Sparkline
              series={series}
              color={chartColor}
              height={260}
              withFill={false}
              sheen
              strokeWidth={1.4}
              smooth={false}
              onScrub={(idx) => setScrubIndex(idx)}
              onScrubEnd={() => setScrubIndex(null)}
            />
          </View>

          <View style={s.rangeRow}>
            {ranges.map((r) => {
              const active = r === range;
              return (
                <Pressable
                  key={r}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setRange(r);
                  }}
                  style={[
                    s.rangePill,
                    active && { backgroundColor: chartColor },
                  ]}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      s.rangeText,
                      {
                        color: active ? c.bg : chartColor,
                      },
                    ]}
                  >
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Divider sutil entre el bloque del chart y las tabs */}
        <View style={[s.heroDivider, { backgroundColor: c.border }]} />

        <View style={s.tabsWrap}>
          <TabStrip tab={tab} onChange={setTab} />
        </View>

        <View style={s.tabContent}>
          {tab === "dinero" ? (
            <Dinero byCategory={byCategory} />
          ) : (
            <Portfolio
              byCategory={byCategory}
              onOpen={openDetail}
              rangePct={displayPct}
              rangeIsUp={displayIsUp}
              rangeLabel={timeLabel}
            />
          )}
        </View>

      </ScrollView>

      <HomeActionBar />
    </View>
  );
}

/* ─── Action bar flotante: Ingresar / Enviar ─── */
/**
 * Vive en Inicio y se posiciona absoluta arriba del nav island. El cálculo
 * de `bottom` espeja la lógica de _layout.tsx (ISLAND_HEIGHT + bottomGap)
 * para que la barra siempre quede pegada al nav, integrada visualmente.
 * Sólo se renderiza cuando el user está en Inicio porque vive dentro del
 * tree de HomeScreen.
 */
function HomeActionBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const navBottomGap = Math.max(Platform.OS === "ios" ? 24 : 14, insets.bottom);
  const bottom = navBottomGap + NAV_ISLAND_HEIGHT + 8;

  return (
    <View
      pointerEvents="box-none"
      style={[
        s.actionBarWrap,
        { bottom, left: NAV_SIDE_GAP, right: NAV_SIDE_GAP },
      ]}
    >
      <Tap
        style={[s.actionBarPrimary, { backgroundColor: c.ink }]}
        haptic="medium"
        onPress={() =>
          router.push({
            pathname: "/(app)/transfer",
            params: { mode: "deposit" },
          })
        }
      >
        <Feather name="arrow-down-left" size={15} color={c.bg} />
        <Text style={[s.actionBarText, { color: c.bg }]}>Ingresar</Text>
      </Tap>
      <Tap
        style={[
          s.actionBarSecondary,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
        haptic="light"
        onPress={() =>
          router.push({
            pathname: "/(app)/transfer",
            params: { mode: "send" },
          })
        }
      >
        <Feather name="arrow-up-right" size={15} color={c.text} />
        <Text style={[s.actionBarText, { color: c.text }]}>Enviar</Text>
      </Tap>
    </View>
  );
}

/* ─── Helpers ─── */

/** Genera una serie realista: va desde (total / (1 + pct/100)) hasta total, con ruido. */
function generateSeries(total: number, pct: number, seed: string): number[] {
  const length = 40;
  const startValue = total / (1 + pct / 100);
  const noise = seriesFromSeed(seed, length, "flat");
  // Escalamos el ruido proporcional a la magnitud del movimiento del
  // rango (con piso para que rangos muy planos igual tengan textura).
  // Sin esto, rangos cortos como 1min (pct ~0.1%) se veían como un
  // cardiograma porque el ruido constante dominaba la tendencia,
  // mientras que YTD (+15%) se veía como una línea smooth — aunque
  // ambos están normalizados al mismo alto de viewBox. Ahora todos
  // los rangos tienen una relación trend/noise parecida.
  const trendAbs = Math.abs(total - startValue);
  const noiseScale = Math.max(trendAbs * 0.22, total * 0.0025);
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const linear = startValue + (total - startValue) * t;
    const normalized = (noise[i] - 100) / 6;
    out.push(linear + normalized * noiseScale);
  }
  out[length - 1] = total;
  return out;
}

function rangeSubtitle(r: Range): string {
  switch (r) {
    case "1min":
      return "último minuto";
    case "1H":
      return "última hora";
    case "1D":
      return "hoy";
    case "1S":
      return "esta semana";
    case "1M":
      return "este mes";
    case "3M":
      return "3 meses";
    case "YTD":
      return "en el año";
  }
}

function indexLabel(r: Range, index: number, length: number): string {
  const t = 1 - index / (length - 1);
  switch (r) {
    case "1min": {
      const s = Math.round(t * 60);
      if (s === 0) return "ahora";
      if (s === 1) return "hace 1s";
      return `hace ${s}s`;
    }
    case "1H": {
      const m = Math.round(t * 60);
      if (m === 0) return "ahora";
      if (m === 1) return "hace 1m";
      return `hace ${m}m`;
    }
    case "1D": {
      const h = Math.round(t * 24);
      if (h === 0) return "ahora";
      if (h === 1) return "hace 1h";
      return `hace ${h}h`;
    }
    case "1S": {
      const d = Math.round(t * 7);
      if (d === 0) return "hoy";
      if (d === 1) return "hace 1 día";
      return `hace ${d} días`;
    }
    case "1M": {
      const d = Math.round(t * 30);
      if (d === 0) return "hoy";
      return `hace ${d} días`;
    }
    case "3M": {
      const w = Math.round(t * 13);
      if (w === 0) return "hoy";
      if (w === 1) return "hace 1 sem";
      return `hace ${w} sem`;
    }
    case "YTD": {
      // Hoy es abril, así que 0-3 meses atrás cubren el YTD.
      const m = Math.round(t * 4);
      if (m === 0) return "hoy";
      if (m === 1) return "hace 1 mes";
      return `hace ${m} meses`;
    }
  }
}

/* ─── Subcomponentes ─── */


/* ─── TabStrip Dinero / Portfolio ─── */
function TabStrip({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
}) {
  const { c } = useTheme();
  const tabs: { id: TabId; label: string }[] = [
    { id: "dinero", label: "Dinero" },
    { id: "portfolio", label: "Portfolio" },
  ];
  return (
    <View style={[s.tabGroup, { backgroundColor: c.surfaceHover }]}>
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <Pressable
            key={t.id}
            style={[
              s.tab,
              active && [
                s.tabActive,
                { backgroundColor: c.surface, shadowColor: c.ink },
              ],
            ]}
            onPress={() => {
              if (t.id !== tab) Haptics.selectionAsync().catch(() => {});
              onChange(t.id);
            }}
          >
            <Text
              style={[s.tabLabel, { color: active ? c.text : c.textMuted }]}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Dinero: cuentas que rinden + acciones de Ingresar/Enviar ─── */
/** TNA que rinde cada moneda por el solo hecho de holdearse. */
const CURRENCY_TNA: Record<string, { label: string; pct: number }> = {
  ARS: { label: "% TNA", pct: 38.5 },
  USD: { label: "% anual", pct: 4.2 },
};

function Dinero({
  byCategory,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
}) {
  const { c } = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);
  const cash = useMemo(
    () => byCategory.find(([cat]) => cat === "efectivo")?.[1].items ?? [],
    [byCategory],
  );

  const ars = cash.find((a) => a.ticker === "ARS");
  const usd = cash.find((a) => a.ticker === "USD");

  if (!ars && !usd) return null;

  return (
    <View style={s.sectionBlock}>
      {/* Cuentas que rinden — estilo ARQ. */}
      <View style={s.earningsBlock}>
        <View style={s.earningsHead}>
          <Text style={[s.earningsTitle, { color: c.text }]}>
            Cuentas que rinden
          </Text>
          <Pressable
            hitSlop={10}
            onPress={() => setInfoOpen(true)}
            style={[s.infoDot, { backgroundColor: c.surfaceHover }]}
          >
            <Feather name="info" size={12} color={c.textSecondary} />
          </Pressable>
        </View>

        {ars ? (
          <EarningsRow
            flag="AR"
            ticker="ARS"
            name="Peso argentino"
            tna={CURRENCY_TNA.ARS}
            amountPrimary={formatARS(ars.price * (ars.qty ?? 1))}
            amountSecondary={`${((ars.price * (ars.qty ?? 1)) / USD_RATE).toLocaleString(
              "es-AR",
              { maximumFractionDigits: 2 },
            )} USD`}
          />
        ) : null}
        {usd ? (
          <EarningsRow
            flag="US"
            ticker="USD"
            name="Dólar MEP"
            tna={CURRENCY_TNA.USD}
            amountPrimary={`US$ ${(usd.qty ?? 0).toLocaleString("es-AR", {
              maximumFractionDigits: 2,
            })}`}
            amountSecondary={formatARS(usd.price * (usd.qty ?? 1))}
            withTopDivider
          />
        ) : null}
      </View>

      <EarningsInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </View>
  );
}

function EarningsRow({
  flag,
  ticker,
  name,
  tna,
  amountPrimary,
  amountSecondary,
  withTopDivider,
}: {
  flag: "AR" | "US";
  ticker: string;
  name: string;
  tna: { label: string; pct: number };
  amountPrimary: string;
  amountSecondary?: string;
  withTopDivider?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        s.earningsRow,
        withTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
      ]}
    >
      <FlagIcon code={flag} size={40} />
      <View style={{ flex: 1 }}>
        <View style={s.earningsTickerRow}>
          <Text style={[s.earningsTicker, { color: c.text }]}>{ticker}</Text>
          <View style={[s.tnaBadge, { backgroundColor: c.surfaceHover }]}>
            <Text style={[s.tnaBadgeText, { color: c.textSecondary }]}>
              {tna.pct.toLocaleString("es-AR", { minimumFractionDigits: 1 })}
              {tna.label}
            </Text>
          </View>
        </View>
        <Text style={[s.earningsName, { color: c.textMuted }]}>{name}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.earningsPrimary, { color: c.text }]}>
          {amountPrimary}
        </Text>
        {amountSecondary ? (
          <Text style={[s.earningsSecondary, { color: c.textMuted }]}>
            {amountSecondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function EarningsInfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { c } = useTheme();
  if (!visible) return null;
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={s.modalBackdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[s.modalCard, { backgroundColor: c.surface }]}
        >
          <View
            style={[s.modalIconWrap, { backgroundColor: c.greenDim }]}
          >
            <AlamosLogo variant="mark" tone="light" size={36} />
          </View>
          <Text style={[s.modalTitle, { color: c.text }]}>
            Tu saldo genera rendimientos
          </Text>
          <Text style={[s.modalBody, { color: c.textSecondary }]}>
            El saldo que mantengas en tu cuenta rinde de forma
            automática a la tasa vigente de cada moneda. Sin montos
            mínimos, sin límites y sin comisiones. Los intereses se
            acreditan al inicio de cada día hábil.
          </Text>
          <Tap
            onPress={onClose}
            haptic="light"
            style={[s.modalCTA, { backgroundColor: c.ink }]}
          >
            <Text style={[s.modalCTAText, { color: c.bg }]}>Entendido</Text>
          </Tap>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Portfolio: activos financieros con métricas y distribución ─── */
function Portfolio({
  byCategory,
  onOpen,
  rangePct,
  rangeIsUp,
  rangeLabel,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
  onOpen: (a: Asset) => void;
  /** Rendimiento % del período seleccionado en el chart de arriba. */
  rangePct: number;
  rangeIsUp: boolean;
  /** Etiqueta del período (ej. "hoy", "esta semana", "ahora" en scrub). */
  rangeLabel: string;
}) {
  const { c } = useTheme();

  const portfolioEntries = useMemo(
    () => byCategory.filter(([cat]) => cat !== "efectivo"),
    [byCategory],
  );
  // Se sigue usando para calcular la proporción por categoría en el
  // bloque de distribución — no se muestra como monto al usuario.
  const invested = useMemo(
    () => portfolioEntries.reduce((sum, [, data]) => sum + data.total, 0),
    [portfolioEntries],
  );

  if (portfolioEntries.length === 0) {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={[s.emptyPortfolio, { color: c.textMuted }]}>
          Todavía no tenés inversiones. Entrá a Mercado para empezar.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Header minimalista: sólo rendimiento % del período — el monto
          invertido ya está implícito en el chart de arriba. */}
      <View style={s.portfolioHero}>
        <Text style={[s.summaryEyebrow, { color: c.textMuted }]}>
          RENDIMIENTO
        </Text>
        <View style={s.portfolioPctRow}>
          <Text
            style={[
              s.portfolioPctTri,
              { color: rangeIsUp ? c.greenDark : c.red },
            ]}
          >
            {rangeIsUp ? "▲" : "▼"}
          </Text>
          <Text
            style={[
              s.portfolioPct,
              { color: rangeIsUp ? c.greenDark : c.red },
            ]}
          >
            {formatPct(rangePct)}
          </Text>
          <Text style={[s.portfolioPctPeriod, { color: c.textMuted }]}>
            {rangeLabel}
          </Text>
        </View>
      </View>

      {/* Listado agrupado por categoría */}
      {portfolioEntries.map(([cat, data]) => (
        <View key={cat} style={s.groupBlock}>
          <View style={s.groupHead}>
            <Text style={[s.groupTitle, { color: c.text }]}>
              {categoryLabels[cat]}
            </Text>
            <Text style={[s.groupValue, { color: c.textMuted }]}>
              {formatARS(data.total)}
            </Text>
          </View>
          {data.items.map((asset, i) => (
            <AssetRow
              key={asset.ticker}
              asset={asset}
              first={i === 0}
              onPress={() => onOpen(asset)}
            />
          ))}
        </View>
      ))}

      {/* Distribución al final — contextualiza las tenencias */}
      <View style={s.distBlock}>
        <Text style={[s.sectionEyebrow, { color: c.textMuted }]}>
          DISTRIBUCIÓN
        </Text>
        <View style={[s.barTrack, { backgroundColor: c.surfaceSunken }]}>
          {portfolioEntries.map(([cat, data], i) => {
            const pct = (data.total / invested) * 100;
            return (
              <View
                key={cat}
                style={{
                  width: `${pct}%`,
                  backgroundColor: allocationColor(cat, c),
                  borderTopLeftRadius: i === 0 ? radius.pill : 0,
                  borderBottomLeftRadius: i === 0 ? radius.pill : 0,
                  borderTopRightRadius:
                    i === portfolioEntries.length - 1 ? radius.pill : 0,
                  borderBottomRightRadius:
                    i === portfolioEntries.length - 1 ? radius.pill : 0,
                }}
              />
            );
          })}
        </View>

        <View style={{ gap: 10, marginTop: 16 }}>
          {portfolioEntries.map(([cat, data]) => {
            const pct = (data.total / invested) * 100;
            return (
              <View key={cat} style={s.legendRow}>
                <View
                  style={[
                    s.legendDot,
                    { backgroundColor: allocationColor(cat, c) },
                  ]}
                />
                <Text style={[s.legendLabel, { color: c.text }]}>
                  {categoryLabels[cat]}
                </Text>
                <Text style={[s.legendPct, { color: c.textMuted }]}>
                  {pct.toFixed(1)}%
                </Text>
                <Text style={[s.legendValue, { color: c.text }]}>
                  {formatARS(data.total)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function AssetRow({
  asset,
  first,
  onPress,
}: {
  asset: Asset;
  first?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const isCash = asset.category === "efectivo";
  const isUSD = asset.ticker === "USD";
  const qty = asset.qty ?? 0;

  const primaryValue = isCash
    ? isUSD
      ? `US$ ${qty.toLocaleString("es-AR")}`
      : formatARS(qty)
    : formatARS(asset.price * (asset.qty ?? 1));
  const secondaryValue = isCash && isUSD ? formatARS(asset.price * qty) : null;

  const up = asset.change >= 0;

  const bg =
    asset.iconTone === "dark"
      ? c.ink
      : asset.iconTone === "accent"
      ? c.green
      : c.surfaceSunken;
  const fg =
    asset.iconTone === "dark"
      ? c.bg
      : asset.iconTone === "accent"
      ? c.ink
      : c.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.row,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
      ]}
    >
      {isCash && (asset.ticker === "ARS" || asset.ticker === "USD") ? (
        <MoneyIcon
          variant={asset.ticker === "ARS" ? "ars" : "usd"}
          size={40}
        />
      ) : (
        <View style={[s.rowIcon, { backgroundColor: bg }]}>
          <Text style={[s.rowIconText, { color: fg }]}>
            {assetIconCode(asset)}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTicker, { color: c.text }]}>
          {isCash ? asset.name : asset.ticker}
        </Text>
        <Text style={[s.rowSub, { color: c.textMuted }]}>
          {isCash
            ? asset.subLabel
            : `${asset.qty} ${asset.qty === 1 ? "unidad" : "unidades"} · ${formatARS(asset.price)}`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.rowPrice, { color: c.text }]}>{primaryValue}</Text>
        {secondaryValue ? (
          <Text style={[s.rowChange, { color: c.textMuted }]}>
            ≈ {secondaryValue}
          </Text>
        ) : !isCash ? (
          <Text style={[s.rowChange, { color: up ? c.greenDark : c.red }]}>
            {formatPct(asset.change)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function allocationColor(cat: AssetCategory, c: ThemeColors): string {
  switch (cat) {
    case "efectivo":
      return c.green;
    case "cedears":
      return c.ink;
    case "bonos":
      return c.greenDark;
    case "fci":
      return c.textSecondary;
    case "acciones":
      return c.textMuted;
    case "obligaciones":
      return c.borderStrong;
    default:
      return c.textFaint;
  }
}

const s = StyleSheet.create({
  /* ─── Core layout ─── */
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarGreet: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    letterSpacing: -0.15,
    flex: 1,
    marginRight: 12,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    marginTop: 8,
  },
  chartWrap: {
    position: "relative",
    overflow: "hidden",
  },
  /* TabStrip Dinero / Portfolio */
  tabsWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  tabGroup: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  tabActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabLabel: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  tabContent: {
    marginTop: 4,
  },

  /* Secciones editoriales (Dinero / Portfolio) */
  sectionBlock: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
  sectionEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
  },

  /* Action bar flotante (Ingresar / Enviar) sobre el nav island. */
  actionBarWrap: {
    position: "absolute",
    flexDirection: "row",
    gap: 10,
  },
  actionBarPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: radius.pill,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
  actionBarSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  actionBarText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },

  /* Earnings accounts block (estilo ARQ) */
  earningsBlock: {
    gap: 2,
  },
  earningsHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  earningsTitle: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
  },
  infoDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  earningsTickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  earningsTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  tnaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tnaBadgeText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
  },
  earningsName: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  earningsPrimary: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  earningsSecondary: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },

  /* Modal del info de TNA */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    width: "100%",
    borderRadius: radius.xl,
    padding: 24,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: "center",
  },
  modalBody: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    textAlign: "center",
    marginBottom: 20,
  },
  modalCTA: {
    alignSelf: "stretch",
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCTAText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },

  /* Portfolio hero */
  portfolioHero: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  summaryEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  portfolioPctRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 4,
  },
  portfolioPctTri: {
    fontFamily: fontFamily[700],
    fontSize: 18,
  },
  portfolioPct: {
    fontFamily: fontFamily[800],
    fontSize: 32,
    letterSpacing: -1.1,
  },
  portfolioPctPeriod: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginLeft: 2,
  },
  emptyPortfolio: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 24,
  },
  distBlock: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 12,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    position: "relative",
  },
  flagWrap: {
    position: "relative",
  },
  flagSwapBadge: {
    position: "absolute",
    bottom: -3,
    right: -4,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  currencyHintWrap: {
    position: "absolute",
    top: 62,
    left: -4,
    alignItems: "flex-start",
    zIndex: 20,
  },
  currencyHintArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginLeft: 16,
  },
  currencyHintPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.md,
  },
  currencyHintText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -2,
    marginBottom: 8,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    flexWrap: "wrap",
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
  timeLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 0,
    paddingHorizontal: 4,
  },
  rangePill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
  },
  groupBlock: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  groupTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  groupValue: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.3,
  },
  rowTicker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  rowSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  rowPrice: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowChange: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    marginTop: 2,
  },
  barTrack: {
    height: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    overflow: "hidden",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  legendPct: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    minWidth: 46,
    textAlign: "right",
  },
  legendValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    minWidth: 92,
    textAlign: "right",
    letterSpacing: -0.15,
  },
});
