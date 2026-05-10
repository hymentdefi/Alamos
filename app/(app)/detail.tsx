import { Fragment, useCallback, useMemo, useState, type ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line as SvgLine,
  Path as SvgPath,
  Text as SvgText,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Tap } from "../../lib/components/Tap";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import {
  assets,
  assetCurrency,
  assetIconCode,
  formatARS,
  formatMoney,
  formatPct,
  type Asset,
  type AssetCategory,
} from "../../lib/data/assets";
import {
  Sparkline,
  MiniSparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";
import { AmountDisplay } from "../../lib/components/AmountDisplay";
import { WatchlistButton } from "../../lib/components/WatchlistButton";
import {
  isMarketOpen,
  marketSessionFor,
} from "../../lib/market/hours";
import { MarketClosedIcon } from "../../lib/components/MarketClosedIcon";
import { AssetColorProvider } from "../../lib/asset-color/context";
import { PriceAlertButton } from "../../lib/components/PriceAlertButton";
import { TradeBottomBar } from "../../lib/components/TradeBottomBar";
import { briefingFor, formatBriefingAge } from "../../lib/data/briefings";

const ranges = ["1D", "1S", "1M", "3M", "1A", "MAX"] as const;
type Range = (typeof ranges)[number];

/** Variación % por rango para el activo (mock, determinístico).
 *
 *  Override de testing para NVIDIA (NVDA / NVDA.US): alterna el
 *  signo a través de los rangos para verificar que el coloring
 *  driven-by-rangeUp funcione end-to-end. 1D positivo → 1S
 *  negativo → 1M positivo → 3M negativo. */
function rangePctFor(ticker: string, range: Range): number {
  if (ticker === "NVDA" || ticker === "NVDA.US") {
    const overrides: Record<Range, number> = {
      "1D": 3.42,
      "1S": -4.8,
      "1M": 6.1,
      "3M": -8.5,
      "1A": 21.4,
      MAX: 48.7,
    };
    return overrides[range];
  }
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) | 0;
  const base = ((Math.abs(h) % 200) - 100) / 10; // -10 a 10
  const mult: Record<Range, number> = {
    "1D": 0.3,
    "1S": 0.7,
    "1M": 1.2,
    "3M": 2.1,
    "1A": 3.5,
    MAX: 5.2,
  };
  return base * mult[range];
}

// Densidad de puntos por rango — emula la frecuencia real con la que
// un broker tickea precio. Más puntos → línea más jagged y "viva".
// 1D matchea aprox. 1 tick por minuto en horario de mercado (~280 min);
// rangos más largos densos también para que el ojo perciba textura.
const LENGTH_BY_RANGE: Record<Range, number> = {
  "1D": 280,
  "1S": 200,
  "1M": 240,
  "3M": 260,
  "1A": 280,
  MAX: 300,
};

function buildPriceSeries(
  currentPrice: number,
  pct: number,
  seed: string,
  range: Range,
): number[] {
  const length = LENGTH_BY_RANGE[range];
  const start = currentPrice / (1 + pct / 100);
  const noise = seriesFromSeed(seed, length, "flat");
  // Volatilidad escalada al rango: intra-day más nervioso, multi-año
  // más alisado relativo al precio (porque la trend domina).
  const noiseScale =
    currentPrice *
    (range === "1D" ? 0.012 : range === "1S" ? 0.018 : range === "1M" ? 0.022 : 0.025);
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const linear = start + (currentPrice - start) * t;
    const normalized = (noise[i] - 100) / 6;
    out.push(linear + normalized * noiseScale);
  }
  out[length - 1] = currentPrice;
  return out;
}

