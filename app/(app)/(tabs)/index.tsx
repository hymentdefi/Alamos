import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  PanResponder,
  RefreshControl,
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Tap } from "../../../lib/components/Tap";
import { GlassCard } from "../../../lib/components/GlassCard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
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
  formatUSD,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../../lib/data/assets";
import {
  accounts,
  convertAmount,
  formatAccountBalance,
  type Account,
} from "../../../lib/data/accounts";
import {
  MiniSparkline,
  Sparkline,
  seriesFromSeed,
} from "../../../lib/components/Sparkline";
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { MoneyIcon } from "../../../lib/components/MoneyIcon";
import { FlagIcon } from "../../../lib/components/FlagIcon";
import { AccountFlag } from "../../../lib/components/AccountFlag";
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
  const { c, mode } = useTheme();
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
  // El chartColor sigue este pct, así que en ticks "rojos" la línea
  // y el delta del hero se vuelven rojos en tiempo real.
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

  const isDark = mode === "dark";
  // Backdrop sutil estilo Revolut — warm top, neutral mid, cool
  // bottom (light); o leve elevación negro→puro (dark). Las cards
  // glass de abajo se apoyan sobre este gradient para que la
  // sensación sea "vidrio sobre superficie tintada", no "cuadrado
  // blanco sobre fondo blanco".
  const bgGradient: readonly [string, string, string] = isDark
    ? ["#0E0E0C", "#080808", "#000000"]
    : ["#FFFFFF", "#FFFFFF", "#FFFFFF"];

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <LinearGradient
        pointerEvents="none"
        colors={bgGradient}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
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
            style={[
              s.topBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.78)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(14,15,12,0.06)",
                borderWidth: StyleSheet.hairlineWidth,
              },
            ]}
            onPress={() => router.push("/(app)/activity")}
            hitSlop={8}
            haptic="selection"
          >
            <Ionicons name="notifications" size={20} color={c.text} />
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
              currency={currency}
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
                  : formatUSD(Math.abs(usdDelta)),
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

        <Dinero byCategory={byCategory} />

        <Investments byCategory={byCategory} onOpen={openDetail} />

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

/* ─── Action button: círculo glass con label debajo (estilo Revolut) ─── */
function ActionButton({
  icon,
  customIcon,
  label,
  onPress,
  haptic,
}: {
  icon?: AlamosIconName;
  /** Render custom del ícono — si se pasa, override el AlamosIcon
   *  default. Útil para casos puntuales (ej: Convertir usa el mismo
   *  swap-vertical que el ⇅ de cada cuenta de "Tu dinero"). */
  customIcon?: React.ReactNode;
  label: string;
  onPress: () => void;
  haptic: "medium" | "light";
}) {
  const { c, mode } = useTheme();
  const isDark = mode === "dark";
  // Surface uniforme — todos los botones se ven iguales; jerarquía
  // por orden y label, no por color (estilo Revolut). Translúcido
  // para acompañar el lenguaje glass del resto del home.
  const bg = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.78)";
  const borderColor = isDark
    ? "rgba(255,255,255,0.10)"
    : "rgba(14,15,12,0.06)";
  return (
    <Tap
      style={s.actionItem}
      onPress={onPress}
      haptic={haptic}
      pressScale={0.94}
    >
      <View
        style={[
          s.actionCircle,
          {
            backgroundColor: bg,
            borderColor,
            borderWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        {customIcon ?? (
          icon ? <AlamosIcon name={icon} size={22} color={c.text} /> : null
        )}
      </View>
      <Text style={[s.actionLabel, { color: c.text }]} numberOfLines={1}>
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

  return (
    <View style={s.sectionBlock}>
      {/* Acciones del home — estilo Revolut: círculos verticales
          glass, todos del mismo peso visual. La jerarquía la da el
          orden, no el color. */}
      <View style={s.actionsRow}>
        <ActionButton
          icon="download"
          label="Ingresar"
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
            <Ionicons name="swap-vertical" size={22} color={c.text} />
          }
          label="Convertir"
          haptic="medium"
          onPress={() => router.push("/(app)/convert")}
        />
      </View>

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

      <GlassCard padding={4}>
        {accounts.map((a, i) => (
          <AccountRow
            key={a.id}
            account={a}
            withTopDivider={i > 0}
          />
        ))}
      </GlassCard>

      <EarningsInfoModal
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
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
  const { c, mode } = useTheme();
  const { hideAmounts } = usePrivacy();
  // Backing del badge AR (en flag usd-ar) — en light mode el beige
  // del bg cálido; en dark, un gris muy oscuro tirando al surface
  // del card glass para que el badge se sienta integrado.
  const badgeBacking = mode === "dark" ? "#1F1F1E" : "#FAFAF7";
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
      <AccountFlag
        accountId={account.id}
        size={40}
        badgeBackingColor={badgeBacking}
      />
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

      <GlassCard padding={items.length > 0 ? 4 : 16}>
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
      </GlassCard>
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

  const cur = assetCurrency(asset);
  const primaryValue = isCash
    ? isUSD
      ? `${qty.toLocaleString("es-AR")} US$`
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

  /* Acciones del home — estilo Revolut: círculo glass arriba con
     label sans abajo. Todos los items pesan visualmente lo mismo. */
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 18,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  actionItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
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
    paddingHorizontal: 12,
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
  convertBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  convertSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
    paddingHorizontal: 12,
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
