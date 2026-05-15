import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { registerTabTap } from "../../../lib/tabs/activeTap";
import { Tap } from "../../../lib/components/Tap";
import { AlamosRefreshControl } from "../../../lib/components/AlamosRefreshControl";
import { ConvertCurrencyButton } from "../../../lib/components/ConvertCurrencyButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
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
import { CurrencySheet } from "../../../lib/components/CurrencySheet";
import { MoneyIcon } from "../../../lib/components/MoneyIcon";
import { AccountFlag } from "../../../lib/components/AccountFlag";
import { AlamosAvatar } from "../../../lib/components/AlamosAvatar";
import { useAuth } from "../../../lib/auth/context";
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
import { CategoryGlyph } from "../../../lib/components/CategoryGlyph";
import {
  categorizeAsset,
  findCategoryBySlug,
} from "../../../lib/data/marketCategories";
import { GearIcon } from "../../../lib/components/GearIcon";
import { usePrivacy, maskAmount } from "../../../lib/privacy/context";
import { useNotifications } from "../../../lib/notifications/context";
import { TopRightIcon } from "../../../lib/components/TopRightIcon";

type Range = "1D" | "7D" | "1M" | "3M" | "1A" | "MAX";

/** Tipo de cambio ARS/USD mock. En producción vendría de la API. */
const USD_RATE = 1200;

const ranges: Range[] = ["1D", "7D", "1M", "3M", "1A", "MAX"];

/** Variación % por rango — determina el trend y color del chart. */
const rangeChanges: Record<Range, number> = {
  "1D": 1.96,
  "7D": 3.24,
  "1M": -2.1,
  "3M": 8.45,
  "1A": 22.8,
  MAX: 64.2,
};

export default function HomeScreen() {
  return <BaseHome />;
}

function BaseHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode } = useTheme();
  const refreshTint = mode === "dark" ? "#FFFFFF" : c.textMuted;
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "A";
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
  /* Sheet "Cómo ver tu portfolio" — mismo mecanismo que el portfolio
   * tab: tap en el pill ARS/USD abre el sheet, el user elige y la
   * preferencia se aplica al balance del hero. Sin swipe horizontal. */
  const [currencyOpen, setCurrencyOpen] = useState(false);
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
  /* Línea de referencia y suavizado del trazo: SIEMPRE prendidos.
   * Decisión de producto — no le damos al usuario la opción de
   * editarlos. La línea horizontal del inicio del periodo es parte
   * de la lectura del chart (te dice si estás arriba o abajo del
   * punto de partida) y el smooth bezier es como Álamos quiere que
   * se vea su data, no jagged. */

  // Carga inicial de las preferencias persistidas.
  useEffect(() => {
    SecureStore.getItemAsync("home:chart_consider_cashflow")
      .then((v) => {
        if (v === "0") setConsiderCashflow(false);
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

  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      setRefreshing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }, 900);
  }, []);
  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = e.nativeEvent.contentOffset.y;
    },
    [],
  );

  // Tap sobre la tab Inicio estando en Inicio:
  //   · si no estoy arriba → scroll al tope
  //   · si ya estoy arriba → disparar refresh
  // Vía registerTabTap → FloatingTabBar despacha cuando detecta
  // tap sobre la tab activa. (navigation.addListener('tabPress') no
  // dispara con el tabBar custom, por eso usamos el registry.)
  useEffect(() => {
    return registerTabTap("index", {
      isAtTop: () => scrollYRef.current <= 8,
      scrollToTop: () =>
        scrollRef.current?.scrollTo({ y: 0, animated: true }),
      refresh: () => {
        if (!refreshing) onRefresh();
      },
    });
  }, [refreshing, onRefresh]);

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

  const series = useMemo(() => {
    // Cuando "considerar movimientos" está apagado, el chart sólo
    // refleja el rendimiento del activo: bajamos la amplitud del
    // delta y usamos otro seed para que la curva sea más smooth /
    // conservadora. Cuando está prendido (default), la curva sube
    // y baja con los flujos de capital — más volátil, refleja la
    // realidad del balance.
    const ampMult = considerCashflow ? 1 : 0.55;
    const seedSuffix = considerCashflow ? "" : "-pure";
    const seed = `home-${range}${seedSuffix}`;
    return generateSeries(total, rangeChanges[range] * ampMult, seed);
  }, [total, range, considerCashflow]);


  const rangePct = rangeChanges[range];
  const isUp = rangePct >= 0;
  const trendColor = isUp ? c.brand : c.red;
  // Color del trazo del chart + timeline: usa el verde-action (mismo
  // que el botón "Ingresar") para que la identidad Alamos se vea más
  // viva en el chart y los rangos. El delta numérico sigue usando
  // c.brand más oscuro porque ahí lee mejor como "subió".
  const chartColor = isUp ? c.brand : c.red;
  /* Color específico para la LÍNEA del Sparkline — usa
   * c.dataGreen, que en dark mode resuelve al #5AC53A más
   * suave (no machaca el ojo cuando mirás el chart fijo).
   * En light queda igual al brand. Mismo patrón que detail.tsx. */
  const sparklineColor = isUp ? c.dataGreen : c.red;

  const current = scrubIndex != null ? series[scrubIndex] : series[series.length - 1];
  const rangeStart = series[0];
  const displayDelta = current - rangeStart;
  const displayPct = (displayDelta / rangeStart) * 100;
  const displayIsUp = displayDelta >= 0;
  // Valores 'vigentes' por moneda — durante el scrub, cada portfolio
  // Unified converted balance & delta — mismo modelo que el portfolio
  // tab. `current` y `displayDelta` están siempre en ARS (es el chart
  // base); convertAmount los pasa a USD cuando el user selecciona esa
  // moneda en el CurrencySheet.
  const balanceDisplay =
    currency === "ARS" ? current : convertAmount(current, "ARS", "USD");
  const deltaDisplay =
    currency === "ARS"
      ? displayDelta
      : convertAmount(displayDelta, "ARS", "USD");

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


  const isDark = mode === "dark";
  // Layout estilo Lemon: bg gris claro (#F0F0F0) que contrasta con
  // un card blanco grande conteniendo todo el contenido del home.
  // En dark el bg es OLED negro y el card se eleva sobre eso. La
  // jerarquía siempre es card > bg (card lifted, bg drop).
  const outerBg = isDark ? "#000000" : "#F0F0F0";
  const cardBg = isDark ? "#0F0F0F" : "#FFFFFF";

  return (
    <View style={[s.root, { backgroundColor: outerBg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 2 }]}>
        {/* Avatar del user — tap abre /alamo (perfil + settings). */}
        <Tap
          style={s.avatarBtn}
          onPress={() => router.push("/(app)/alamo")}
          hitSlop={8}
          haptic="selection"
        >
          <AlamosAvatar size={36} initial={firstName} />
        </Tap>
        <View style={s.topActions}>
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
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={
          <AlamosRefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={refreshTint}
            progressViewOffset={8}
          />
        }
      >
        <View style={[s.contentCard, { backgroundColor: cardBg }]}>
          <View style={s.heroBlock}>
          {/* Header del hero: "Tu portfolio" a la izquierda + chip
              ARS/USD a la derecha. Antes el chip estaba debajo del
              balance — moverlo acá libera espacio vertical y hace
              la moneda parte del label del saldo. */}
          <View style={s.portfolioTitleRow}>
            <Text
              style={[s.portfolioTitle, { color: c.textMuted }]}
              numberOfLines={1}
            >
              Tu portfolio
            </Text>
            <Tap
              haptic="selection"
              pressScale={0.96}
              onPress={() => setCurrencyOpen(true)}
              style={[s.currencyPill, { backgroundColor: c.surfaceHover }]}
            >
              <Text style={[s.currencyPillCode, { color: c.text }]}>
                {currency}
              </Text>
              <Feather name="chevron-down" size={12} color={c.textMuted} />
            </Tap>
          </View>

          {/* Balance unificado — convertido a la moneda seleccionada. */}
          <View style={s.balanceRow}>
            <AmountDisplay
              value={balanceDisplay}
              size={54}
              weight={800}
              currency={currency}
            />
          </View>

          <View style={[s.chartWrap, { marginTop: 18 }]}>
            <Sparkline
              series={series}
              color={sparklineColor}
              height={300}
              withFill={false}
              sheen
              live
              referenceLine
              strokeWidth={1}
              mode="line"
              onScrub={onScrub}
              onScrubEnd={onScrubEnd}
            />
          </View>

          <View style={s.rangeRow}>
            {/* Spacer invisible mirror del gear — balanza la fila
                para que las pills queden visualmente centradas
                sin quedar arrastradas a la izquierda por el peso
                del gear de la derecha. */}
            <View style={s.rangeSettingsBtn} pointerEvents="none" />
            <View style={s.rangePillsRow}>
              {ranges.map((r) => {
                const active = r === range;
                return (
                  <Tap
                    key={r}
                    onPress={() => setRangeAndSave(r)}
                    haptic="selection"
                    pressScale={0.92}
                    style={[
                      s.rangePill,
                      active && { backgroundColor: chartColor },
                    ]}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        s.rangeText,
                        { color: active ? c.bg : chartColor },
                      ]}
                    >
                      {r}
                    </Text>
                  </Tap>
                );
              })}
            </View>
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

        <Investments byCategory={byCategory} />
        </View>
      </ScrollView>

      {/* Sheet de ajustes del chart — abierto desde el icon de
          settings al final del timeline. */}
      <ChartSettingsSheet
        visible={chartSettingsOpen}
        considerCashflow={considerCashflow}
        onChangeConsiderCashflow={onChangeConsiderCashflow}
        onClose={() => setChartSettingsOpen(false)}
      />

      {/* Sheet "Cómo ver tu portfolio" — abierto desde el pill ARS/USD
          debajo del balance. Mismo mecanismo que el portfolio tab. */}
      <CurrencySheet
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        selected={currency}
        totalArs={total}
        onSelect={(cur) => setCurrency(cur)}
      />
    </View>
  );
}