export default function DetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [range, setRange] = useState<Range>("1D");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  /* Pull-to-refresh — refresca el activo (precio, chart, news,
   * fundamentales, alertas relacionadas). Mantiene el spinner
   * visible hasta que todos los datos terminen. */
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    /* Mock — en producción acá disparamos los re-fetch de price,
     * candles del range actual, news, fundamentales, y alertas
     * para este ticker. Con MOCK_MODE simulamos el await. */
    await new Promise((r) => setTimeout(r, 900));
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    setRefreshing(false);
  }, []);

  /* ─── Sticky header — scroll detection ──────────────────────────
   *
   * El topBar tiene back / [center vacío] / alert / favStar. Cuando el
   * user scrollea pasado el hero, llenamos el center con:
   *   precio (línea superior, peso 500)
   *   ticker · variación%  (línea inferior, variación con color
   *                          contextual del sistema cromático)
   *
   * Reanimated useSharedValue + scroll handler en UI thread → 60fps
   * en gama media. Crossfade en 80px de scroll, calibrado para que
   * el sticky aparezca cuando el precio del hero sale de cuadro. */
  const stickyScrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      stickyScrollY.value = e.contentOffset.y;
    },
  });

  const STICKY_START = 160;
  const STICKY_FULL = 240;

  const stickyOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      stickyScrollY.value,
      [STICKY_START, STICKY_FULL],
      [0, 1],
      "clamp",
    ),
  }));

  // IMPORTANT: todos los hooks se corren ANTES del early return para
  // respetar las reglas de React (mismo orden cada render). Si el
  // ticker todavía no está resuelto, 'asset' es undefined y los hooks
  // siguientes usan fallbacks seguros.
  const asset = useMemo(() => assets.find((a) => a.ticker === ticker), [ticker]);

  const pctForRange = asset ? rangePctFor(asset.ticker, range) : 0;
  const series = useMemo(
    () =>
      asset
        ? buildPriceSeries(asset.price, pctForRange, `${asset.ticker}-${range}`, range)
        : [],
    [asset, pctForRange, range],
  );

  if (!asset) return null;

  // Moneda nativa del activo — TODO el screen formatea en esta moneda.
  // Si AAPL.US es USD, el precio del hero, el delta, los stats, tu
  // posición, los movimientos, todo va en US$. No mezclamos con peso.
  const cur = assetCurrency(asset);
  const rangeUp = pctForRange >= 0;
  const color = rangeUp ? c.brand : c.red;
  /* chartColor — verde más suave (#5AC53A vía c.dataGreen) sólo
   * para la LÍNEA del chart (Sparkline). El resto de la UI
   * (sticky pct, deltas, pills) sigue con el `color` brand para
   * que el verde unificado se mantenga consistente. */
  const chartColor = rangeUp ? c.dataGreen : c.red;

  const current = scrubIndex != null ? series[scrubIndex] : series[series.length - 1];
  const rangeStart = series[0];
  const displayDelta = current - rangeStart;
  const displayPct = (displayDelta / rangeStart) * 100;
  const displayUp = displayDelta >= 0;

  const marketClosed = !isMarketOpen() && asset.category !== "crypto";
  const baseTimeLabel =
    scrubIndex != null
      ? indexLabel(range, scrubIndex, series.length)
      : rangeLabel(range);
  const timeLabel =
    marketClosed && scrubIndex == null
      ? `${baseTimeLabel} · mercado cerrado`
      : baseTimeLabel;

  const position = asset.held && asset.qty ? asset.qty : 0;
  const positionValue = position * asset.price;
  const pos = useMemo(() => mockPosition(asset), [asset]);

  return (
    <AssetColorProvider up={rangeUp}>
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="arrow-left" size={24} color={c.text} />
        </Tap>
        {/* Spacer puro entre back y los íconos derechos. El bloque
            sticky vive como overlay absoluto centrado SOBRE LA
            PANTALLA (no entre íconos), independiente del ancho de
            cada lado. */}
        <View style={{ flex: 1 }} />
        <PriceAlertButton
          ticker={asset.ticker}
          onPress={() => {
            router.push({
              pathname: "/(app)/asset-alerts",
              params: { ticker: asset.ticker },
            });
          }}
        />
        <WatchlistButton ticker={asset.ticker} />

        {/* Sticky overlay — absolute, centrado sobre el topBar
            entero (left:0, right:0). Así NO depende del ancho de
            los íconos: precio + ticker · variación% quedan en el
            centro real de la pantalla, exactamente como en el
            objetivo de la captura de referencia. pointerEvents
            none para no comer taps de los íconos al desvanecerse. */}
        <Animated.View
          style={[
            s.stickyOverlay,
            { top: insets.top + 12 },
            stickyOpacityStyle,
          ]}
          pointerEvents="none"
        >
          <Text
            style={[s.stickyPrice, { color: c.text }]}
            numberOfLines={1}
          >
            {formatMoney(asset.price, cur)}
          </Text>
          <View style={s.stickyRow}>
            <Text style={[s.stickyTicker, { color: c.textMuted }]}>
              {asset.ticker}
            </Text>
            <Text style={[s.stickyDot, { color: c.textMuted }]}>·</Text>
            <Text style={[s.stickyPct, { color }]}>
              {formatPct(pctForRange)}
            </Text>
          </View>
        </Animated.View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.text}
            colors={[c.brand]}
            progressBackgroundColor={c.surface}
            progressViewOffset={12}
          />
        }
      >
        <View style={s.heroBlock}>
          <Text style={[s.heroTicker, { color: c.textMuted }]}>
            {asset.ticker}
          </Text>
          <Text style={[s.heroName, { color: c.text }]} numberOfLines={2}>
            {asset.name}
          </Text>
          <View style={s.heroPriceRow}>
            <AmountDisplay value={current} size={52} currency={cur} />
            {/* Icono de mercado cerrado — sólo aparece cuando aplica
                (no en crypto / FCI). Toma el color del estado cromático
                del chart (verde si rangeUp, rojo si losses). Tap →
                abre MarketClosedSheet. */}
            <View style={s.heroPriceBadge}>
              <MarketClosedIcon
                session={marketSessionFor(asset)}
                size={22}
                color={color}
              />
            </View>
          </View>
          <View style={s.deltaRow}>
            <Text style={[s.deltaTri, { color }]}>{displayUp ? "▲" : "▼"}</Text>
            <Text style={[s.deltaText, { color }]}>
              {formatMoney(Math.abs(displayDelta), cur)}
            </Text>
            <Text style={[s.deltaText, { color }]}>
              ({formatPct(displayPct)})
            </Text>
            <Text style={[s.deltaText, { color: c.textMuted }]}>
              {timeLabel}
            </Text>
          </View>


          <Sparkline
            series={series}
            color={chartColor}
            height={240}
            mode="line"
            strokeWidth={1}
            withFill={false}
            sheen
            live={range === "1D" && !marketClosed}
            referenceLine
            style={{ marginTop: 28, marginHorizontal: -24 }}
            onScrub={(idx) => setScrubIndex(idx)}
            onScrubEnd={() => setScrubIndex(null)}
          />

          <View style={s.rangeRow}>
            {ranges.map((r) => {
              const active = r === range;
              return (
                <Tap
                  key={r}
                  onPress={() => setRange(r)}
                  haptic="selection"
                  pressScale={0.92}
                  style={[
                    s.rangePill,
                    active && { backgroundColor: color },
                  ]}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      s.rangeText,
                      { color: active ? c.bg : color },
                    ]}
                  >
                    {r}
                  </Text>
                </Tap>
              );
            })}
          </View>
        </View>

        <BriefingCard
          asset={asset}
          up={rangeUp}
          pct={pctForRange}
          c={c}
        />

        {pos ? <PositionCard pos={pos} asset={asset} c={c} /> : null}

        <RecurringCard asset={asset} c={c} onPress={() => {}} />

        <StatsGrid asset={asset} c={c} />

        {asset.category === "cedears" || asset.category === "acciones" ? (
          <EarningsCard asset={asset} c={c} />
        ) : null}

        <RelatedCarousel
          asset={asset}
          c={c}
          onTap={(t) =>
            router.push({ pathname: "/(app)/detail", params: { ticker: t } })
          }
        />

        <NewsCard asset={asset} c={c} />

        {pos ? <HistoryCard asset={asset} c={c} /> : null}

        <AboutCard asset={asset} c={c} />

        <Text style={[s.disclaimer, { color: c.textFaint }]}>
          Las cotizaciones son referenciales y pueden tener delay. Invertir
          implica riesgo de pérdida de capital. Álamos opera bajo Manteca
          ALyC, regulada por la CNV.
        </Text>
      </Animated.ScrollView>

      <TradeBottomBar
        asset={asset}
        hasPosition={position > 0}
        onSelect={(mode) => {
          // En mercado abierto: routea al flow de compra/venta
          // existente (buy.tsx). En mercado cerrado: buy.tsx detecta
          // y muta a flow de orden diferida (banner + CTA Programar).
          // Las pills ya muestran "Programar compra/venta" cuando
          // corresponde — el copy se mantiene consistente.
          router.push({
            pathname: "/(app)/buy",
            params: { ticker: asset.ticker, mode },
          });
        }}
        onConvert={() => router.push("/(app)/convert")}
      />

    </View>
    </AssetColorProvider>
  );
}

function categoryLabel(cat: AssetCategory): string {
  const labels: Record<AssetCategory, string> = {
    efectivo: "Efectivo",
    cedears: "CEDEAR",
    bonos: "Bono soberano",
    fci: "Fondo común de inversión",
    acciones: "Acción argentina",
    obligaciones: "Obligación negociable",
    letras: "Letra del Tesoro",
    caucion: "Caución bursátil",
    crypto: "Crypto Spot",
    futuros: "Futuro perpetuo",
    opciones: "Opción",
  };
  return labels[cat];
}

function rangeLabel(r: Range): string {
  switch (r) {
    case "1D":
      return "hoy";
    case "1S":
      return "esta semana";
    case "1M":
      return "este mes";
    case "3M":
      return "3 meses";
    case "1A":
      return "1 año";
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
      return `hace ${w} sem`;
    }
    case "1A": {
      const m = Math.round(t * 12);
      if (m === 0) return "hoy";
      return `hace ${m} meses`;
    }
    case "MAX": {
      const y = Math.round(t * 5);
      if (y === 0) return "este año";
      return `hace ${y} años`;
    }
  }
}

/** Formatea cifras grandes como "3,2 B" / "428 M" / "12,5 K". */
function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(1).replace(".", ",")} B`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1).replace(".", ",")} K`;
  return `${n.toFixed(0)}`;
}

/** Hash determinístico simple para mockear sub-stats sin que cambien
 *  entre renders. */
