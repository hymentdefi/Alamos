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
  TextInput,
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Tap } from "../../../lib/components/Tap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
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
import {
  accounts,
  convertAmount,
  formatAccountBalance,
  rateBetween,
  type Account,
  type AccountId,
} from "../../../lib/data/accounts";
import { useAuth } from "../../../lib/auth/context";
import { Sparkline, seriesFromSeed } from "../../../lib/components/Sparkline";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { MoneyIcon } from "../../../lib/components/MoneyIcon";
import { FlagIcon } from "../../../lib/components/FlagIcon";
import { AlamosLogo } from "../../../lib/components/Logo";
import { ProHome } from "../../../lib/components/pro/ProHome";
import { useProMode } from "../../../lib/pro/context";

type Range = "live" | "1H" | "1D" | "1S" | "1M" | "3M" | "YTD";
type TabId = "dinero" | "portfolio" | "rendimientos";

/** Tipo de cambio ARS/USD mock. En producción vendría de la API. */
const USD_RATE = 1200;

/** Mismo verde que la pill activa del nav bar — ver app/(app)/(tabs)/_layout.tsx. */
const BRAND_GREEN = "#5ac43e";

const ranges: Range[] = ["live", "1H", "1D", "1S", "1M", "3M", "YTD"];

/** Variación % por rango — determina el trend y color del chart. */
const rangeChanges: Record<Range, number> = {
  live: 0.08,
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
        if (v === "dinero" || v === "portfolio" || v === "rendimientos") {
          setTabState(v);
        }
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

  // Tick para el modo Live: cada ~3s rotamos el seed y forzamos
  // re-render para que el chart "respire" y el último punto se mueva.
  // Solo corre cuando estás en Inicio + range==="live" — pausa al
  // cambiar de tab o de rango para no quemar batería.
  const [liveTick, setLiveTick] = useState(0);
  useEffect(() => {
    if (range !== "live" || !isFocused) return;
    const id = setInterval(() => setLiveTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [range, isFocused]);

  const series = useMemo(
    () =>
      generateSeries(
        total,
        rangeChanges[range],
        range === "live" ? `home-live-${liveTick}` : `home-${range}`,
      ),
    [total, range, liveTick],
  );

  // Pulse continuo del puntito de Live — corre solo cuando hace falta.
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (range !== "live") {
      livePulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [range, livePulse]);

  // Respiración del botón de regalo: scale 1 → 1.10 → 1 con pausa de 1.5s
  // entre breaths. Suficiente para llamar la atención sin distraer.
  const giftPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isFocused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(giftPulse, {
          toValue: 1.1,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(giftPulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.delay(1500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isFocused, giftPulse]);

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
        <View style={s.topActions}>
          <Animated.View
            style={[
              s.giftBtnWrap,
              {
                shadowColor: BRAND_GREEN,
                transform: [{ scale: giftPulse }],
              },
            ]}
          >
            <Tap
              style={[s.giftBtn, { backgroundColor: BRAND_GREEN }]}
              onPress={() =>
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                ).catch(() => {})
              }
              hitSlop={8}
              haptic="medium"
            >
              <Ionicons name="gift" size={20} color="#FFFFFF" />
            </Tap>
          </Animated.View>
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
        contentContainerStyle={{ paddingBottom: 180 }}
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
          <Text
            style={[s.heroGreet, { color: c.textMuted }]}
            numberOfLines={1}
          >
            {greeting}, {firstName}
          </Text>
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
            {range === "live" && scrubIndex == null ? (
              <View style={s.liveLabelInline}>
                <Animated.View
                  style={[
                    s.liveDot,
                    { backgroundColor: trendColor, opacity: livePulse },
                  ]}
                />
                <Text style={[s.timeLabel, { color: c.textMuted }]}>
                  en vivo
                </Text>
              </View>
            ) : (
              <Text style={[s.timeLabel, { color: c.textMuted }]}>
                {timeLabel}
              </Text>
            )}
          </View>

          <HeroActions />

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
              const fg = active ? c.bg : chartColor;
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
                  <Text style={[s.rangeText, { color: fg }]}>
                    {r === "live" ? "LIVE" : r}
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
          ) : tab === "portfolio" ? (
            <Portfolio
              byCategory={byCategory}
              onOpen={openDetail}
              rangePct={displayPct}
              rangeIsUp={displayIsUp}
              rangeLabel={timeLabel}
            />
          ) : (
            <Rendimientos byCategory={byCategory} onOpen={openDetail} />
          )}
        </View>

      </ScrollView>
    </View>
  );
}