/* ─── Action button: círculo Lemon-style con label debajo ─── */
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
      <ActionIcon name={iconName} size={51} />
      <Text style={[s.actionLabel, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Tap>
  );
}

/* ─── Helpers ─── */

/** Genera una serie realista: va desde (total / (1 + pct/100)) hasta total, con ruido. */
function generateSeries(total: number, pct: number, seed: string): number[] {
  // 280 puntos: densidad necesaria para que el modo "line" del Sparkline
  // se vea jagged tipo chart real de trading. Con 40 quedaba demasiado
  // smooth y no se notaba la textura.
  const length = 280;
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
    case "1D":
      return "hoy";
    case "7D":
      return "últimos 7 días";
    case "1M":
      return "este mes";
    case "3M":
      return "3 meses";
    case "1A":
      return "12 meses";
    case "MAX":
      return "histórico";
  }
}

function indexLabel(r: Range, index: number, length: number): string {
  const t = 1 - index / (length - 1);
  switch (r) {
    case "1D": {
      const h = Math.round(t * 24);
      if (h === 0) return "ahora";
      if (h === 1) return "hace 1h";
      return `hace ${h}h`;
    }
    case "7D": {
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
    case "1A": {
      const m = Math.round(t * 12);
      if (m === 0) return "hoy";
      if (m === 1) return "hace 1 mes";
      return `hace ${m} meses`;
    }
    case "MAX": {
      const y = Math.round(t * 5);
      if (y === 0) return "hoy";
      if (y === 1) return "hace 1 año";
      return `hace ${y} años`;
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
      {/* Acciones del home — Ingresar / Enviar / Invertir / Actividad.
          Outline brand para los cuatro (sin destacar uno sobre los
          otros). Invertir lleva al tab Invertir; Actividad lleva al
          feed de movimientos del portfolio. */}
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
          iconName="invertir"
          label="Invertir"
          haptic="medium"
          onPress={() => router.push("/(app)/explore")}
        />
        <ActionButton
          iconName="actividad"
          label="Actividad"
          haptic="light"
          onPress={() => router.push("/(app)/activity")}
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

      <View style={s.listWrap}>
        {sortedAccounts.map((a, i) => (
          <AccountRow
            key={a.id}
            account={a}
            withTopDivider={i > 0}
          />
        ))}
      </View>

      <View style={s.convertBtnWrap}>
        <ConvertCurrencyButton
          onPress={() => router.push("/(app)/convert")}
        />
      </View>

      <EarningsInfoSheet
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </View>
  );
}

const AccountRow = memo(function AccountRow({
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
          <MaterialCommunityIcons
            name="plus-thick"
            size={18}
            color={c.brand}
          />
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
});


/* ─── Tus inversiones: lista por categorías del brand pack ─── */
/**
 * Agrupa los holdings del usuario por categoría de Mercado y los
 * muestra como rows clickeables (mismo lenguaje visual que Mercado:
 * CategoryGlyph + label + total tenido + chevron). Tap → drilling
 * al detalle de la categoría en /(app)/market-category.
 *
 * Sólo aparecen las categorías donde el usuario tiene posiciones >0.
 * Los holdings que no calzan en ninguna categoría visible (efectivo,
 * placeholders sin mock) se descartan silenciosamente.
 */
function Investments({
  byCategory,
}: {
  byCategory: [AssetCategory, { total: number; items: Asset[] }][];
}) {
  const { c } = useTheme();
  const router = useRouter();

  // Para cada slug visible: total tenido (en ARS, equiv) + cantidad
  // de instrumentos. Un Map preserva el orden de insertion = orden
  // en el que aparecieron los assets en byCategory.
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { totalArs: number; count: number }
    >();
    for (const [, { items }] of byCategory) {
      for (const asset of items) {
        if (asset.category === "efectivo") continue;
        const slug = categorizeAsset(asset);
        if (!slug) continue;
        const value = convertAmount(
          asset.price * (asset.qty ?? 1),
          assetCurrency(asset),
          "ARS",
        );
        const prev = map.get(slug) ?? { totalArs: 0, count: 0 };
        map.set(slug, {
          totalArs: prev.totalArs + value,
          count: prev.count + 1,
        });
      }
    }
    // Ordenamos por valor descendente — el grupo con más plata
    // adentro va primero.
    return [...map.entries()].sort(
      ([, a], [, b]) => b.totalArs - a.totalArs,
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
          name="arrow-forward"
          size={18}
          color={c.brand}
        />
      </Pressable>

      <View style={grouped.length > 0 ? s.listWrap : s.emptyWrap}>
        {grouped.length > 0 ? (
          grouped.map(([slug, data], i) => {
            const lookup = findCategoryBySlug(slug);
            if (!lookup) return null;
            const { category } = lookup;
            return (
              <Pressable
                key={slug}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/market-category",
                    params: { slug },
                  })
                }
                style={[
                  s.invRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <CategoryGlyph
                  slug={category.slug}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.invRowLabel, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {category.label}
                  </Text>
                  <Text
                    style={[s.invRowSub, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {data.count} instrumento
                    {data.count === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[s.invRowValue, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {formatARS(data.totalArs)}
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={c.textFaint}
                />
              </Pressable>
            );
          })
        ) : (
          <Text style={[s.emptyPortfolio, { color: c.textMuted }]}>
            Todavía no tenés inversiones. Entrá a Invertir para empezar.
          </Text>
        )}
      </View>
    </View>
  );
}



const s = StyleSheet.create({
  /* ─── Core layout ─── */
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  /* Avatar 36pt en círculo de hit area 40×40 — el círculo del
   * AlamosAvatar es la chrome visible, el botón sólo aporta hit. */
  avatarBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  /* Pill que envuelve el TopRightIcon — hit area 40×40. */
  topIconBtn: {
    width: 40,
    height: 40,
    borderCurve: "continuous",
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

  /* Listas de Tu dinero / Tus inversiones — sueltas sobre el card
   * blanco, sin chrome propio (sin borde, sin shadow). Los rows
   * mismos manejan sus dividers con borderTop hairline. */
  listWrap: {
    paddingHorizontal: 4,
  },
  emptyWrap: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
  convertBtnWrap: {
    marginTop: 12,
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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

  /* Row del listado por categoría de 'Tus inversiones' — icon
   * (CategoryGlyph) + label/count + total ARS + chevron. */
  invRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  invRowLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  invRowSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  invRowValue: {
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
  /* Card blanco Lemon-style. marginHorizontal 12 deja respirar al
   * card sobre el bg gris; radius xxl + overflow hidden cierran las
   * esquinas y clipean el chart (que tiene marginH negativo para
   * extenderse a los bordes del card). marginTop 0 lo pega al
   * topBar — el card arranca apenas debajo del avatar/campana. */
  contentCard: {
    marginHorizontal: 12,
    marginTop: 0,
    paddingTop: 18,
    paddingBottom: 24,
    borderCurve: "continuous",
    borderRadius: radius.xxl,
    overflow: "hidden",
  },
  /* Header del hero: "Tu portfolio" + chip ARS/USD en la misma fila. */
  portfolioTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  /* "Tu portfolio" como eyebrow del balance — fontFamily 600 +
   * textMuted lo deja como label sutil arriba del monto sin
   * competir. */
  portfolioTitle: {
    fontFamily: fontFamily[600],
    fontSize: 17,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  /* Balance unificado — fila con sólo el AmountDisplay. Sin swipe
   * horizontal: el currency se cambia desde el pill de abajo que
   * abre el CurrencySheet. */
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  /* Pill ARS/USD — chiquito, va a la derecha del "Tu portfolio".
   * Tap → abre el CurrencySheet para cambiar moneda con un acto
   * deliberado. Mismo patrón que el portfolio tab. */
  currencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderCurve: "continuous",
    borderRadius: 999,
  },
  currencyPillCode: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.5,
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -2,
    marginBottom: 8,
  },
  /* Timeline del chart — mismo lenguaje visual que el del stock
   * detail: 6 pills (1D / 7D / 1M / 3M / 1A / MAX) en cápsula
   * completa, con un spacer mirror del gear a la izquierda para
   * que las pills queden visualmente centradas mientras el gear
   * sigue siendo accesible a la derecha. */
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 0,
    paddingHorizontal: 4,
  },
  rangePillsRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  rangePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderCurve: "continuous",
    borderRadius: radius.pill,
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
    fontSize: 13,
    letterSpacing: 0.3,
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
    borderCurve: "continuous",
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