function tickerHash(ticker: string, salt: string = ""): number {
  let h = 0;
  const k = ticker + salt;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stats(asset: Asset): { label: string; value: string }[] {
  const px = asset.price;
  const ch = asset.change / 100;
  const open = px / (1 + ch);
  // Día: high/low alrededor del precio actual con drift por hash.
  const dayHigh = px * (1 + Math.abs(ch) * 0.6 + (tickerHash(asset.ticker, "h") % 30) / 10000);
  const dayLow = px * (1 - Math.abs(ch) * 0.6 - (tickerHash(asset.ticker, "l") % 30) / 10000);
  // 52 semanas: rango más amplio (±25-50% según hash).
  const w52High = px * (1.25 + (tickerHash(asset.ticker, "wh") % 30) / 100);
  const w52Low = px * (0.55 + (tickerHash(asset.ticker, "wl") % 25) / 100);
  // Volumen 24h: mockea entre 100K y 5M unidades.
  const volume = 100_000 + (tickerHash(asset.ticker, "v") % 4_900_000);
  // Volumen promedio (90 días): cerca del actual con drift de ±30%.
  const avgVolume =
    volume * (0.7 + (tickerHash(asset.ticker, "av") % 60) / 100);
  // Formateador de moneda según la divisa nativa del activo (ARS / USD
  // / USDT). Sin esto, un AAPL.US (USD) salía con "$" peso por error.
  const fmt = (n: number) => formatMoney(n, assetCurrency(asset));

  const cat = asset.category as AssetCategory;

  // Stats genéricas para todo lo que cotiza con high/low/volumen
  // (acciones, cedears, bonos, ONs, letras, FCI, crypto, futuros).
  const tradedRows: { label: string; value: string }[] = [
    { label: "Apertura", value: fmt(open) },
    { label: "Máx. del día", value: fmt(dayHigh) },
    { label: "Mín. del día", value: fmt(dayLow) },
    { label: "52s alto", value: fmt(w52High) },
    { label: "52s bajo", value: fmt(w52Low) },
    { label: "Volumen", value: formatCompact(volume) },
    { label: "Vol. promedio", value: formatCompact(avgVolume) },
  ];

  switch (cat) {
    case "cedears": {
      const mktCap = px * 1_500_000_000 * (1 + (tickerHash(asset.ticker, "mc") % 50) / 100);
      const peRatio = 12 + (tickerHash(asset.ticker, "pe") % 28);
      const divYield = (0.4 + (tickerHash(asset.ticker, "d") % 30) / 10).toFixed(1).replace(".", ",");
      // Orden interleaved: price-related (Apertura, Máx, Mín, 52s alto/bajo)
      // a la izquierda, volumen/fundamentals (Volumen, Vol. prom, Cap,
      // P/E, Dividendo) a la derecha. StatsGrid los empareja 2 a 2.
      return [
        { label: "Apertura", value: fmt(open) },
        { label: "Volumen", value: formatCompact(volume) },
        { label: "Máx. del día", value: fmt(dayHigh) },
        { label: "Vol. promedio", value: formatCompact(avgVolume) },
        { label: "Mín. del día", value: fmt(dayLow) },
        { label: "Cap. de mercado", value: formatCompact(mktCap) },
        { label: "52s alto", value: fmt(w52High) },
        { label: "P/E", value: peRatio.toFixed(1).replace(".", ",") },
        { label: "52s bajo", value: fmt(w52Low) },
        { label: "Dividendo", value: `${divYield}%` },
      ];
    }
    case "acciones": {
      const isUS = (asset.market ?? "AR") === "US";
      const mktCap =
        px * (isUS ? 800_000_000 : 1_200_000) * (1 + (tickerHash(asset.ticker, "mc") % 50) / 100);
      const peRatio = 8 + (tickerHash(asset.ticker, "pe") % 22);
      const divYield = (0.5 + (tickerHash(asset.ticker, "d") % 35) / 10).toFixed(1).replace(".", ",");
      return [
        { label: "Apertura", value: fmt(open) },
        { label: "Volumen", value: formatCompact(volume) },
        { label: "Máx. del día", value: fmt(dayHigh) },
        { label: "Vol. promedio", value: formatCompact(avgVolume) },
        { label: "Mín. del día", value: fmt(dayLow) },
        { label: "Cap. de mercado", value: formatCompact(mktCap) },
        { label: "52s alto", value: fmt(w52High) },
        { label: "P/E", value: peRatio.toFixed(1).replace(".", ",") },
        { label: "52s bajo", value: fmt(w52Low) },
        { label: "Dividendo", value: `${divYield}%` },
      ];
    }
    case "bonos":
      return [
        ...tradedRows,
        { label: "TIR", value: `${(8 + (tickerHash(asset.ticker, "tir") % 12)).toFixed(2).replace(".", ",")}%` },
        { label: "Duración", value: `${(2 + (tickerHash(asset.ticker, "dur") % 8)).toFixed(1).replace(".", ",")}` },
        { label: "Paridad", value: `${(85 + (tickerHash(asset.ticker, "par") % 25)).toFixed(1).replace(".", ",")}%` },
        { label: "Cupón", value: `${(3.5 + (tickerHash(asset.ticker, "cu") % 8)).toFixed(2).replace(".", ",")}%` },
        { label: "Ley", value: asset.subLabel.includes("NY") ? "Nueva York" : "Argentina" },
        { label: "Vencimiento", value: "2030" },
        { label: "Moneda", value: "USD" },
      ];
    case "fci":
      return [
        ...tradedRows.slice(0, 4),
        { label: "Patrimonio", value: formatCompact(px * 50_000_000) },
        { label: "Susc. mínima", value: "$ 1.000" },
        { label: "Comisión anual", value: `${(1 + (tickerHash(asset.ticker, "cm") % 30) / 10).toFixed(1).replace(".", ",")}%` },
        { label: "Rend. 30 días", value: `${(2 + (tickerHash(asset.ticker, "r30") % 50) / 10).toFixed(2).replace(".", ",")}%` },
        { label: "Tipo de fondo", value: asset.subLabel.includes("Variable") ? "Renta variable" : "Renta fija" },
        { label: "Horizonte", value: "Corto plazo" },
      ];
    case "obligaciones":
      return [
        ...tradedRows,
        { label: "Emisor", value: asset.name.split(" ON")[0] },
        { label: "TIR", value: `${(7 + (tickerHash(asset.ticker, "tir") % 5)).toFixed(2).replace(".", ",")}%` },
        { label: "Moneda", value: "USD" },
      ];
    case "letras":
      return [
        ...tradedRows.slice(0, 4),
        { label: "TNA", value: `${(35 + (tickerHash(asset.ticker, "tna") % 20)).toFixed(2).replace(".", ",")}%` },
        { label: "Vencimiento", value: "Corto plazo" },
      ];
    case "caucion":
      return [
        { label: "TNA", value: `${(35 + (tickerHash(asset.ticker, "tna") % 8)).toFixed(2).replace(".", ",")}%` },
        { label: "Plazo", value: "1 día" },
        { label: "Moneda", value: "Pesos" },
      ];
    case "crypto": {
      const supply = 1_000_000 * (1 + tickerHash(asset.ticker, "s") % 100);
      return [
        ...tradedRows,
        { label: "Cap. de mercado", value: formatCompact(px * supply) },
        { label: "Suministro circulante", value: formatCompact(supply) },
        { label: "ATH", value: fmt(w52High * 1.4) },
      ];
    }
    case "futuros":
      return [
        ...tradedRows,
        { label: "Apalancamiento máx.", value: `${(asset as Asset).maxLeverage ?? 50}x` },
        { label: "Funding rate (8h)", value: `${((asset as Asset).fundingRate ?? 0.005).toFixed(4).replace(".", ",")}%` },
      ];
    default:
      return [
        { label: "Tipo", value: categoryLabel(asset.category) },
      ];
  }
}

/* ─── Mock data helpers para secciones ricas ─── */

interface PositionSummary {
  qty: number;
  marketValue: number;
  avgCost: number;
  todayDelta: number;
  todayPct: number;
  totalDelta: number;
  totalPct: number;
  portfolioPct: number;
}

/** Deriva una posición sintética a partir de qty + price + change diario.
 *  El costo promedio se mockea como precio actual menos un drift basado
 *  en el ticker — determinístico, así no salta entre renders. */
function mockPosition(asset: Asset): PositionSummary | null {
  if (!asset.held || !asset.qty) return null;
  const qty = asset.qty;
  const marketValue = qty * asset.price;
  // Drift de costo entre -25% y +15% según hash del ticker — algunos
  // están en ganancia, otros en pérdida.
  let h = 0;
  for (let i = 0; i < asset.ticker.length; i++)
    h = (h * 31 + asset.ticker.charCodeAt(i)) | 0;
  const driftPct = ((Math.abs(h) % 40) - 25) / 100;
  const avgCost = asset.price / (1 + driftPct);
  const todayDelta = marketValue * (asset.change / 100);
  const totalDelta = (asset.price - avgCost) * qty;
  const totalCost = avgCost * qty;
  const totalPct = totalCost > 0 ? (totalDelta / totalCost) * 100 : 0;
  // Portfolio % mockeado — entre 5% y 35% según hash.
  const portfolioPct = 5 + (Math.abs(h) % 30);
  return {
    qty,
    marketValue,
    avgCost,
    todayDelta,
    todayPct: asset.change,
    totalDelta,
    totalPct,
    portfolioPct,
  };
}

interface QuarterEarnings {
  label: string;
  expected: number;
  actual: number;
}

/** Próximo earning mock — fecha 20-80 días en el futuro y sesión
 *  pre/post mercado. Determinístico por ticker. */
function mockNextEarning(ticker: string): { date: string; session: string } {
  const hash = tickerHash(ticker, "next");
  const daysAhead = 20 + (hash % 60);
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const months = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return {
    date: `${date.getDate()} ${months[date.getMonth()]}`,
    session: hash % 2 === 0 ? "pre-mercado" : "post-mercado",
  };
}

/** 5 trimestres mock con expected vs actual EPS. Determinístico por
 *  ticker así un mismo activo siempre muestra la misma serie. */
function mockEarnings(ticker: string): QuarterEarnings[] {
  let h = 0;
  for (let i = 0; i < ticker.length; i++)
    h = (h * 31 + ticker.charCodeAt(i)) | 0;
  const rand = () => {
    h = (h * 9301 + 49297) % 233280;
    return h / 233280;
  };
  // Últimos 4 trimestres reportados — formato fiscal year, convención
  // de Bloomberg/Reuters. 4 (no 5) para que los dots respiren más.
  const labels = ["Q4 FY24", "Q1 FY25", "Q2 FY25", "Q3 FY25"];
  return labels.map((label, i) => {
    // Expected con leve tendencia, en rango ~[-3, -1.4]. Nunca llega
    // a 0 — así el Y-axis no se estira hasta 0 y el rango queda tight.
    const expected = parseFloat(
      (-3 + i * 0.4 + (rand() - 0.5) * 0.4).toFixed(2),
    );
    const surpriseAbs = 0.3 + rand() * 0.7; // 0.3 a 1.0
    const surpriseSign = rand() > 0.5 ? 1 : -1;
    const rawActual = expected + surpriseSign * surpriseAbs;
    // Clampeo el actual para que nunca pase de -0.3 → asegurada la
    // zona negativa pura, Y-axis siempre tight.
    const actual = parseFloat(Math.min(-0.3, rawActual).toFixed(2));
    return { label, expected, actual };
  });
}

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  ago: string;
}