/* ─── Botones Ingresar / Enviar inline en el hero ─── */
function HeroActions() {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <View style={s.heroActionsRow}>
      <Tap
        style={[s.heroActionPrimary, { backgroundColor: c.ink }]}
        haptic="medium"
        onPress={() =>
          router.push({
            pathname: "/(app)/transfer",
            params: { mode: "deposit" },
          })
        }
      >
        <Feather name="arrow-down-left" size={15} color={c.bg} />
        <Text style={[s.heroActionText, { color: c.bg }]}>Ingresar</Text>
      </Tap>
      <Tap
        style={[
          s.heroActionSecondary,
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
        <Text style={[s.heroActionText, { color: c.text }]}>Enviar</Text>
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
    case "live":
      return "en vivo";
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
    case "live": {
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
    { id: "rendimientos", label: "Rendimientos" },
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

/* ─── Dinero: cuentas (ARS, USD MEP, USD USA, USDT) + Convertir ─── */
function Dinero(_: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
}) {
  const { c } = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertFromId, setConvertFromId] = useState<AccountId | undefined>();

  const openConvertFrom = useCallback((id?: AccountId) => {
    setConvertFromId(id);
    setConvertOpen(true);
  }, []);

  return (
    <View style={s.sectionBlock}>
      <View style={s.earningsBlock}>
        <View style={s.earningsHead}>
          <Text style={[s.earningsTitle, { color: c.text }]}>Tus cuentas</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setInfoOpen(true)}
            style={[s.infoDot, { backgroundColor: c.surfaceHover }]}
          >
            <Feather name="info" size={12} color={c.textSecondary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Tap
            haptic="medium"
            onPress={() => openConvertFrom(undefined)}
            style={[s.convertBtn, { backgroundColor: c.ink }]}
          >
            <Feather name="repeat" size={13} color={c.bg} />
            <Text style={[s.convertBtnText, { color: c.bg }]}>Convertir</Text>
          </Tap>
        </View>

        {accounts.map((a, i) => (
          <AccountRow
            key={a.id}
            account={a}
            withTopDivider={i > 0}
            onPress={() => openConvertFrom(a.id)}
          />
        ))}
      </View>

      <EarningsInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
      <ConvertSheet
        visible={convertOpen}
        onClose={() => setConvertOpen(false)}
        initialFromId={convertFromId}
      />
    </View>
  );
}

/** Devuelve qué variant de MoneyIcon usar para cada moneda. */
function moneyVariantFor(c: Account["currency"]): "ars" | "usd" | "usdt" {
  if (c === "ARS") return "ars";
  if (c === "USDT") return "usdt";
  return "usd";
}

function AccountRow({
  account,
  withTopDivider,
  onPress,
}: {
  account: Account;
  withTopDivider?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  // Si la cuenta no es ARS, mostramos su equivalente en pesos como secundario.
  const arsEquiv =
    account.currency === "ARS"
      ? null
      : `≈ ${formatARS(convertAmount(account.balance, account.currency, "ARS"))}`;

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.earningsRow,
        withTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
      ]}
    >
      <MoneyIcon variant={moneyVariantFor(account.currency)} size={40} />
      <View style={{ flex: 1 }}>
        <View style={s.earningsTickerRow}>
          <Text style={[s.earningsTicker, { color: c.text }]}>
            {account.currency}
          </Text>
          <View style={[s.tnaBadge, { backgroundColor: c.surfaceHover }]}>
            <Text style={[s.tnaBadgeText, { color: c.textSecondary }]}>
              {account.yield.pct.toLocaleString("es-AR", {
                minimumFractionDigits: 1,
              })}
              {account.yield.label}
            </Text>
          </View>
        </View>
        <Text style={[s.earningsName, { color: c.textMuted }]} numberOfLines={1}>
          {account.location}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.earningsPrimary, { color: c.text }]}>
          {formatAccountBalance(account)}
        </Text>
        {arsEquiv ? (
          <Text style={[s.earningsSecondary, { color: c.textMuted }]}>
            {arsEquiv}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ─── Bottom sheet de conversión entre cuentas ─── */
function ConvertSheet({
  visible,
  onClose,
  initialFromId,
}: {
  visible: boolean;
  onClose: () => void;
  initialFromId?: AccountId;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [fromId, setFromId] = useState<AccountId>("ars-ar");
  const [toId, setToId] = useState<AccountId>("usd-ar");
  const [amount, setAmount] = useState("");
  // null si no hay picker abierto, sino indica para qué slot.
  const [pickerSlot, setPickerSlot] = useState<null | "from" | "to">(null);

  // Setea defaults razonables al abrir: si llega initialFromId, usa esa
  // como origen y elige la primera otra como destino.
  useEffect(() => {
    if (!visible) return;
    const from = initialFromId ?? "ars-ar";
    setFromId(from);
    const firstOther = accounts.find((a) => a.id !== from)?.id ?? "usd-ar";
    setToId(firstOther);
    setAmount("");
    setPickerSlot(null);
  }, [visible, initialFromId]);

  const from = accounts.find((a) => a.id === fromId)!;
  const to = accounts.find((a) => a.id === toId)!;
  const numericAmount = parseFloat(amount.replace(",", ".")) || 0;
  const received = convertAmount(numericAmount, from.currency, to.currency);
  const rate = rateBetween(from.currency, to.currency);
  const insufficient = numericAmount > from.balance;
  const canConfirm = numericAmount > 0 && !insufficient && fromId !== toId;

  const swap = () => {
    Haptics.selectionAsync().catch(() => {});
    setFromId(toId);
    setToId(fromId);
  };

  const onPickAccount = (id: AccountId) => {
    Haptics.selectionAsync().catch(() => {});
    if (pickerSlot === "from") {
      setFromId(id);
      // Si quedó igual al destino, movemos el destino a otra cuenta.
      if (id === toId) {
        setToId(accounts.find((a) => a.id !== id)!.id);
      }
    } else if (pickerSlot === "to") {
      setToId(id);
      if (id === fromId) {
        setFromId(accounts.find((a) => a.id !== id)!.id);
      }
    }
    setPickerSlot(null);
  };

  const onConfirm = () => {
    if (!canConfirm) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    Alert.alert(
      "Conversión enviada",
      `Vas a recibir ${formatConvertPreview(received, to.currency)} en ${to.location}.`,
      [{ text: "Listo", onPress: onClose }],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.convertWrap}>
        <Pressable style={s.convertBackdrop} onPress={onClose} />
        <View
          style={[
            s.convertSheet,
            { backgroundColor: c.bg, paddingBottom: insets.bottom + 18 },
          ]}
        >
          <View style={s.convertHandle} />
          <View style={s.convertHead}>
            <Text style={[s.convertTitle, { color: c.text }]}>Convertir</Text>
            <Pressable
              hitSlop={10}
              onPress={onClose}
              style={[s.convertClose, { backgroundColor: c.surfaceHover }]}
            >
              <Feather name="x" size={16} color={c.text} />
            </Pressable>
          </View>

          {pickerSlot ? (
            <View style={s.convertPickerBlock}>
              <Text style={[s.convertEyebrow, { color: c.textMuted }]}>
                ELEGÍ LA CUENTA
              </Text>
              {accounts.map((a) => {
                const selected =
                  pickerSlot === "from" ? a.id === fromId : a.id === toId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => onPickAccount(a.id)}
                    style={[
                      s.convertPickerRow,
                      { borderBottomColor: c.border },
                    ]}
                  >
                    <MoneyIcon
                      variant={moneyVariantFor(a.currency)}
                      size={36}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[s.convertPickerCurrency, { color: c.text }]}
                      >
                        {a.currency}
                      </Text>
                      <Text
                        style={[s.convertPickerLoc, { color: c.textMuted }]}
                      >
                        {a.location}
                      </Text>
                    </View>
                    <Text
                      style={[s.convertPickerBal, { color: c.textSecondary }]}
                    >
                      {formatAccountBalance(a)}
                    </Text>
                    {selected ? (
                      <Feather
                        name="check"
                        size={18}
                        color={BRAND_GREEN}
                        style={{ marginLeft: 8 }}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
              <Text style={[s.convertEyebrow, { color: c.textMuted }]}>DE</Text>
              <Pressable
                onPress={() => setPickerSlot("from")}
                style={[
                  s.convertSelector,
                  { backgroundColor: c.surfaceHover, borderColor: c.border },
                ]}
              >
                <MoneyIcon
                  variant={moneyVariantFor(from.currency)}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[s.convertSelCurrency, { color: c.text }]}>
                    {from.currency}
                  </Text>
                  <Text style={[s.convertSelLoc, { color: c.textMuted }]}>
                    {from.location} · {formatAccountBalance(from)}
                  </Text>
                </View>
                <Feather name="chevron-down" size={18} color={c.textMuted} />
              </Pressable>

              <View style={s.convertSwapWrap}>
                <View style={[s.convertSwapLine, { backgroundColor: c.border }]} />
                <Pressable
                  onPress={swap}
                  style={[s.convertSwap, { backgroundColor: c.ink }]}
                  hitSlop={8}
                >
                  <Feather name="repeat" size={15} color={c.bg} />
                </Pressable>
                <View style={[s.convertSwapLine, { backgroundColor: c.border }]} />
              </View>

              <Text style={[s.convertEyebrow, { color: c.textMuted }]}>A</Text>
              <Pressable
                onPress={() => setPickerSlot("to")}
                style={[
                  s.convertSelector,
                  { backgroundColor: c.surfaceHover, borderColor: c.border },
                ]}
              >
                <MoneyIcon variant={moneyVariantFor(to.currency)} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.convertSelCurrency, { color: c.text }]}>
                    {to.currency}
                  </Text>
                  <Text style={[s.convertSelLoc, { color: c.textMuted }]}>
                    {to.location}
                  </Text>
                </View>
                <Feather name="chevron-down" size={18} color={c.textMuted} />
              </Pressable>

              <Text
                style={[
                  s.convertEyebrow,
                  { color: c.textMuted, marginTop: 18 },
                ]}
              >
                CANTIDAD
              </Text>
              <View
                style={[
                  s.convertAmountWrap,
                  { backgroundColor: c.surfaceHover, borderColor: c.border },
                ]}
              >
                <Text style={[s.convertAmountCur, { color: c.textMuted }]}>
                  {from.currency}
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor={c.textFaint}
                  keyboardType="decimal-pad"
                  style={[s.convertAmountInput, { color: c.text }]}
                />
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setAmount(String(from.balance));
                  }}
                  hitSlop={8}
                  style={[s.convertMaxBtn, { backgroundColor: c.surface }]}
                >
                  <Text style={[s.convertMaxText, { color: c.text }]}>MAX</Text>
                </Pressable>
              </View>

              <View style={s.convertPreviewBlock}>
                <View style={s.convertPreviewRow}>
                  <Text style={[s.convertPreviewLabel, { color: c.textMuted }]}>
                    Recibís
                  </Text>
                  <Text style={[s.convertPreviewValue, { color: c.text }]}>
                    ≈ {formatConvertPreview(received, to.currency)}
                  </Text>
                </View>
                <View style={s.convertPreviewRow}>
                  <Text style={[s.convertPreviewLabel, { color: c.textMuted }]}>
                    Cotización
                  </Text>
                  <Text
                    style={[s.convertPreviewSub, { color: c.textSecondary }]}
                  >
                    1 {from.currency} ={" "}
                    {rate.toLocaleString("es-AR", {
                      maximumFractionDigits: rate < 1 ? 6 : 2,
                    })}{" "}
                    {to.currency}
                  </Text>
                </View>
                {insufficient ? (
                  <Text style={[s.convertWarn, { color: c.red }]}>
                    Saldo insuficiente — tenés{" "}
                    {formatAccountBalance(from)} disponibles.
                  </Text>
                ) : null}
              </View>

              <Tap
                haptic="medium"
                onPress={onConfirm}
                disabled={!canConfirm}
                style={[
                  s.convertCTA,
                  {
                    backgroundColor: canConfirm ? c.ink : c.surfaceHover,
                    opacity: canConfirm ? 1 : 0.6,
                  },
                ]}
              >
                <Text
                  style={[
                    s.convertCTAText,
                    { color: canConfirm ? c.bg : c.textMuted },
                  ]}
                >
                  Convertir
                </Text>
              </Tap>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatConvertPreview(n: number, currency: Account["currency"]): string {
  if (currency === "ARS") {
    return "$ " + Math.round(n).toLocaleString("es-AR");
  }
  const sym = currency === "USD" ? "US$" : "USDT";
  return `${sym} ${n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

/* ─── Rendimientos: ganancia del día + ranking de activos ─── */
function Rendimientos({
  byCategory,
  onOpen,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
  onOpen: (a: Asset) => void;
}) {
  const { c } = useTheme();

  // Activos no-cash, ordenados de mejor a peor performance del día.
  const ranked = useMemo(
    () =>
      byCategory
        .filter(([cat]) => cat !== "efectivo")
        .flatMap(([, data]) => data.items)
        .slice()
        .sort((a, b) => b.change - a.change),
    [byCategory],
  );

  if (ranked.length === 0) {
    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={[s.emptyPortfolio, { color: c.textMuted }]}>
          Cuando empieces a invertir, tus rendimientos van a aparecer acá.
        </Text>
      </View>
    );
  }

  // Ganancia $ del día por activo: tenencia × % cambio.
  const dayReturn = (a: Asset) => a.price * (a.qty ?? 1) * (a.change / 100);
  const totalReturn = ranked.reduce((sum, a) => sum + dayReturn(a), 0);
  const totalIsUp = totalReturn >= 0;
  const winners = ranked.filter((a) => a.change >= 0).length;
  const losers = ranked.length - winners;

  return (
    <View>
      <View style={s.rendHero}>
        <Text style={[s.summaryEyebrow, { color: c.textMuted }]}>
          GANANCIA DEL DÍA
        </Text>
        <View style={s.rendHeroRow}>
          <Text
            style={[
              s.rendHeroTri,
              { color: totalIsUp ? c.greenDark : c.red },
            ]}
          >
            {totalIsUp ? "▲" : "▼"}
          </Text>
          <Text
            style={[
              s.rendHeroAmount,
              { color: totalIsUp ? c.greenDark : c.red },
            ]}
          >
            {totalIsUp ? "+" : "−"}
            {formatARS(Math.abs(totalReturn))}
          </Text>
        </View>
        <Text style={[s.rendHeroSub, { color: c.textMuted }]}>
          {winners} {winners === 1 ? "en alza" : "en alza"}
          {" · "}
          {losers} {losers === 1 ? "en baja" : "en baja"}
        </Text>
      </View>

      <View style={s.groupBlock}>
        <View style={s.groupHead}>
          <Text style={[s.groupTitle, { color: c.text }]}>Ranking del día</Text>
          <Text style={[s.groupValue, { color: c.textMuted }]}>
            {ranked.length} {ranked.length === 1 ? "activo" : "activos"}
          </Text>
        </View>
        {ranked.map((asset, i) => (
          <ReturnRow
            key={asset.ticker}
            asset={asset}
            first={i === 0}
            dayReturn={dayReturn(asset)}
            onPress={() => onOpen(asset)}
          />
        ))}
      </View>
    </View>
  );
}

function ReturnRow({
  asset,
  first,
  dayReturn,
  onPress,
}: {
  asset: Asset;
  first?: boolean;
  dayReturn: number;
  onPress: () => void;
}) {
  const { c } = useTheme();
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
      <View style={[s.rowIcon, { backgroundColor: bg }]}>
        <Text style={[s.rowIconText, { color: fg }]}>
          {assetIconCode(asset)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTicker, { color: c.text }]}>{asset.ticker}</Text>
        <Text style={[s.rowSub, { color: c.textMuted }]} numberOfLines={1}>
          {asset.name}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.rowPrice, { color: up ? c.greenDark : c.red }]}>
          {up ? "+" : "−"}
          {formatARS(Math.abs(dayReturn))}
        </Text>
        <Text style={[s.rowChange, { color: up ? c.greenDark : c.red }]}>
          {formatPct(asset.change)}
        </Text>
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
    justifyContent: "flex-end",
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
  /* Wrapper que vive afuera del Tap para que el shadow no se recorte
     y para que la animación de scale incluya el glow. */
  giftBtnWrap: {
    borderRadius: radius.pill,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 9,
    elevation: 8,
  },
  giftBtn: {
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

  /* Botones Ingresar / Enviar inline en el hero, abajo del saldo. */
  heroActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  heroActionPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: radius.pill,
  },
  heroActionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  heroActionText: {
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
  convertBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  convertBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* ConvertSheet */
  convertWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  convertBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  convertSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "92%",
  },
  convertHandle: {
    width: 44,
    height: 5,
    backgroundColor: "rgba(128,128,128,0.35)",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 14,
  },
  convertHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  convertTitle: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  convertClose: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  convertEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  convertSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  convertSelCurrency: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  convertSelLoc: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  convertSwapWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  convertSwapLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  convertSwap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
  },
  convertAmountWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  convertAmountCur: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: 0.3,
  },
  convertAmountInput: {
    flex: 1,
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
    paddingVertical: 6,
  },
  convertMaxBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  convertMaxText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.6,
  },
  convertPreviewBlock: {
    marginTop: 16,
    marginBottom: 22,
    gap: 6,
  },
  convertPreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  convertPreviewLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  convertPreviewValue: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.3,
  },
  convertPreviewSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  convertWarn: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 6,
  },
  convertCTA: {
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  convertCTAText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  convertPickerBlock: {
    paddingTop: 4,
  },
  convertPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  convertPickerCurrency: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  convertPickerLoc: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  convertPickerBal: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
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

  /* Rendimientos hero */
  rendHero: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  rendHeroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 4,
  },
  rendHeroTri: {
    fontFamily: fontFamily[700],
    fontSize: 18,
  },
  rendHeroAmount: {
    fontFamily: fontFamily[800],
    fontSize: 32,
    letterSpacing: -1.1,
  },
  rendHeroSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 8,
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
  heroGreet: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    letterSpacing: -0.15,
    marginBottom: 16,
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
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveLabelInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
