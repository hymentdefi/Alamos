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
import Svg, { Polygon } from "react-native-svg";
import {
  useTheme,
  fontFamily,
  radius,
} from "../../../lib/theme";
import {
  assets,
  assetIconCode,
  assetCurrency,
  formatARS,
  formatMoney,
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
import {
  MiniSparkline,
  Sparkline,
  seriesFromSeed,
} from "../../../lib/components/Sparkline";
import { CryptoIcon } from "../../../lib/components/CryptoIcon";
import { AutoMarquee } from "../../../lib/components/AutoMarquee";
import {
  StoryOverlay,
  type StoryConfig,
} from "../../../lib/components/StoryOverlay";
import { US_MARKET_STORY } from "../../../lib/data/stories";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { MoneyIcon } from "../../../lib/components/MoneyIcon";
import { FlagIcon } from "../../../lib/components/FlagIcon";
import { AccountAvatar } from "../../../lib/components/AccountAvatar";
import { AlamosLogo } from "../../../lib/components/Logo";
import {
  AlamosIcon,
  type AlamosIconName,
} from "../../../lib/components/AlamosIcon";
import { ChartSettingsSheet } from "../../../lib/components/ChartSettingsSheet";
import { GearIcon } from "../../../lib/components/GearIcon";
import { usePrivacy, maskAmount } from "../../../lib/privacy/context";
import { ProHome } from "../../../lib/components/pro/ProHome";
import { useProMode } from "../../../lib/pro/context";

type Range = "live" | "1H" | "1D" | "1S" | "1M" | "3M" | "YTD";

/** Tipo de cambio ARS/USD mock. En producción vendría de la API. */
const USD_RATE = 1200;

/**
 * @deprecated Usar `c.action` (CTA primario) o `c.brand` (identidad).
 * Lo mantenemos por compatibilidad mientras migramos los call-sites
 * — apunta al mismo hex que `c.action` del theme. */
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

/**
 * Hook para gatear una acción detrás de una Story educativa que solo
 * se muestra la primera vez. Persiste en SecureStore con la key
 * `story:<id>:seen`. Si la story ya se vio, ejecuta la acción al
 * toque; si no, guarda la acción como pendiente y abre la story —
 * cuando se cierra (último slide o X), marca como vista y ejecuta.
 */
function useGateStory(story: StoryConfig) {
  const storeKey = `story:${story.id}:seen`;
  // null mientras carga, true/false una vez resuelto.
  const seenRef = useRef<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(storeKey)
      .then((v) => {
        seenRef.current = !!v;
      })
      .catch(() => {
        seenRef.current = false;
      });
  }, [storeKey]);

  const gate = useCallback((action: () => void) => {
    // Si seenRef es null (aún cargando) o true, ejecutamos directo —
    // evita mostrar la story por error si el SecureStore tarda.
    if (seenRef.current === false) {
      pendingRef.current = action;
      setOpen(true);
    } else {
      action();
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    seenRef.current = true;
    SecureStore.setItemAsync(storeKey, "1").catch(() => {});
    const pending = pendingRef.current;
    pendingRef.current = null;
    pending?.();
  }, [storeKey]);

  return { open, gate, close };
}

function BaseHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { hideAmounts, set: setHideAmounts } = usePrivacy();
  // Range del chart — persistido en SecureStore para que la próxima
  // vez que el usuario abra la app vea el rango que dejó la última.
  const [range, setRange] = useState<Range>("1D");
  useEffect(() => {
    SecureStore.getItemAsync("home:chart_range")
      .then((v) => {
        if (v && (ranges as readonly string[]).includes(v)) {
          setRange(v as Range);
        }
      })
      .catch(() => {});
  }, []);
  const setRangeAndSave = useCallback((r: Range) => {
    setRange(r);
    SecureStore.setItemAsync("home:chart_range", r).catch(() => {});
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
          setCurrency((p) => (p === "ARS" ? "USD" : "ARS"));
        }
      },
    }),
  ).current;
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  // Callbacks estables para que el Sparkline (memoizado) no se
  // re-renderee en cada cambio de state del padre. Sin esto, cada
  // tick del scrub propagaba a un re-render de TODO BaseHome.
  const onScrub = useCallback((idx: number) => setScrubIndex(idx), []);
  const onScrubEnd = useCallback(() => setScrubIndex(null), []);

  /* ─── Ajustes del chart ─── */
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);
  // Setting cards principales — considerar movimientos de plata.
  const [considerCashflow, setConsiderCashflow] = useState(true);
  // Toggles compactos.
  const [referenceLine, setReferenceLine] = useState(false);
  const [smoothChart, setSmoothChart] = useState(false);

  // Carga inicial de las preferencias persistidas.
  useEffect(() => {
    SecureStore.getItemAsync("home:chart_consider_cashflow")
      .then((v) => {
        if (v === "0") setConsiderCashflow(false);
      })
      .catch(() => {});
    SecureStore.getItemAsync("home:chart_reference_line")
      .then((v) => {
        if (v === "1") setReferenceLine(true);
      })
      .catch(() => {});
    SecureStore.getItemAsync("home:chart_smooth")
      .then((v) => {
        if (v === "1") setSmoothChart(true);
      })
      .catch(() => {});
  }, []);

  const onChangeConsiderCashflow = useCallback((next: boolean) => {
    setConsiderCashflow(next);
    SecureStore.setItemAsync(
      "home:chart_consider_cashflow",
      next ? "1" : "0",
    ).catch(() => {});
  }, []);
  const onChangeReferenceLine = useCallback((next: boolean) => {
    setReferenceLine(next);
    SecureStore.setItemAsync(
      "home:chart_reference_line",
      next ? "1" : "0",
    ).catch(() => {});
  }, []);
  const onChangeSmoothChart = useCallback((next: boolean) => {
    setSmoothChart(next);
    SecureStore.setItemAsync("home:chart_smooth", next ? "1" : "0").catch(
      () => {},
    );
  }, []);

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

  const held = useMemo(() => assets.filter((a) => a.held), []);
  // Portfolios separados por moneda nativa del activo. No convertimos —
  // cada uno se exhibe en la moneda en la que cotiza.
  //   ARS: efectivo en pesos + CEDEARs / bonos / FCIs / acciones AR.
  //   USD: efectivo en dólares + acciones US (NYSE/NASDAQ).
  //   USDT: balance de la wallet crypto + crypto/futuros held.
  const arsTotal = useMemo(
    () =>
      held
        .filter((a) => assetCurrency(a) === "ARS")
        .reduce((sum, a) => sum + a.price * (a.qty ?? 1), 0),
    [held],
  );
  const usdTotal = useMemo(
    () =>
      held
        .filter((a) => assetCurrency(a) === "USD")
        .reduce((sum, a) => {
          // El "USD" cash row tiene qty=saldo en USD y price=tipo de
          // cambio, así que para tenencia usamos qty directo. Para
          // acciones USA, price * qty ya está en USD.
          if (a.ticker === "USD") return sum + (a.qty ?? 0);
          return sum + a.price * (a.qty ?? 1);
        }, 0),
    [held],
  );
  // USDT total: balance de la wallet crypto + crypto held (price en USDT).
  const usdtTotal = useMemo(() => {
    const usdtAccount = accounts.find((a) => a.id === "usdt-crypto");
    const cryptoInUsdt = held
      .filter((a) => assetCurrency(a) === "USDT")
      .reduce((sum, a) => sum + a.price * (a.qty ?? 1), 0);
    return (usdtAccount?.balance ?? 0) + cryptoInUsdt;
  }, [held]);
  // `total` sigue siendo el valor combinado en ARS — se usa para el
  // chart del período (la serie de puntos se genera en base a este).
  const total = arsTotal + usdTotal * USD_RATE + usdtTotal * USD_RATE;

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

  const series = useMemo(() => {
    // Cuando "considerar movimientos" está apagado, el chart sólo
    // refleja el rendimiento del activo: bajamos la amplitud del
    // delta y usamos otro seed para que la curva sea más smooth /
    // conservadora. Cuando está prendido (default), la curva sube
    // y baja con los flujos de capital — más volátil, refleja la
    // realidad del balance.
    const ampMult = considerCashflow ? 1 : 0.55;
    const seedSuffix = considerCashflow ? "" : "-pure";
    const seed =
      range === "live"
        ? `home-live-${liveTick}${seedSuffix}`
        : `home-${range}${seedSuffix}`;
    return generateSeries(total, rangeChanges[range] * ampMult, seed);
  }, [total, range, liveTick, considerCashflow]);

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

  // En modo live, el % no es constante — oscila por liveTick para
  // simular movimiento real de mercado (a veces sube, a veces baja).
  // El chartColor y el botón Ingresar siguen este pct, así que en
  // ticks "rojos" todo el ecosistema visual se vuelve rojo.
  const livePct = useMemo(() => {
    // Pseudo random walk determinístico: combina dos sinusoides de
    // frecuencias distintas para no ser predecible. Rango ~ ±0.6%.
    return Math.sin(liveTick * 1.7) * 0.45 + Math.sin(liveTick * 0.4) * 0.18;
  }, [liveTick]);
  const rangePct = range === "live" ? livePct : rangeChanges[range];
  const isUp = rangePct >= 0;
  const trendColor = isUp ? c.greenDark : c.red;
  // Color del trazo del chart + timeline: usa el verde-action (mismo
  // que el botón "Ingresar") para que la identidad Alamos se vea más
  // viva en el chart y los rangos. El delta numérico sigue usando
  // c.positive más oscuro porque ahí lee mejor como "subió".
  const chartColor = isUp ? c.action : c.red;

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
                shadowColor: c.action,
                transform: [{ scale: giftPulse }],
              },
            ]}
          >
            <Tap
              style={[s.giftBtn, { backgroundColor: c.action }]}
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
          <Text style={[s.portfolioTitle, { color: c.text }]} numberOfLines={1}>
            Tu portfolio
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
              size={38}
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
                    Tocá para cambiar de moneda
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
              {maskAmount(
                currency === "ARS"
                  ? formatARS(Math.abs(arsDelta))
                  : `US$ ${Math.abs(usdDelta).toLocaleString("es-AR", {
                      maximumFractionDigits: 2,
                    })}`,
                hideAmounts,
              )}
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

          <View style={[s.chartWrap, { marginTop: 18 }]}>
            <Sparkline
              series={series}
              color={chartColor}
              height={300}
              withFill={false}
              sheen
              live={range === "live"}
              referenceLine={referenceLine}
              strokeWidth={1.4}
              smooth={smoothChart}
              onScrub={onScrub}
              onScrubEnd={onScrubEnd}
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
                    setRangeAndSave(r);
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
            {/* Settings icon al final del timeline — gear filled
                que matchea el chartColor (verde si up, rojo si
                down). Abre el sheet con los ajustes del chart. */}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setChartSettingsOpen(true);
              }}
              hitSlop={10}
              style={s.rangeSettingsBtn}
            >
              <GearIcon size={20} color={chartColor} holeColor={c.bg} />
            </Pressable>
          </View>
        </View>

        {/* Divider sutil entre el chart y el resto */}
        <View style={[s.heroDivider, { backgroundColor: c.border }]} />

        <Dinero byCategory={byCategory} />

        <Investments byCategory={byCategory} onOpen={openDetail} />

        <View
          style={[
            s.heroDivider,
            { backgroundColor: c.border, marginTop: 28 },
          ]}
        />
        <View style={[s.sectionBlock, { marginTop: 24 }]}>
          <View style={s.discoverRow}>
            <AlamoMark size={20} color={c.brand} />
            <Text style={[s.discoverTitle, { color: c.text }]}>
              Descubrí{" "}
              <Text
                style={{
                  color: c.greenDark,
                  fontFamily: fontFamily[800],
                }}
              >
                más
              </Text>
            </Text>
          </View>
          <Text style={[s.discoverSub, { color: c.textMuted }]}>
            Productos pensados para vos
          </Text>
        </View>

        <Funds />

        <UsMarket />

        <CryptoMarket />

      </ScrollView>

      {/* Sheet de ajustes del chart — abierto desde el icon de
          settings al final del timeline. */}
      <ChartSettingsSheet
        visible={chartSettingsOpen}
        considerCashflow={considerCashflow}
        onChangeConsiderCashflow={onChangeConsiderCashflow}
        hideAmounts={hideAmounts}
        onChangeHideAmounts={setHideAmounts}
        referenceLine={referenceLine}
        onChangeReferenceLine={onChangeReferenceLine}
        smoothChart={smoothChart}
        onChangeSmoothChart={onChangeSmoothChart}
        onClose={() => setChartSettingsOpen(false)}
      />
    </View>
  );
}