/** 3 titulares mockeados específicos al ticker — con drift de tiempo. */
function mockNews(asset: Asset): NewsItem[] {
  const t = asset.ticker;
  const name = asset.name;
  const isUp = asset.change >= 0;
  const dir = isUp ? "subió" : "cayó";
  return [
    {
      id: `${t}-n1`,
      headline: `${name} ${dir} ${formatPct(asset.change, false)} en la rueda de hoy`,
      source: "Cronista",
      ago: "hace 2h",
    },
    {
      id: `${t}-n2`,
      headline: `Analistas revisan precio objetivo de ${t} para el cierre del trimestre`,
      source: "Ámbito",
      ago: "hace 6h",
    },
    {
      id: `${t}-n3`,
      headline: `Volumen operado de ${t} sobre el promedio de las últimas dos semanas`,
      source: "Bloomberg Línea",
      ago: "ayer",
    },
  ];
}

interface HistoryItem {
  id: string;
  side: "buy" | "sell" | "dividend";
  qty: number;
  price: number;
  date: string;
}

/** Mock de movimientos del usuario sobre este ticker — solo si tiene
 *  posición abierta. */
function mockHistory(asset: Asset): HistoryItem[] {
  if (!asset.held || !asset.qty) return [];
  const t = asset.ticker;
  const half = Math.max(1, Math.round(asset.qty / 2));
  return [
    {
      id: `${t}-h1`,
      side: "buy",
      qty: half,
      price: asset.price * 0.92,
      date: "12 abr",
    },
    {
      id: `${t}-h2`,
      side: "buy",
      qty: asset.qty - half,
      price: asset.price * 1.04,
      date: "3 mar",
    },
    {
      id: `${t}-h3`,
      side: "dividend",
      qty: 0,
      price: asset.price * 0.008 * asset.qty,
      date: "15 feb",
    },
  ];
}

/** Otros activos de la misma categoría — para "Te puede interesar". */
function relatedAssets(asset: Asset, max = 6): Asset[] {
  return assets
    .filter((a) => a.category === asset.category && a.ticker !== asset.ticker)
    .slice(0, max);
}

/* ─── Metadata de empresa para acciones / cedears ─── */
interface CompanyMeta {
  ceo: string;
  founded: string;
  hq: string;
  employees: string;
  industry: string;
}

const COMPANY_META: Record<string, CompanyMeta> = {
  AAPL: { ceo: "Tim Cook", founded: "1976", hq: "Cupertino, EE.UU.", employees: "164.000", industry: "Tecnología de consumo" },
  MSFT: { ceo: "Satya Nadella", founded: "1975", hq: "Redmond, EE.UU.", employees: "228.000", industry: "Software" },
  NVDA: { ceo: "Jensen Huang", founded: "1993", hq: "Santa Clara, EE.UU.", employees: "29.600", industry: "Semiconductores" },
  AMZN: { ceo: "Andy Jassy", founded: "1994", hq: "Seattle, EE.UU.", employees: "1.500.000", industry: "E-commerce y nube" },
  TSLA: { ceo: "Elon Musk", founded: "2003", hq: "Austin, EE.UU.", employees: "140.000", industry: "Automotriz / Energía" },
  GOOGL: { ceo: "Sundar Pichai", founded: "1998", hq: "Mountain View, EE.UU.", employees: "183.000", industry: "Tecnología / Publicidad" },
  META: { ceo: "Mark Zuckerberg", founded: "2004", hq: "Menlo Park, EE.UU.", employees: "67.000", industry: "Redes sociales" },
  MELI: { ceo: "Marcos Galperin", founded: "1999", hq: "Buenos Aires, Argentina", employees: "58.000", industry: "E-commerce / Fintech" },
  KO: { ceo: "James Quincey", founded: "1892", hq: "Atlanta, EE.UU.", employees: "79.000", industry: "Bebidas" },
  WMT: { ceo: "Doug McMillon", founded: "1962", hq: "Bentonville, EE.UU.", employees: "2.100.000", industry: "Retail" },
  YPFD: { ceo: "Horacio Marín", founded: "1922", hq: "Buenos Aires, Argentina", employees: "22.000", industry: "Energía" },
  GGAL: { ceo: "Fabián Kon", founded: "1905", hq: "Buenos Aires, Argentina", employees: "5.500", industry: "Banca" },
  PAMP: { ceo: "Gustavo Mariani", founded: "1945", hq: "Buenos Aires, Argentina", employees: "2.300", industry: "Energía" },
  BMA: { ceo: "Jorge Brito", founded: "1976", hq: "Buenos Aires, Argentina", employees: "9.500", industry: "Banca" },
};

function companyMeta(ticker: string): CompanyMeta | null {
  const base = ticker.replace(/\.US$/i, "");
  return COMPANY_META[base] ?? null;
}

function aboutText(cat: AssetCategory): string {
  switch (cat) {
    case "efectivo":
      return "Saldo en pesos disponible en tu cuenta de Álamos. Lo usás para comprar cualquier activo o podés retirarlo a tu cuenta bancaria cuando quieras.";
    case "cedears":
      return "Certificado de depósito argentino que representa acciones de empresas del exterior. Operan en pesos en BYMA.";
    case "bonos":
      return "Título de deuda emitido por el Tesoro Nacional. Paga intereses periódicos y devuelve el capital al vencimiento.";
    case "fci":
      return "Fondo común de inversión administrado por una gestora local. Invertí un monto mínimo bajo y podés rescatar cuando quieras.";
    case "acciones":
      return "Acción de una empresa argentina que cotiza en BYMA. Te convertís en accionista y participás de los resultados de la compañía.";
    case "obligaciones":
      return "Título de deuda privado emitido por una empresa. Suele rendir más que los bonos del Tesoro.";
    case "letras":
      return "Letra capitalizable del Tesoro. Corto plazo, rendimiento fijo.";
    case "caucion":
      return "Préstamo de corto plazo entre inversores con garantía en títulos públicos. Rinde pesos a tasa de mercado.";
    case "crypto":
      return "Crypto spot. Operable 24/7 en el mercado internacional con liquidación inmediata.";
    case "futuros":
      return "Contrato de futuro perpetuo con apalancamiento. Alto riesgo, solo para traders experimentados.";
    case "opciones":
      return "Derivado financiero. Da el derecho (no la obligación) de comprar o vender a un precio fijado.";
  }
}

type ColorMap = ReturnType<typeof useTheme>["c"];

