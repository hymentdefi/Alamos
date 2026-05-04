import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
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
import {
  AlamosIcon,
  type AlamosIconName,
} from "../../../lib/components/AlamosIcon";
import {
  ActionIcon,
  type ActionIconName,
} from "../../../lib/components/ActionIcon";
import { ChartSettingsSheet } from "../../../lib/components/ChartSettingsSheet";
import { EarningsInfoSheet } from "../../../lib/components/EarningsInfoSheet";
import { GearIcon } from "../../../lib/components/GearIcon";
import { usePrivacy, maskAmount } from "../../../lib/privacy/context";
import { useNotifications } from "../../../lib/notifications/context";
import { TopRightIcon } from "../../../lib/components/TopRightIcon";

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
  return <BaseHome />;
}

function BaseHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode } = useTheme();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { hideAmounts, set: setHideAmounts } = usePrivacy();
  const { hasUnread } = useNotifications();
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

  /* Pager horizontal del balance — el swipe entre ARS y USD se hace
   * con un ScrollView nested. Esto resuelve dos cosas a la vez:
   *  (1) RN/iOS le dan prioridad de gesture al scroll horizontal
   *      interno, así que ningún paneo lateral filtra al ScrollView
   *      vertical (no más triggers accidentales del pull-to-refresh).
   *  (2) La transición es la animación nativa de paging-scroll, que
   *      es exactamente el "deslizamiento lento" que pidió Santi.
   */
  const balancePagerRef = useRef<ScrollView | null>(null);
  const balancePageW = Dimensions.get("window").width;
  /* Cuando el usuario tappea uno de los dots, scrolleamos a la página
   * correspondiente. El cambio de `currency` se sincroniza en
   * onMomentumScrollEnd, así que no hace falta llamar setCurrency
   * acá — el momentum se encarga. */
  const goToCurrency = useCallback(
    (c: "ARS" | "USD") => {
      const idx = c === "ARS" ? 0 : 1;
      balancePagerRef.current?.scrollTo({
        x: idx * balancePageW,
        animated: true,
      });
    },
    [balancePageW],
  );
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
            style={{ transform: [{ scale: giftPulse }] }}
          >
            <Tap
              style={s.topIconBtn}
              onPress={() =>
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                ).catch(() => {})
              }
              hitSlop={8}
              haptic="medium"
            >
              <TopRightIcon name="sorpresa" size={40} />
            </Tap>
          </Animated.View>
          <Tap
            style={s.topIconBtn}
            onPress={() => router.push("/(app)/activity")}
            hitSlop={8}
            haptic="selection"
          >
            <TopRightIcon
              name={hasUnread ? "notificacion-dot" : "notificacion"}
              size={40}
            />
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
          {/* Pager horizontal del balance — 2 páginas (ARS/USD), cada
              una al ancho completo del celular. El swipe usa
              paging-scroll nativo: animación de desplazamiento smooth
              y, lo más importante, RN da prioridad de gesture al
              scroll horizontal interno → ya no se cuela el dy al
              ScrollView vertical (sin más triggers accidentales del
              pull-to-refresh). */}
          <View style={s.balancePagerWrap}>
            <ScrollView
              ref={balancePagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="normal"
              directionalLockEnabled
              alwaysBounceVertical={false}
              bounces={false}
              contentOffset={{
                x: currency === "ARS" ? 0 : balancePageW,
                y: 0,
              }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(
                  e.nativeEvent.contentOffset.x / balancePageW,
                );
                const next: "ARS" | "USD" = idx === 0 ? "ARS" : "USD";
                if (next !== currency) {
                  Haptics.selectionAsync().catch(() => {});
                  setCurrency(next);
                }
              }}
            >
              {(["ARS", "USD"] as const).map((cur) => (
                <View
                  key={cur}
                  style={[s.balancePage, { width: balancePageW }]}
                >
                  <View style={s.flagWrap} pointerEvents="none">
                    <FlagIcon code={cur === "ARS" ? "AR" : "US"} size={26} />
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
                    value={cur === "ARS" ? arsCurrent : usdCurrent}
                    size={40}
                    weight={800}
                    currency={cur}
                  />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Indicador de moneda — dos dots abajo del saldo.
              El activo es texto-color, el inactivo es muted. Cada
              dot es tappable para saltar directo a esa moneda
              (además del tap/swipe sobre el monto que togglea). */}
          <View style={s.currencyDots}>
            <Pressable hitSlop={10} onPress={() => goToCurrency("ARS")}>
              <View
                style={[
                  s.currencyDot,
                  {
                    backgroundColor:
                      currency === "ARS" ? c.text : c.textFaint,
                    width: currency === "ARS" ? 8 : 6,
                    height: currency === "ARS" ? 8 : 6,
                  },
                ]}
              />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => goToCurrency("USD")}>
              <View
                style={[
                  s.currencyDot,
                  {
                    backgroundColor:
                      currency === "USD" ? c.text : c.textFaint,
                    width: currency === "USD" ? 8 : 6,
                    height: currency === "USD" ? 8 : 6,
                  },
                ]}
              />
            </Pressable>
          </View>

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
  iconName,
  label,
  onPress,
  haptic,
}: {
  iconName: ActionIconName;
  label: string;
  onPress: () => void;
  haptic: "medium" | "light";
}) {
  const { c } = useTheme();
  return (
    <Tap
      style={s.actionItem}
      onPress={onPress}
      haptic={haptic}
      pressScale={0.94}
    >
      {/* El ActionIcon YA es un squircle con fill brand verde y stroke
          blanco — no necesita un wrapper de surface adicional como
          tenía antes (la opcion 'glass' Revolut). El icono mismo
          es el bloque visual. */}
      <ActionIcon name={iconName} size={58} />
      <Text style={[s.actionLabel, { color: c.textMuted }]} numberOfLines={1}>
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

  // Cuentas sin saldo van al final del listado (greyed con CTA + para
  // ingresar). Las que tienen saldo mantienen su orden original.
  const sortedAccounts = useMemo(
    () =>
      [...accounts].sort((a, b) => {
        const aZero = a.balance <= 0;
        const bZero = b.balance <= 0;
        if (aZero === bZero) return 0;
        return aZero ? 1 : -1;
      }),
    [],
  );

  return (
    <View style={s.sectionBlock}>
      {/* Acciones del home — squircle icons custom (Ingresar/Enviar/
          Convertir) con verde brand y stroke blanco. El icono YA es
          la surface; sin wrapper circular como en la versión
          'Revolut glass' previa. */}
      <View style={s.actionsRow}>
        <ActionButton
          iconName="ingresar"
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
          iconName="enviar"
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
          iconName="convertir"
          label="Convertir"
          haptic="medium"
          onPress={() => router.push("/(app)/convert")}
        />
      </View>

      <View style={s.earningsHead}>
        <Text style={[s.earningsTitle, { color: c.textMuted }]}>Tu dinero</Text>
        <Pressable
          hitSlop={10}
          onPress={() => setInfoOpen(true)}
          style={[s.infoDot, { backgroundColor: c.surfaceHover }]}
        >
          <Feather name="info" size={12} color={c.textSecondary} />
        </Pressable>
      </View>

      <GlassCard padding={4}>
        {sortedAccounts.map((a, i) => (
          <AccountRow
            key={a.id}
            account={a}
            withTopDivider={i > 0}
          />
        ))}
      </GlassCard>

      <EarningsInfoSheet
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
  const router = useRouter();
  const { hideAmounts } = usePrivacy();
  const isEmpty = account.balance <= 0;
  // Backing del badge AR (en flag usd-ar) — en light mode el beige
  // del bg cálido; en dark, un gris muy oscuro tirando al surface
  // del card glass para que el badge se sienta integrado.
  const badgeBacking = mode === "dark" ? "#1F1F1E" : "#FAFAF7";
  // Si la cuenta no es ARS, mostramos su equivalente en pesos como
  // secundario. No aplica en empty state.
  const arsEquiv =
    isEmpty || account.currency === "ARS"
      ? null
      : `≈ ${formatARS(convertAmount(account.balance, account.currency, "ARS"))}`;

  // Tap del botón "+" — mismo path que tappear Ingresar y elegir esa
  // moneda en el hub. Crypto va a su screen dedicado (asset + red
  // picker). Fiat va al detalle de la moneda elegida.
  const onAdd = () => {
    Haptics.selectionAsync().catch(() => {});
    if (account.id === "usdt-crypto") {
      router.push("/(app)/crypto-deposit");
    } else {
      router.push({
        pathname: "/(app)/transfer-deposit",
        params: { currency: account.id },
      });
    }
  };

  return (
    <View
      style={[
        s.earningsRow,
        withTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
        isEmpty && { opacity: 0.55 },
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
      {isEmpty ? (
        <Pressable
          onPress={onAdd}
          hitSlop={8}
          style={[
            s.addBalanceBtn,
            { backgroundColor: c.surfaceHover, borderColor: c.brand },
          ]}
        >
          <Feather name="plus" size={20} color={c.brand} />
        </Pressable>
      ) : (
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
      )}
    </View>
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
        onPress={() => router.navigate("/(app)/portfolio")}
        hitSlop={8}
      >
        <Text style={[s.earningsTitle, { color: c.textMuted }]}>
          Tus inversiones
        </Text>
        <Ionicons
          name="arrow-forward-sharp"
          size={14}
          color="rgba(0,200,5,0.45)"
        />
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
  /* Pill que envuelve el TopRightIcon — el ícono ya trae su propio
     fondo (tint verde), así que el botón solo aporta hit area. */
  topIconBtn: {
    width: 40,
    height: 40,
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
    /* Negativo del paddingHorizontal del heroBlock (24) — el chart
     * rompe los rails y se extiende de borde a borde de la pantalla.
     * El range row de abajo conserva el padding y queda alineado
     * con el resto del hero. */
    marginHorizontal: -24,
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
  actionLabel: {
    // 600 (no 700) a propósito: las labels chiquitas debajo de
    // iconos circulares se ven cramped en bold. La jerarquía de
    // 'premium' viene del contraste display/body, no de bolduear
    // todo. Brubank usa medium-bold en sus labels de acción.
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.2,
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
    fontFamily: fontFamily[800],
    fontSize: 21,
    letterSpacing: -0.7,
    lineHeight: 24,
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
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.4,
  },
  earningsName: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  earningsPrimary: {
    fontFamily: fontFamily[800],
    fontSize: 17,
    letterSpacing: -0.4,
  },
  earningsSecondary: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  /* Botón "+" cuando la cuenta no tiene saldo — invita a ingresar
     plata en esa moneda. Square pill con border sutil; el row
     completo va greado vía opacity. */
  addBalanceBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    fontFamily: fontFamily[800],
    fontSize: 38,
    lineHeight: 40,
    // Letter-spacing brutal — los displays bold de Brubank
    // condensan los caracteres mucho más de lo que parece. Este
    // -2.2 da el feel "headline editorial confident".
    letterSpacing: -2.2,
    marginBottom: 6,
  },
  /* Pager del balance — el wrap rompe el padding del heroBlock con
   * marginHorizontal: -24 para que cada página sea full screen (más
   * área de swipe + transición visualmente más lenta). El padding
   * vuelve a aparecer dentro de cada página. */
  balancePagerWrap: {
    marginHorizontal: -24,
    marginBottom: 8,
  },
  balancePage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
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
  /* Indicador de moneda — dos dots horizontales abajo del saldo.
     El activo es full-color y un toque más grande (8px) que el
     inactivo (6px), para que la jerarquía sea clara aunque la
     diferencia sea sutil. Tap directo a cualquiera salta a esa
     moneda. */
  currencyDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
    paddingVertical: 4,
  },
  currencyDot: {
    borderRadius: 999,
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
    fontFamily: fontFamily[800],
    fontSize: 12,
  },
  deltaText: {
    fontFamily: fontFamily[700],
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