/* ─── Action button: pill estilo Binance con ícono + texto al lado ─── */
function ActionButton({
  icon,
  customIcon,
  label,
  onPress,
  haptic,
  variant,
  accentColor,
}: {
  icon?: AlamosIconName;
  /** Render custom del ícono — si se pasa, override el AlamosIcon
   *  default. Útil para casos puntuales (ej: Convertir usa el mismo
   *  swap-vertical que el ⇅ de cada cuenta de "Tu dinero"). */
  customIcon?: React.ReactNode;
  label: string;
  onPress: () => void;
  haptic: "medium" | "light";
  variant: "primary" | "secondary";
  /** Override del fondo del primary CTA. Se usa para que el botón
   *  "Ingresar" matchee el color del chart (rojo si hay loss, verde
   *  action si hay profit). */
  accentColor?: string;
}) {
  const { c } = useTheme();
  const isPrimary = variant === "primary";
  const bg = isPrimary ? accentColor ?? c.action : c.surfaceHover;
  const fg = isPrimary ? "#FFFFFF" : c.text;
  return (
    <Tap
      style={[s.actionPill, { backgroundColor: bg }]}
      onPress={onPress}
      haptic={haptic}
    >
      {customIcon ?? (
        icon ? <AlamosIcon name={icon} size={17} color={fg} /> : null
      )}
      <Text style={[s.actionPillText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Tap>
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

/* ─── Dinero: 3 acciones + cuentas (ARS, USD MEP, USD USA, USDT) ─── */
function Dinero(_: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
}) {
  const { c } = useTheme();
  const router = useRouter();
  const [infoOpen, setInfoOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertFromId, setConvertFromId] = useState<AccountId | undefined>();

  const openConvertFrom = useCallback((id?: AccountId) => {
    setConvertFromId(id);
    setConvertOpen(true);
  }, []);

  return (
    <View style={s.sectionBlock}>
      {/* 3 acciones: Ingresar (primary) + Enviar + Convertir
          (secondary). Convertir abre el ConvertSheet sin cuenta de
          origen preseleccionada — el usuario elige adentro. */}
      <View style={s.actionsRow}>
        <ActionButton
          icon="download"
          label="Ingresar"
          variant="primary"
          haptic="medium"
          onPress={() =>
            router.push({
              pathname: "/(app)/transfer",
              params: { mode: "deposit" },
            })
          }
        />
        <ActionButton
          icon="upload"
          label="Enviar"
          variant="secondary"
          haptic="light"
          onPress={() =>
            router.push({
              pathname: "/(app)/transfer",
              params: { mode: "send" },
            })
          }
        />
        <ActionButton
          customIcon={
            <Ionicons name="swap-vertical" size={18} color={c.text} />
          }
          label="Convertir"
          variant="secondary"
          haptic="medium"
          onPress={() => openConvertFrom(undefined)}
        />
      </View>

      <View style={s.earningsBlock}>
        <View style={s.earningsHead}>
          <Text style={[s.earningsTitle, { color: c.text }]}>Tu dinero</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setInfoOpen(true)}
            style={[s.infoDot, { backgroundColor: c.surfaceHover }]}
          >
            <Feather name="info" size={12} color={c.textSecondary} />
          </Pressable>
        </View>

        {accounts.map((a, i) => (
          <AccountRow
            key={a.id}
            account={a}
            withTopDivider={i > 0}
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

function AccountRow({
  account,
  withTopDivider,
}: {
  account: Account;
  withTopDivider?: boolean;
}) {
  const { c } = useTheme();
  const { hideAmounts } = usePrivacy();
  // Si la cuenta no es ARS, mostramos su equivalente en pesos como secundario.
  const arsEquiv =
    account.currency === "ARS"
      ? null
      : `≈ ${formatARS(convertAmount(account.balance, account.currency, "ARS"))}`;

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
      <AccountAvatar account={account} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={[s.earningsTicker, { color: c.text }]}>
          {account.currency}
        </Text>
        <Text
          style={[s.earningsName, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {account.location}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.earningsPrimary, { color: c.text }]}>
          {maskAmount(formatAccountBalance(account), hideAmounts)}
        </Text>
        {arsEquiv ? (
          <Text style={[s.earningsSecondary, { color: c.textMuted }]}>
            {maskAmount(arsEquiv, hideAmounts)}
          </Text>
        ) : null}
      </View>
    </View>
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
                    <AccountAvatar account={a} size={36} />
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
                        color={c.positive}
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
                <AccountAvatar account={from} size={36} />
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
                <AccountAvatar account={to} size={36} />
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
            <AlamosLogo variant="mark" tone="green" size={36} />
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

/* ─── Tus inversiones: lista plana de holdings (sin grupos por categoría) ─── */
function Investments({
  byCategory,
  onOpen,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
  onOpen: (a: Asset) => void;
}) {
  const { c } = useTheme();
  const router = useRouter();

  // Aplanamos todos los held no-cash y ordenamos por valor de tenencia
  // (la posición más grande primero), así el orden no depende de la
  // categoría.
  const items = useMemo(() => {
    const all = byCategory
      .filter(([cat]) => cat !== "efectivo")
      .flatMap(([, data]) => data.items);
    return all
      .slice()
      .sort(
        (a, b) =>
          b.price * (b.qty ?? 1) - a.price * (a.qty ?? 1),
      );
  }, [byCategory]);

  return (
    <View style={[s.sectionBlock, { marginTop: 28 }]}>
      <View style={s.earningsBlock}>
        <Pressable
          style={s.earningsHead}
          onPress={() => router.push("/(app)/investments-detail")}
          hitSlop={8}
        >
          <Text style={[s.earningsTitle, { color: c.text }]}>
            Tus inversiones
          </Text>
          <Feather name="chevron-right" size={16} color={c.textFaint} />
        </Pressable>

        {items.length > 0 ? (
          items.map((asset, i) => (
            <AssetRow
              key={asset.ticker}
              asset={asset}
              first={i === 0}
              onPress={() => onOpen(asset)}
            />
          ))
        ) : (
          <Text style={[s.emptyPortfolio, { color: c.textMuted }]}>
            Todavía no tenés inversiones. Entrá a Mercado para empezar.
          </Text>
        )}
      </View>
    </View>
  );
}

/* ─── Invertí en fondos: CTA grid 2x2 con FCIs ─── */
/**
 * Section al final del home que invita a invertir en FCIs (a los
 * argentinos les encanta esto). Cada card muestra:
 *   - Bandera del país de denominación de la moneda (ARS / USD)
 *   - "Termómetro" de riesgo en flames (1-3) según el tipo de FCI
 *   - Yield anual estimado (`annualYield` del asset)
 *   - Nombre del fondo
 * Tap → abre el detalle del activo (mismo flow que tappear desde Mercado).
 */
function Funds() {
  const { c } = useTheme();
  const router = useRouter();
  const [infoOpen, setInfoOpen] = useState(false);

  // Tomamos los primeros 4 FCIs disponibles para no saturar el home —
  // si querés ver más, vas a Mercado.
  const funds = useMemo(
    () => assets.filter((a) => a.category === "fci").slice(0, 4),
    [],
  );

  if (funds.length === 0) return null;

  return (
    <View style={[s.sectionBlock, { marginTop: 28 }]}>
      <View style={s.earningsHead}>
        <Text style={[s.earningsTitle, { color: c.text }]}>
          Invertí en fondos
        </Text>
        <Pressable
          hitSlop={10}
          onPress={() => setInfoOpen(true)}
          style={[s.infoDot, { backgroundColor: c.surfaceHover }]}
        >
          <Feather name="info" size={12} color={c.textSecondary} />
        </Pressable>
      </View>

      <View style={s.fundsGrid}>
        {funds.map((f) => (
          <FundCard
            key={f.ticker}
            asset={f}
            onPress={() =>
              router.push({
                pathname: "/(app)/detail",
                params: { ticker: f.ticker },
              })
            }
          />
        ))}
      </View>

      <FundsInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </View>
  );
}

/* ─── Modal de info para FCIs — disclaimer de rendimientos ─── */
function FundsInfoModal({
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
          <View style={[s.modalIconWrap, { backgroundColor: c.greenDim }]}>
            <AlamosLogo variant="mark" tone="green" size={36} />
          </View>
          <Text style={[s.modalTitle, { color: c.text }]}>
            Sobre el rendimiento estimado
          </Text>
          <Text style={[s.modalBody, { color: c.textSecondary }]}>
            El % anual estimado se calcula en base al rendimiento histórico
            del fondo y es referencial. Los rendimientos pasados no
            garantizan resultados futuros. Cada FCI puede tener distinto
            riesgo, liquidez (T+0 / T+1) y composición. Antes de invertir,
            revisá el reglamento de gestión del fondo en su detalle.
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

/** Determina el nivel de riesgo (1-3) en base al tipo de FCI. */
function fciRiskLevel(asset: Asset): 1 | 2 | 3 {
  const sub = asset.subLabel.toLowerCase();
  if (sub.includes("renta variable")) return 3;
  if (sub.includes("renta fija")) return 2;
  return 1;
}

/** Bandera correspondiente al fondo (todos son AR por ahora pero
 *  preparado para extender cuando se sumen FCIs en USD). */
function fciFlag(asset: Asset): "AR" | "US" {
  return asset.subLabel.toLowerCase().includes("dólar") ? "US" : "AR";
}

/** Mini isotipo Alamos — 2 triángulos como los del logo, en un solo
 *  color. Se usa como indicador de riesgo en lugar de los flames. */
function AlamoMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon
        points="38,26 16,86 60,86"
        stroke={color}
        strokeWidth={11}
        strokeLinejoin="round"
        fill="none"
      />
      <Polygon
        points="56,12 29,86 83,86"
        stroke={color}
        strokeWidth={11}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function FundCard({
  asset,
  onPress,
}: {
  asset: Asset;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const risk = fciRiskLevel(asset);
  const flag = fciFlag(asset);

  return (
    <Pressable
      onPress={onPress}
      style={[
        s.fundCard,
        { backgroundColor: c.surfaceHover, borderColor: c.border },
      ]}
    >
      {/* Bandera + 3 alamitos como termómetro de riesgo, arriba. */}
      <View style={s.fundRiskRow}>
        <FlagIcon code={flag} size={20} />
        <View style={[s.flameSep, { backgroundColor: c.borderStrong }]} />
        <View style={s.flames}>
          {[1, 2, 3].map((i) => (
            <AlamoMark
              key={i}
              size={14}
              color={i <= risk ? c.brand : c.textFaint}
            />
          ))}
        </View>
      </View>

      {/* Yield debajo de los alamitos. */}
      <View style={s.fundYieldRow}>
        <Text
          style={[s.fundYield, { color: c.greenDark }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {asset.annualYield != null
            ? `+${asset.annualYield.toLocaleString("es-AR", {
                maximumFractionDigits: 2,
              })}%`
            : "—"}
        </Text>
        <Text style={[s.fundYieldLabel, { color: c.textMuted }]}>ANUAL</Text>
      </View>

      <Text style={[s.fundName, { color: c.text }]} numberOfLines={1}>
        {asset.name}
      </Text>
    </Pressable>
  );
}

/* ─── Acciones de USA: CTA con horizontal scroll de stocks ─── */
/**
 * Promo del feature de comprar acciones del mercado USA directamente
 * (NYSE/NASDAQ) sin pasar por CEDEAR. Layout distinto al de Funds —
 * horizontal scroll en vez de grid — para que se diferencie visualmente
 * dentro del mismo home.
 *
 * Tap en cualquier stock → detail flow del ticker (mock: usa el mismo
 * detail que el CEDEAR equivalente; cuando conectemos backend real,
 * pasaríamos `?market=us` para diferenciar la cotización).
 */

interface UsStock {
  ticker: string;
  name: string;
  /** Precio en USD (sin conversión local). */
  priceUsd: number;
  /** Variación del día en %. */
  change: number;
}

const US_STOCKS: UsStock[] = [
  { ticker: "NVDA", name: "NVIDIA", priceUsd: 142.83, change: 3.42 },
  { ticker: "AAPL", name: "Apple", priceUsd: 201.0, change: 2.4 },
  { ticker: "TSLA", name: "Tesla", priceUsd: 240.5, change: -2.17 },
  { ticker: "MSFT", name: "Microsoft", priceUsd: 415.3, change: 0.43 },
  { ticker: "GOOGL", name: "Alphabet", priceUsd: 163.75, change: 1.14 },
  { ticker: "META", name: "Meta", priceUsd: 510.2, change: 0.91 },
  { ticker: "AMZN", name: "Amazon", priceUsd: 237.25, change: 1.52 },
];

function UsMarket() {
  const { c } = useTheme();
  const router = useRouter();
  const [infoOpen, setInfoOpen] = useState(false);
  const usStory = useGateStory(US_MARKET_STORY);

  return (
    <View style={{ marginTop: 28 }}>
      <View style={[s.sectionBlock, { marginTop: 0 }]}>
        <View style={s.earningsHead}>
          <Text style={[s.earningsTitle, { color: c.text }]}>
            Invertí en el mercado extranjero
          </Text>
          <Pressable
            hitSlop={10}
            onPress={() => setInfoOpen(true)}
            style={[s.infoDot, { backgroundColor: c.surfaceHover }]}
          >
            <Feather name="info" size={12} color={c.textSecondary} />
          </Pressable>
        </View>
        <Text style={[s.usSubtitle, { color: c.textMuted }]}>
          Operá en NYSE y NASDAQ directo desde Álamos, sin intervención
          local ni CEDEARs.{" "}
          <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
            El mercado más grande del mundo, en tu bolsillo.
          </Text>
        </Text>
      </View>

      <AutoMarquee
        speed={28}
        style={s.marqueeWrap}
        contentStyle={s.marqueeContent}
      >
        {US_STOCKS.map((stock) => (
          <UsStockCard
            key={stock.ticker}
            stock={stock}
            onPress={() =>
              usStory.gate(() =>
                router.push({
                  pathname: "/(app)/detail",
                  params: { ticker: stock.ticker },
                }),
              )
            }
          />
        ))}
      </AutoMarquee>

      <UsMarketInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
      <StoryOverlay
        visible={usStory.open}
        story={US_MARKET_STORY}
        onClose={usStory.close}
      />
    </View>
  );
}

function UsStockCard({
  stock,
  onPress,
}: {
  stock: UsStock;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const up = stock.change >= 0;
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.usCard,
        { backgroundColor: c.surfaceHover, borderColor: c.border },
      ]}
    >
      <View style={s.usCardTop}>
        <View style={[s.usCardIcon, { backgroundColor: c.ink }]}>
          <Text style={[s.usCardIconText, { color: c.bg }]}>
            {stock.ticker.slice(0, 2)}
          </Text>
        </View>
        <FlagIcon code="US" size={18} />
      </View>

      <View>
        <Text style={[s.usCardTicker, { color: c.text }]}>{stock.ticker}</Text>
        <Text
          style={[s.usCardName, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {stock.name}
        </Text>
      </View>

      <View style={s.usCardChart}>
        <MiniSparkline
          series={seriesFromSeed(stock.ticker, 28, up ? "up" : "down")}
          color={up ? c.greenDark : c.red}
        />
      </View>

      <View>
        <Text style={[s.usCardPrice, { color: c.text }]}>
          US${" "}
          {stock.priceUsd.toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <Text
          style={[s.usCardChange, { color: up ? c.greenDark : c.red }]}
        >
          {up ? "+" : ""}
          {stock.change.toFixed(2)}%
        </Text>
      </View>
    </Pressable>
  );
}

function UsMarketInfoModal({
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
          <View style={[s.modalIconWrap, { backgroundColor: c.greenDim }]}>
            <FlagIcon code="US" size={42} />
          </View>
          <Text style={[s.modalTitle, { color: c.text }]}>
            Acciones del mercado USA
          </Text>
          <Text style={[s.modalBody, { color: c.textSecondary }]}>
            Acceso directo al NYSE y NASDAQ. Comprás la acción real en
            dólares, sin pasar por CEDEARs ni tipo de cambio implícito.
            Disponible para usuarios con cuenta en USD habilitada en
            Álamos. Liquidez T+1 y comisiones más bajas que la operación
            local.
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

/* ─── Invertí en crypto: CTA con horizontal scroll de cryptos ─── */
/**
 * Tercer call-to-action en el home — promo de operar crypto. Comparte
 * el mismo layout que UsMarket (horizontal scroll de cards) pero los
 * íconos usan los brand colors de cada moneda para diferenciarlo.
 */

interface FeaturedCrypto {
  ticker: string;
  /** Ticker que el detail screen entiende (con par /USDT). */
  detailTicker: string;
  name: string;
  priceUsd: number;
  change: number;
  bg: string;
  fg: string;
  iconText?: string;
}

const FEATURED_CRYPTOS: FeaturedCrypto[] = [
  {
    ticker: "BTC",
    detailTicker: "BTC/USDT",
    name: "Bitcoin",
    priceUsd: 67432.5,
    change: 1.24,
    bg: "#F7931A",
    fg: "#FFFFFF",
    iconText: "₿",
  },
  {
    ticker: "ETH",
    detailTicker: "ETH/USDT",
    name: "Ethereum",
    priceUsd: 3284.15,
    change: -0.91,
    bg: "#627EEA",
    fg: "#FFFFFF",
  },
  {
    ticker: "SOL",
    detailTicker: "SOL/USDT",
    name: "Solana",
    priceUsd: 142.82,
    change: 3.22,
    bg: "#14F195",
    fg: "#0E0F0C",
  },
  {
    ticker: "USDT",
    detailTicker: "BTC/USDT",
    name: "Tether",
    priceUsd: 1.0,
    change: 0.01,
    bg: "#26A17B",
    fg: "#FFFFFF",
    iconText: "₮",
  },
  {
    ticker: "BNB",
    detailTicker: "BNB/USDT",
    name: "BNB",
    priceUsd: 584.3,
    change: 0.74,
    bg: "#F0B90B",
    fg: "#0E0F0C",
  },
  {
    ticker: "ADA",
    detailTicker: "ADA/USDT",
    name: "Cardano",
    priceUsd: 0.45,
    change: 1.87,
    bg: "#0033AD",
    fg: "#FFFFFF",
  },
];

function CryptoMarket() {
  const { c } = useTheme();
  const router = useRouter();
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <View style={{ marginTop: 28 }}>
      <View style={[s.sectionBlock, { marginTop: 0 }]}>
        <View style={s.earningsHead}>
          <Text style={[s.earningsTitle, { color: c.text }]}>
            Invertí en crypto
          </Text>
          <Pressable
            hitSlop={10}
            onPress={() => setInfoOpen(true)}
            style={[s.infoDot, { backgroundColor: c.surfaceHover }]}
          >
            <Feather name="info" size={12} color={c.textSecondary} />
          </Pressable>
        </View>
        <Text style={[s.usSubtitle, { color: c.textMuted }]}>
          Bitcoin, Ethereum, Solana y +200 cryptos. Operá 24/7, sin
          horarios de mercado.{" "}
          <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
            El mercado que nunca duerme.
          </Text>
        </Text>
      </View>

      <AutoMarquee
        speed={28}
        style={s.marqueeWrap}
        contentStyle={s.marqueeContent}
      >
        {FEATURED_CRYPTOS.map((crypto) => (
          <CryptoFeatureCard
            key={crypto.ticker}
            crypto={crypto}
            onPress={() =>
              router.push({
                pathname: "/(app)/detail",
                params: { ticker: crypto.detailTicker },
              })
            }
          />
        ))}
      </AutoMarquee>

      <CryptoMarketInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </View>
  );
}

function CryptoFeatureCard({
  crypto,
  onPress,
}: {
  crypto: FeaturedCrypto;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const up = crypto.change >= 0;
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.usCard,
        { backgroundColor: c.surfaceHover, borderColor: c.border },
      ]}
    >
      <View style={s.usCardTop}>
        <CryptoIcon
          ticker={crypto.ticker}
          bg={crypto.bg}
          fg={crypto.fg}
          iconText={crypto.iconText}
          size={32}
        />
        <Feather name="zap" size={12} color={c.textMuted} />
      </View>

      <View>
        <Text style={[s.usCardTicker, { color: c.text }]}>
          {crypto.ticker}
        </Text>
        <Text
          style={[s.usCardName, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {crypto.name}
        </Text>
      </View>

      <View style={s.usCardChart}>
        <MiniSparkline
          series={seriesFromSeed(crypto.ticker, 28, up ? "up" : "down")}
          color={up ? c.greenDark : c.red}
        />
      </View>

      <View>
        <Text style={[s.usCardPrice, { color: c.text }]}>
          US${" "}
          {crypto.priceUsd.toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
        <Text style={[s.usCardChange, { color: up ? c.greenDark : c.red }]}>
          {up ? "+" : ""}
          {crypto.change.toFixed(2)}%
        </Text>
      </View>
    </Pressable>
  );
}

function CryptoMarketInfoModal({
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
          <View style={[s.modalIconWrap, { backgroundColor: c.greenDim }]}>
            <CryptoIcon ticker="₿" iconText="₿" bg="#F7931A" fg="#FFFFFF" size={42} />
          </View>
          <Text style={[s.modalTitle, { color: c.text }]}>
            Crypto en Álamos
          </Text>
          <Text style={[s.modalBody, { color: c.textSecondary }]}>
            Operá Bitcoin, Ethereum, Solana, USDT, USDC y +200 monedas
            digitales. Mercado abierto 24/7, sin horarios de cierre.
            Liquidez instantánea, custodia institucional y rendimientos
            nativos en stablecoins. Crypto sin complicaciones.
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

  const cur = assetCurrency(asset);
  const primaryValue = isCash
    ? isUSD
      ? `US$ ${qty.toLocaleString("es-AR")}`
      : formatARS(qty)
    : formatMoney(asset.price * (asset.qty ?? 1), cur);
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
            : `${asset.qty} ${asset.qty === 1 ? "unidad" : "unidades"} · ${formatMoney(asset.price, cur)}`}
        </Text>
      </View>
      {!isCash ? (
        <View style={s.rowChart}>
          <MiniSparkline
            series={seriesFromSeed(
              asset.ticker,
              28,
              asset.change >= 0 ? "up" : "down",
            )}
            color={asset.change >= 0 ? c.greenDark : c.red}
          />
        </View>
      ) : null}
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
  /* Secciones editoriales (Dinero / Inversiones) */
  sectionBlock: {
    marginTop: 8,
    paddingHorizontal: 20,
  },

  /* Acciones de Dinero (Ingresar / Enviar / Convertir / Invertir):
     pills estilo Binance con ícono + texto. Ingresar es primario
     (BRAND_GREEN), el resto secundario (surfaceHover). */
  actionsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    marginBottom: 24,
  },
  actionPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    /* Misma altura que el pill activo del nav bar inferior (ver
     * (tabs)/_layout.tsx — ISLAND_HEIGHT 64 con padding 6 interno).
     * Antes 52 — los botones se sentían muy altos vs la jerarquía
     * del nav. */
    height: 44,
    borderRadius: radius.btn,
    paddingHorizontal: 4,
  },
  actionPillText: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  /* Header "Descubrí más" antes de las CTAs — sazón Alamos:
     isotipo verde + acento en "más". */
  discoverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  discoverTitle: {
    fontFamily: fontFamily[700],
    fontSize: 24,
    letterSpacing: -0.7,
  },
  discoverSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 4,
  },
  /* Invertí en fondos: grid 2x2. */
  fundsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  fundCard: {
    flexBasis: "48%",
    flexGrow: 1,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 14,
  },
  fundYieldRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  fundYield: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  fundYieldLabel: {
    fontFamily: fontFamily[800],
    fontSize: 11,
    letterSpacing: 0.6,
  },
  fundRiskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flameSep: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    marginHorizontal: 2,
  },
  flames: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  fundName: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  /* Acciones de USA: subtítulo + horizontal scroll de cards. */
  usSubtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    marginBottom: 14,
  },
  marqueeWrap: {
    marginHorizontal: 20,
  },
  marqueeContent: {
    gap: 10,
    paddingRight: 10,
  },
  usCard: {
    width: 150,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 10,
  },
  usCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  usCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  usCardIconText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.2,
  },
  usCardTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  usCardName: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  usCardChart: {
    height: 26,
  },
  usCardPrice: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.2,
  },
  usCardChange: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 2,
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
  earningsTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
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

  emptyPortfolio: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: 24,
  },
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 12,
  },
  portfolioTitle: {
    fontFamily: fontFamily[700],
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.6,
    marginBottom: 4,
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
    /* radius.md (12) en vez de radius.pill (999) — menos cápsula,
     * más editorial. Las pills 100% redondeadas se sentían genéricas. */
    borderRadius: radius.md,
  },
  rangeSettingsBtn: {
    /* Mismos paddings que rangePill para que el gear se alinee al
     * baseline de los textos del timeline. */
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  rowChart: {
    width: 56,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 15,
    letterSpacing: -0.25,
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
});