/** Label de la unidad de tenencia según categoría. Robinhood-style:
 *  evita "Cantidad de X" genérico, usa el sustantivo natural ("Acciones",
 *  "Bonos", "Cuotapartes"). */
function qtyLabel(cat: AssetCategory): string {
  switch (cat) {
    case "acciones":
    case "cedears":
      return "Acciones";
    case "bonos":
      return "Bonos";
    case "fci":
      return "Cuotapartes";
    case "obligaciones":
      return "ONs";
    case "letras":
      return "Letras";
    case "crypto":
      return "Unidades";
    case "futuros":
      return "Contratos";
    default:
      return "Cantidad";
  }
}

/** Mini gauge circular que llena un arco proporcional al porcentaje
 *  pasado. Pensado para acompañar el "% de tu cartera" como visual cue.
 *  Si la posición es el 100% del portfolio, queda un círculo cerrado. */
function DiversityCircle({
  pct,
  color,
  c,
  size = 14,
}: {
  pct: number;
  color: string;
  c: ColorMap;
  size?: number;
}) {
  const stroke = 1.6;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(Math.max(pct, 0), 100) / 100) * circ;
  return (
    <Svg width={size} height={size} style={{ marginLeft: 6 }}>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={c.border}
        strokeWidth={stroke}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  );
}

/* ─── Tu posición — grid 2x3 con métricas clave ─── */
function PositionCard({
  pos,
  asset,
  c,
}: {
  pos: PositionSummary;
  asset: Asset;
  c: ColorMap;
}) {
  const todayUp = pos.todayDelta >= 0;
  const totalUp = pos.totalDelta >= 0;
  const cur = assetCurrency(asset);
  const fmt = (n: number) => formatMoney(n, cur);
  return (
    <View
      style={[
        s.card,
        { marginTop: 24 },
      ]}
    >
      <Text style={[s.cardEyebrow, { color: c.text }]}>Tu posición</Text>
      <View style={s.posGrid}>
        <PosCell label={qtyLabel(asset.category)} value={`${pos.qty}`} c={c} />
        <PosCell
          label="Valor de mercado"
          value={fmt(pos.marketValue)}
          c={c}
          align="right"
        />
        <PosCell
          label="Costo promedio"
          value={fmt(pos.avgCost)}
          c={c}
        />
        <PosCell
          label="% de tu cartera"
          value={`${pos.portfolioPct.toFixed(1)}%`}
          c={c}
          align="right"
          icon={
            <DiversityCircle
              pct={pos.portfolioPct}
              color={c.brand}
              c={c}
            />
          }
        />
      </View>

      <View style={{ height: 20 }} />

      <ReturnRow
        label="Resultado del día"
        amount={`${todayUp ? "+" : "−"}${fmt(Math.abs(pos.todayDelta))}`}
        pct={formatPct(pos.todayPct)}
        color={todayUp ? c.brand : c.red}
        c={c}
      />
      <ReturnRow
        label="Resultado total"
        amount={`${totalUp ? "+" : "−"}${fmt(Math.abs(pos.totalDelta))}`}
        pct={formatPct(pos.totalPct)}
        color={totalUp ? c.brand : c.red}
        c={c}
        isLast
      />
    </View>
  );
}

/* Fila full-width para Resultado del día / total — label izquierda,
 * monto + (%) derecha en una sola línea. Hairline divider top siempre;
 * con `isLast` también divider bottom para cerrar la sección. */
function ReturnRow({
  label,
  amount,
  pct,
  color,
  isLast,
  c,
}: {
  label: string;
  amount: string;
  pct: string;
  color: string;
  isLast?: boolean;
  c: ColorMap;
}) {
  return (
    <View
      style={[
        s.returnRow,
        { borderTopColor: c.border, borderBottomColor: c.border },
        isLast ? { borderBottomWidth: StyleSheet.hairlineWidth } : null,
      ]}
    >
      <Text style={[s.returnLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.returnValue, { color }]}>
        {amount} ({pct})
      </Text>
    </View>
  );
}

function PosCell({
  label,
  value,
  sub,
  color,
  align = "left",
  icon,
  c,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  align?: "left" | "right";
  icon?: ReactNode;
  c: ColorMap;
}) {
  return (
    <View
      style={{
        width: "50%",
        paddingRight: align === "left" ? 12 : 0,
        paddingLeft: align === "right" ? 12 : 0,
        alignItems: align === "right" ? "flex-end" : "flex-start",
      }}
    >
      <Text style={[s.posCellLabel, { color: c.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={[s.posCellValue, { color: color ?? c.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {icon}
      </View>
      {sub ? (
        <Text style={[s.posCellSub, { color: color ?? c.textMuted }]}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/* ─── Inversión recurrente — DCA CTA ─── */
function RecurringCard({
  asset,
  c,
  onPress,
}: {
  asset: Asset;
  c: ColorMap;
  onPress: () => void;
}) {
  return (
    <View
      style={[
        s.card,
        { marginTop: 16 },
      ]}
    >
      <Text style={[s.cardEyebrow, { color: c.text }]}>
        Inversión recurrente
      </Text>
      <View style={s.recurringRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[s.recurringTitle, { color: c.text }]}>
            Comprá {asset.ticker} de forma automática
          </Text>
          <Text style={[s.recurringBody, { color: c.textMuted }]}>
            Programá montos semanales o mensuales y dejá que el promedio juegue
            a tu favor.
          </Text>
        </View>
        <Tap
          style={[s.recurringCta, { borderColor: c.border }]}
          haptic="light"
          onPress={onPress}
          hitSlop={6}
        >
          <Text style={[s.recurringCtaText, { color: c.text }]}>
            Configurar
          </Text>
          <Feather name="chevron-right" size={16} color={c.text} />
        </Tap>
      </View>
    </View>
  );
}

/* ─── Estadísticas en grid 2-col ─── */
function StatsGrid({ asset, c }: { asset: Asset; c: ColorMap }) {
  const rows = useMemo(() => stats(asset), [asset]);
  // Render 2 por fila — si quedan impares, la última celda derecha
  // queda vacía pero ocupa el espacio para no romper el grid.
  const pairs: Array<[(typeof rows)[number], (typeof rows)[number] | null]> = [];
  for (let i = 0; i < rows.length; i += 2) {
    pairs.push([rows[i], rows[i + 1] ?? null]);
  }
  return (
    <View
      style={[
        s.card,
        { marginTop: 16 },
      ]}
    >
      <Text style={[s.cardEyebrow, { color: c.text }]}>Estadísticas</Text>
      {pairs.map(([left, right], i) => (
        <View
          key={i}
          style={[
            s.statsGridRow,
            i < pairs.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: c.border,
            },
          ]}
        >
          <View style={s.statsCell}>
            <Text style={[s.statsLabel, { color: c.textMuted }]}>
              {left.label}
            </Text>
            <Text style={[s.statsValue, { color: c.text }]} numberOfLines={1}>
              {left.value}
            </Text>
          </View>
          <View style={s.statsCell}>
            {right ? (
              <>
                <Text style={[s.statsLabel, { color: c.textMuted }]}>
                  {right.label}
                </Text>
                <Text
                  style={[s.statsValue, { color: c.text }]}
                  numberOfLines={1}
                >
                  {right.value}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Resultados trimestrales — dot chart simple ─── */
/* ─── Dot diagonal mitad/mitad — para el legend "Reportado" porque el
 *     valor real puede ser positivo (verde) o negativo (rojo). El
 *     `idSuffix` evita colisión de id en SVG si hay múltiples instancias. */
function SplitDot({
  size = 10,
  leftColor,
  rightColor,
  idSuffix,
}: {
  size?: number;
  leftColor: string;
  rightColor: string;
  idSuffix: string;
}) {
  const r = size / 2;
  const clipId = `split-${idSuffix}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={r} cy={r} r={r} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <SvgPath d={`M 0 0 L ${size} 0 L 0 ${size} Z`} fill={leftColor} />
        <SvgPath
          d={`M ${size} 0 L ${size} ${size} L 0 ${size} Z`}
          fill={rightColor}
        />
      </G>
    </Svg>
  );
}

/** Formatea EPS — siempre 2 decimales con coma es-AR y signo $. */
function fmtEps(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toFixed(2).replace(".", ",")}`;
}

function EarningsCard({ asset, c }: { asset: Asset; c: ColorMap }) {
  const data = useMemo(() => mockEarnings(asset.ticker), [asset.ticker]);
  // Hold-to-show: la bubble solo aparece mientras el usuario tiene el
  // dedo apretado sobre el chart. Al soltar, desaparece. Default null
  // = sin bubble.
  const [pressedIdx, setPressedIdx] = useState<number | null>(null);
  const cur = assetCurrency(asset);
  const fmtAmt = (n: number): string => {
    const sign = n < 0 ? "−" : "";
    const num = Math.abs(n).toFixed(2).replace(".", ",");
    if (cur === "USD") return `${sign}${num} US$`;
    if (cur === "USDT") return `${sign}${num} USDT`;
    return `${sign}$ ${num}`;
  };

  // Chart contenido dentro del card padding — mismos márgenes que las
  // stats de arriba (no más bleed-out). chartW = screenWidth - 48
  // matchea el card content width. padX = 36 da espacio para Y-axis
  // labels; padXRight chico porque no hay nada más a la derecha.
  const { width: screenWidth } = useWindowDimensions();
  const chartW = screenWidth - 48;
  const chartH = 150;
  // padX = 72: primer dot con respiro del Y-axis label area.
  // padXRight = 56: gap del último dot al borde derecho.
  // (Volví al estado "perfecto, estamos bien" del usuario.)
  const yAxisLabelX = 28;
  const padX = 72;
  const padXRight = 56;
  const padTop = 14;
  const padBot = 38;
  const allValues = data.flatMap((d) => [d.expected, d.actual]);
  // Y-axis tight: usamos solo el rango real de los datos + 15% de
  // padding arriba/abajo. Antes forzábamos 0 al rango, lo que
  // desperdiciaba espacio vertical cuando todos los valores eran
  // negativos. Con range tight, la distancia visual entre expected
  // y actual se nota mucho más en pantalla.
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const dataRange = Math.max(dataMax - dataMin, 0.5);
  const yPad = dataRange * 0.15;
  const min = dataMin - yPad;
  const max = dataMax + yPad;
  const range = max - min || 1;
  const ySpan = chartH - padTop - padBot;
  const xStep = (chartW - padX - padXRight) / (data.length - 1);
  const yFor = (v: number) =>
    padTop + ySpan - ((v - min) / range) * ySpan;
  const zeroY = yFor(0);
  const yAxisTicks = [0, 1, 2, 3].map((i) => {
    const t = i / 3;
    return { value: max - t * range, y: padTop + t * ySpan };
  });

  const isHolding = pressedIdx !== null;
  // Cuando NO está holdeando, el "actual" default es el último
  // trimestre reportado (data.length - 1) — para mostrar info del
  // último reportado en la columna derecha por default.
  const lastReportedIdx = data.length - 1;
  const activeIdx = pressedIdx ?? lastReportedIdx;
  const active = data[activeIdx];
  const actBeat = active.actual >= active.expected;
  const actDiff = active.actual - active.expected;
  const actDiffPct =
    active.expected !== 0 ? (actDiff / Math.abs(active.expected)) * 100 : 0;
  const actDiffColor = actBeat ? c.brand : c.red;
  const actDiffSign = actDiff >= 0 ? "+" : "−";
  const next = useMemo(() => mockNextEarning(asset.ticker), [asset.ticker]);

  const handlePressIn = (locationX: number) => {
    const localX = locationX - padX;
    const idx = Math.round(localX / xStep);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setPressedIdx(clamped);
    Haptics.selectionAsync().catch(() => {});
  };
  const handleMove = (locationX: number) => {
    const localX = locationX - padX;
    const idx = Math.round(localX / xStep);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    if (clamped !== pressedIdx) {
      setPressedIdx(clamped);
      Haptics.selectionAsync().catch(() => {});
    }
  };
  const handleRelease = () => {
    setPressedIdx(null);
  };

  return (
    <View style={[s.card, { marginTop: 16 }]}>
      <Text style={[s.cardEyebrow, { color: c.text }]}>
        Resultados trimestrales
      </Text>
      <View style={{ width: chartW, alignSelf: "center", paddingTop: 4 }}>
        <View style={{ position: "relative", width: chartW, height: chartH }}>
          <Pressable
            onPressIn={(e) => handlePressIn(e.nativeEvent.locationX)}
            onTouchMove={(e) => handleMove(e.nativeEvent.locationX)}
            onPressOut={handleRelease}
          >
            <Svg width={chartW} height={chartH}>
              {/* Eje Y — 4 ticks de label numérico al margen izquierdo. */}
              {/* Gridlines horizontales sutiles a la altura de cada
                  Y-axis tick. 6% de opacidad — apenas se ven, dan
                  estructura sin invadir. */}
              {yAxisTicks.map((tick, i) => (
                <SvgLine
                  key={`grid-${i}`}
                  x1={yAxisLabelX + 6}
                  x2={chartW - 4}
                  y1={tick.y}
                  y2={tick.y}
                  stroke={c.text}
                  strokeWidth={0.5}
                  strokeOpacity={0.06}
                />
              ))}
              {yAxisTicks.map((tick, i) => (
                <SvgText
                  key={`y-${i}`}
                  x={yAxisLabelX}
                  y={tick.y + 3}
                  fontSize={10}
                  fill={c.textMuted}
                  textAnchor="end"
                  fontFamily={fontFamily[500]}
                >
                  {tick.value.toFixed(2).replace(".", ",")}
                </SvgText>
              ))}
              {/* Línea de cero — solo si el rango la incluye. */}
              {min < 0 && max > 0 ? (
                <SvgLine
                  x1={padX - 4}
                  x2={chartW - padXRight + 4}
                  y1={zeroY}
                  y2={zeroY}
                  stroke={c.border}
                  strokeWidth={0.6}
                  strokeDasharray="2,3"
                />
              ) : null}
              {data.map((d, i) => {
                const x = padX + i * xStep;
                const beat = d.actual >= d.expected;
                const isSelected = isHolding && i === activeIdx;
                const actualColor = beat ? c.brand : c.red;
                // Split del label "Q3 FY24" → ["Q3", "FY24"] para
                // renderearlo en 2 líneas en el eje X.
                const [quarter, fy] = d.label.split(" ");
                return (
                  <Fragment key={d.label}>
                    {isSelected ? (
                      <>
                        <Circle
                          cx={x}
                          cy={yFor(d.expected)}
                          r={12}
                          fill="none"
                          stroke={c.textFaint}
                          strokeWidth={1.4}
                        />
                        <Circle
                          cx={x}
                          cy={yFor(d.actual)}
                          r={12}
                          fill="none"
                          stroke={actualColor}
                          strokeWidth={1.4}
                        />
                      </>
                    ) : null}
                    <Circle
                      cx={x}
                      cy={yFor(d.expected)}
                      r={7}
                      fill={c.textFaint}
                    />
                    <Circle
                      cx={x}
                      cy={yFor(d.actual)}
                      r={8}
                      fill={actualColor}
                    />
                    {/* X-axis: 2 líneas — quarter arriba, FY abajo */}
                    <SvgText
                      x={x}
                      y={chartH - 18}
                      fontSize={10}
                      fill={isSelected ? c.text : c.textMuted}
                      textAnchor="middle"
                      fontFamily={
                        isSelected ? fontFamily[700] : fontFamily[500]
                      }
                    >
                      {quarter}
                    </SvgText>
                    <SvgText
                      x={x}
                      y={chartH - 6}
                      fontSize={10}
                      fill={c.textMuted}
                      textAnchor="middle"
                      fontFamily={fontFamily[500]}
                    >
                      {fy}
                    </SvgText>
                  </Fragment>
                );
              })}
            </Svg>
          </Pressable>

        </View>

        {/* Info row inferior — 2 columnas (Esperado | Reportado) que
            actualizan en vivo con el hold del usuario. Sin hold:
            Esperado muestra "—", Reportado muestra cuándo es el
            próximo earning. Con hold: ambos columns muestran los
            valores del trimestre tocado, con el label del trimestre
            explícito al lado de "Esperado · Q3 FY25". */}
        <View style={s.earningsInfo}>
          <View style={s.earningsInfoCol}>
            <View style={s.earningsInfoHeader}>
              <View
                style={[s.earningsInfoDot, { backgroundColor: c.textFaint }]}
              />
              <Text style={[s.earningsInfoLabel, { color: c.textMuted }]}>
                {isHolding ? `Esperado · ${active.label}` : "Esperado"}
              </Text>
            </View>
            <Text style={[s.earningsInfoVal, { color: c.text }]}>
              {isHolding ? fmtAmt(active.expected) : "—"}
            </Text>
          </View>
          <View style={s.earningsInfoCol}>
            <View style={s.earningsInfoHeader}>
              {isHolding ? (
                // Holding: dot sólido del color del beat/miss del
                // trimestre activo — verde si superó, rojo si no.
                <View
                  style={[
                    s.earningsInfoDot,
                    { backgroundColor: actDiffColor },
                  ]}
                />
              ) : (
                // Default: dot mitad/mitad porque el próximo earning
                // todavía no se sabe si va a ser positivo o negativo.
                <SplitDot
                  size={10}
                  leftColor={c.brand}
                  rightColor={c.red}
                  idSuffix={`info-${asset.ticker}`}
                />
              )}
              <Text style={[s.earningsInfoLabel, { color: c.textMuted }]}>
                {isHolding ? `Reportado · ${active.label}` : "Reportado"}
              </Text>
            </View>
            {isHolding ? (
              <>
                <Text style={[s.earningsInfoVal, { color: c.text }]}>
                  {fmtAmt(active.actual)}
                </Text>
                <Text style={[s.earningsInfoSub, { color: actDiffColor }]}>
                  {actDiffSign}
                  {fmtAmt(Math.abs(actDiff))} ({formatPct(actDiffPct)})
                </Text>
              </>
            ) : (
              <>
                <Text style={[s.earningsInfoVal, { color: c.text }]}>
                  Próximo · {next.date}
                </Text>
                <Text
                  style={[s.earningsInfoSub, { color: c.textMuted }]}
                >
                  {next.session}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

/* ─── Te puede interesar — carrusel horizontal ─── */
function RelatedCarousel({
  asset,
  c,
  onTap,
}: {
  asset: Asset;
  c: ColorMap;
  onTap: (ticker: string) => void;
}) {
  const items = useMemo(() => relatedAssets(asset), [asset]);
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={[s.sectionEyebrow, { color: c.text, marginBottom: 6 }]}
      >
        Quienes compran {asset.ticker} también tienen
      </Text>
      <Text style={[s.sectionSubtext, { color: c.textMuted }]}>
        Armada con las carteras de inversores de Álamos que también tienen
        {" "}
        {asset.ticker}. No constituye una recomendación de inversión.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.carouselScroll}
        snapToInterval={172 + 12}
        decelerationRate="fast"
      >
        {items.map((a) => {
          const up = a.change >= 0;
          const tone = up ? c.brand : c.red;
          return (
            <Tap
              key={a.ticker}
              style={[
                s.relatedCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
              haptic="selection"
              pressScale={0.97}
              onPress={() => onTap(a.ticker)}
            >
              <View style={s.relatedHeader}>
                <Text style={[s.relatedTicker, { color: c.text }]}>
                  {a.ticker}
                </Text>
                <Text
                  style={[s.relatedName, { color: c.textMuted }]}
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
              </View>
              <View style={{ height: 44, marginTop: 10, marginBottom: 8 }}>
                <MiniSparkline
                  series={seriesFromSeed(a.ticker, 50, up ? "up" : "down")}
                  color={up ? c.dataGreen : c.red}
                  width={156}
                  height={44}
                  strokeWidth={1.4}
                />
              </View>
              <View style={s.relatedFooter}>
                <Text style={[s.relatedPrice, { color: c.text }]}>
                  {formatMoney(a.price, assetCurrency(a))}
                </Text>
                <Text style={[s.relatedDelta, { color: tone }]}>
                  {formatPct(a.change)}
                </Text>
              </View>
            </Tap>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ─── Noticias del activo ─── */
/* ─── Briefing AI ─────────────────────────────────────────────
 *
 * Card que vive debajo del chart con un resumen AI-powered del
 * activo. Texto en el color del chart (mismo lenguaje cromático
 * que el resto del detail — verde si rangeUp, rojo si losses).
 * Tap → abre la página completa /(app)/briefing?ticker=X.
 *
 * Layout:
 *   [Briefing →]                        ← título + arrow
 *   [resumen ~4 líneas en tone]
 *   [Actualizado hace X · AI-powered]   ← footer muted
 */
function BriefingCard({
  asset,
  up,
  pct,
  c,
}: {
  asset: Asset;
  up: boolean;
  pct: number;
  c: ColorMap;
}) {
  const router = useRouter();
  const briefing = useMemo(() => briefingFor(asset.ticker), [asset.ticker]);
  // Tone canónico: c.brand (#00C805 idéntico en light + dark) si
  // el chart está up; c.red si está en losses. Sigue rangeUp del
  // chart — no asset.change — porque el usuario asocia el color
  // del briefing al estado VISIBLE del chart, no al delta diario.
  const tone = up ? c.brand : c.red;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        router.push({
          pathname: "/(app)/briefing",
          // Pasamos el `up` y el `pct` para que la página completa
          // use el mismo tone + variación que el chart en el detail
          // (rangeUp / pctForRange), no el delta diario del asset.
          params: {
            ticker: asset.ticker,
            up: up ? "1" : "0",
            pct: pct.toFixed(2),
          },
        });
      }}
      style={({ pressed }) => [
        s.card,
        { marginTop: 16, opacity: pressed ? 0.86 : 1 },
      ]}
    >
      <View style={s.briefingHead}>
        <Text style={[s.briefingHeadText, { color: tone }]}>
          Briefing
        </Text>
        <Feather name="arrow-right" size={18} color={tone} />
      </View>
      <Text
        style={[s.briefingSummary, { color: c.text }]}
        numberOfLines={4}
      >
        {briefing.summary}
      </Text>
      <Text style={[s.briefingMeta, { color: c.textMuted }]}>
        Actualizado {formatBriefingAge(briefing.updatedAt)} · AI-powered
      </Text>
    </Pressable>
  );
}

function NewsCard({ asset, c }: { asset: Asset; c: ColorMap }) {
  const items = useMemo(() => mockNews(asset), [asset]);
  return (
    <View
      style={[
        s.card,
        { marginTop: 16 },
      ]}
    >
      <Text style={[s.cardEyebrow, { color: c.text }]}>Noticias</Text>
      {items.map((n, i) => (
        <View
          key={n.id}
          style={[
            s.newsRow,
            i < items.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: c.border,
            },
          ]}
        >
          <Text style={[s.newsHeadline, { color: c.text }]} numberOfLines={2}>
            {n.headline}
          </Text>
          <View style={s.newsMetaRow}>
            <Text style={[s.newsMeta, { color: c.textMuted }]}>{n.source}</Text>
            <Text style={[s.newsMetaSep, { color: c.textFaint }]}>·</Text>
            <Text style={[s.newsMeta, { color: c.textMuted }]}>{n.ago}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Movimientos del usuario en este activo ─── */
function HistoryCard({ asset, c }: { asset: Asset; c: ColorMap }) {
  const items = useMemo(() => mockHistory(asset), [asset]);
  const cur = assetCurrency(asset);
  const fmt = (n: number) => formatMoney(n, cur);
  if (items.length === 0) return null;
  return (
    <View
      style={[
        s.card,
        { marginTop: 16 },
      ]}
    >
      <Text style={[s.cardEyebrow, { color: c.text }]}>
        Tus movimientos
      </Text>
      {items.map((h, i) => {
        const sideLabel =
          h.side === "buy"
            ? "Compra"
            : h.side === "sell"
            ? "Venta"
            : "Dividendo";
        const isBuy = h.side === "buy";
        const isSell = h.side === "sell";
        const isDiv = h.side === "dividend";
        const sideColor = isDiv ? c.brand : isSell ? c.red : c.text;
        return (
          <View
            key={h.id}
            style={[
              s.historyRow,
              i < items.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: c.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.historyTitle, { color: sideColor }]}>
                {sideLabel}
              </Text>
              <Text style={[s.historySub, { color: c.textMuted }]}>
                {isDiv
                  ? "Cobrado"
                  : `${h.qty} ${h.qty === 1 ? "unidad" : "unidades"} · ${fmt(h.price)}`}
                {" · "}
                {h.date}
              </Text>
            </View>
            <Text style={[s.historyAmount, { color: c.text }]}>
              {isBuy ? "−" : "+"}
              {fmt(isDiv ? h.price : h.qty * h.price)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ─── Sobre la empresa — descripción + metadata factual ─── */
function AboutCard({ asset, c }: { asset: Asset; c: ColorMap }) {
  const [expanded, setExpanded] = useState(false);
  const meta = useMemo(() => companyMeta(asset.ticker), [asset.ticker]);
  const isCompany =
    asset.category === "acciones" || asset.category === "cedears";
  return (
    <View style={[s.card, { marginTop: 16 }]}>
      <Text style={[s.cardEyebrow, { color: c.text }]}>
        Sobre {asset.name}
      </Text>
      <Text
        style={[s.aboutText, { color: c.textSecondary }]}
        numberOfLines={expanded ? undefined : 3}
      >
        {aboutText(asset.category)}
      </Text>
      <Tap
        onPress={() => setExpanded((v) => !v)}
        haptic="selection"
        hitSlop={6}
        style={{ marginTop: 8, alignSelf: "flex-start" }}
      >
        <Text style={[s.aboutToggle, { color: c.text }]}>
          {expanded ? "Mostrar menos" : "Leer más"}
        </Text>
      </Tap>

      {isCompany && meta ? (
        <View style={{ marginTop: 20 }}>
          <MetaRow label="CEO" value={meta.ceo} c={c} />
          <MetaRow label="Fundada" value={meta.founded} c={c} />
          <MetaRow label="Sede" value={meta.hq} c={c} />
          <MetaRow label="Empleados" value={meta.employees} c={c} />
          <MetaRow label="Industria" value={meta.industry} c={c} />
        </View>
      ) : null}
    </View>
  );
}

function MetaRow({
  label,
  value,
  c,
}: {
  label: string;
  value: string;
  c: ColorMap;
}) {
  return (
    <View style={s.metaRow}>
      <Text style={[s.metaLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[s.metaValue, { color: c.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    flex: 1,
    alignItems: "center",
  },
  /* Sticky overlay — absolute, span left:0 right:0 → centro real
   * de la pantalla. Independiente del ancho de los íconos
   * laterales (back izquierda, alert+watchlist derecha). El
   * `top` lo seteo inline desde insets.top + paddingTop del bar
   * para alinear vertically con la fila de íconos. */
  stickyOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyPrice: {
    fontFamily: fontFamily[500],
    fontSize: 17,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  stickyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginTop: 1,
  },
  stickyTicker: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0,
  },
  stickyDot: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    opacity: 0.6,
  },
  stickyPct: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.05,
  },
  topTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  topSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 1,
  },
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  heroPriceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 12,
  },
  heroPriceBadge: {
    /* Alineado con el top de los decimales/sufijo del AmountDisplay.
       Para size=52, AmountDisplay calcula decMargin = round(size*0.14)
       = 7, así el icono arranca exactamente donde arranca el "US$" o
       los centavos, no a media altura del integer. */
    marginTop: 7,
  },
  heroTicker: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  heroName: {
    fontFamily: fontFamily[700],
    fontSize: 30,
    letterSpacing: -0.7,
    lineHeight: 34,
    marginTop: 2,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  deltaTri: {
    fontFamily: fontFamily[700],
    fontSize: 12,
  },
  deltaText: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    paddingHorizontal: 4,
  },
  rangePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: 0.3,
  },
  positionCard: {
    marginHorizontal: 20,
    marginTop: 24,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  cardEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  positionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  positionLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  positionValue: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.7,
  },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
    paddingTop: 16,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  statLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  statValue: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  aboutCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  aboutText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  /* ─── Sección full-width (sin chrome de card) ─── */
  card: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },

  /* ─── Tu posición (grid 2x3) ─── */
  posGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
  },
  posCellLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  posCellValue: {
    fontFamily: fontFamily[700],
    fontSize: 19,
    letterSpacing: -0.4,
  },
  posCellSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 3,
  },

  /* ─── Inversión recurrente ─── */
  recurringRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  recurringTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  recurringBody: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  recurringCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  recurringCtaText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.2,
  },

  /* ─── Estadísticas grid 2-col — label izquierda / valor derecha
   *     dentro de cada celda. Layout key-value compacto. */
  statsGridRow: {
    flexDirection: "row",
    paddingVertical: 15,
    gap: 32,
  },
  statsCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statsLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  statsValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },

  /* ─── Earnings dot chart ─── */
  legendRow: {
    flexDirection: "row",
    gap: 18,
    marginTop: 18,
    alignSelf: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* ─── Burbuja flotante sobre el chart de earnings ─── */
  earningsBubble: {
    position: "absolute",
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  earningsBubbleHeader: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  earningsBubbleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 1,
    gap: 8,
  },
  earningsBubbleLabel: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.1,
  },
  earningsBubbleVal: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  earningsBubbleLine: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
    lineHeight: 17,
    textAlign: "center",
    marginVertical: 1,
  },
  earningsBubbleKvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
    gap: 8,
  },
  earningsBubbleKvLabel: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },
  earningsBubbleKvValue: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
    flexShrink: 1,
    textAlign: "right",
  },
  earningsCaret: {
    position: "absolute",
    width: 10,
    height: 10,
    transform: [{ rotate: "45deg" }],
  },

  /* ─── Info row inferior del earnings (2-col Esperado | Reportado) ─── */
  earningsInfo: {
    flexDirection: "row",
    marginTop: 16,
    paddingTop: 16,
    paddingLeft: 6,
    gap: 16,
  },
  earningsInfoCol: {
    flex: 1,
  },
  earningsInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  earningsInfoDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  earningsInfoLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  earningsInfoVal: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  earningsInfoSub: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 2,
  },

  /* ─── Detalle del trimestre seleccionado en EarningsCard (legacy) ─── */
  earningsDetail: {
    flexDirection: "row",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  earningsCol: {
    flex: 1,
  },
  earningsKey: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  earningsVal: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  earningsPct: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },

  /* ─── Te puede interesar (carrusel) ─── */
  sectionEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 16,
    marginHorizontal: 24,
  },
  sectionSubtext: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  carouselScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  relatedCard: {
    width: 156,
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
  },
  relatedHeader: {
    minHeight: 36,
  },
  relatedTicker: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  relatedName: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  relatedDelta: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.2,
  },

  /* ─── Briefing AI ─── */
  briefingHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  briefingHeadText: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
  },
  briefingSummary: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  briefingMeta: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
  },

  /* ─── Noticias ─── */
  newsRow: {
    paddingVertical: 12,
  },
  newsHeadline: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  newsMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  newsMeta: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: 0.1,
  },
  newsMetaSep: {
    fontFamily: fontFamily[500],
    fontSize: 11,
  },

  /* ─── Tus movimientos ─── */
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  historyTitle: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  historySub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  historyAmount: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },

  /* ─── Resultado del día / total — fila full-width ─── */
  returnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  returnLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  returnValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
  },

  /* ─── About metadata ─── */
  aboutToggle: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    gap: 16,
  },
  metaLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  metaValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
    flexShrink: 1,
    textAlign: "right",
  },

  /* ─── Related card footer (price + delta) ─── */
  relatedFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  relatedPrice: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },

  /* ─── Disclaimer ─── */
  disclaimer: {
    marginTop: 24,
    marginHorizontal: 20,
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
});
