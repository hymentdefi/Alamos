import { useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { fontFamily, radius, useTheme } from "../../lib/theme";
import {
  assets,
  assetCurrency,
  assetMarket,
  formatMoney,
  formatPct,
  type Asset,
} from "../../lib/data/assets";
import { convertAmount } from "../../lib/data/accounts";
import {
  Sparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";
import { AiCommentaryCard } from "../../lib/components/AiCommentaryCard";
import { AmountDisplay } from "../../lib/components/AmountDisplay";
import { CobrosSection } from "../../lib/components/CobrosSection";
import { Tap } from "../../lib/components/Tap";
import { Tier1StatsBento } from "../../lib/components/Tier1StatsBento";
import {
  computeLifetimeInvertido,
  computeTier2Stats,
  getTier1Stats,
} from "../../lib/data/portfolioStats";
import { AssetColorProvider } from "../../lib/asset-color/context";

/**
 * Pantalla dedicada de Rendimiento — accedida desde el arrow del
 * InfoRow del first-block del portfolio. Acá vive el detalle completo
 * de la performance histórica:
 *   - Hero metric: ganancia absoluta + % + período seleccionado.
 *   - Sparkline grande (height 180) con scrub habilitado.
 *   - Range pills 1D/1W/1M/3M/YTD/1A/MAX.
 *   - Stats grid 2×3: total invertido, YTD, mejor/peor mes, promedio
 *     mensual, días positivos.
 *
 * Mock determinístico — los rangePcts vienen de la misma tabla que
 * el portfolio (RENDIMIENTO_PCTS local). En producción vendrían del
 * server-side calc de TWR/MWR.
 */

type Currency = "ARS" | "USD";

type RendRange = "1D" | "1W" | "1M" | "3M" | "YTD" | "1A" | "MAX";

const RENDIMIENTO_RANGES: RendRange[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "YTD",
  "1A",
  "MAX",
];

const RENDIMIENTO_PCTS: Record<RendRange, number> = {
  "1D": 0.6,
  "1W": 0.6,
  "1M": 1.8,
  "3M": 4.2,
  "YTD": 8.4,
  "1A": 10.8,
  "MAX": 12.4,
};

const RENDIMIENTO_LENGTHS: Record<RendRange, number> = {
  "1D": 100,
  "1W": 70,
  "1M": 80,
  "3M": 140,
  "YTD": 220,
  "1A": 240,
  "MAX": 300,
};

function rendPeriodLabel(r: RendRange): string {
  switch (r) {
    case "1D":
      return "hoy";
    case "1W":
      return "esta semana";
    case "1M":
      return "último mes";
    case "3M":
      return "últimos 3 meses";
    case "YTD":
      return "este año";
    case "1A":
      return "último año";
    case "MAX":
      return "desde marzo 2025";
  }
}

function buildSeries(
  start: number,
  end: number,
  length: number,
  seed: string,
): number[] {
  const noise = seriesFromSeed(seed, length, "flat");
  const delta = end - start;
  /* Cap el noise para que NUNCA tape el trend. Antes era end * 0.012
   * (fijo); con deltas chicos como 1D (~1%) el ruido por punto
   * superaba al trend y series[0] terminaba aleatoriamente arriba
   * o abajo del start real → ganancia con signo random → chart en
   * verde mientras matemáticamente era negativo. Ahora el ruido se
   * limita a 30% de |delta|. */
  const noiseScale = Math.min(
    Math.abs(end) * 0.012,
    Math.abs(delta) * 0.3,
  );
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const linear = start + delta * t;
    const normalized = (noise[i] - 100) / 6;
    out.push(linear + normalized * noiseScale);
  }
  /* Anchors fijos en ambos puntas. Sin esto, series[0] flotaba con
   * el ruido y la diferencia con current quedaba contaminada. */
  out[0] = start;
  out[length - 1] = end;
  return out;
}

export default function RendimientoScreen() {
  const router = useRouter();
  /* Ref del ScrollView + Y measured de la sección Cobros para
   * auto-scrollear ahí cuando el user selecciona una barra del mes
   * (UX: que el detalle del mes seleccionado quede arriba de todo
   * sin tener que scrollear manualmente). */
  const scrollRef = useRef<ScrollView>(null);
  const cobrosY = useRef(0);
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  /* Default 1D — el user entra a esta pantalla desde el row de
   * Rendimiento del portfolio (que muestra el PyG del día), así que
   * el primer estado natural es ver el mismo período. */
  const [range, setRange] = useState<RendRange>("1D");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [currency] = useState<Currency>("ARS");

  // Total ARS + delta del día — replica el cómputo del portfolio
  // (incluyendo el FORCE_LOSS_PREVIEW que fuerza naranja para preview
  // visual). Mantener en sync con portfolio.tsx hasta que el flag se
  // saque. Sin esto, la pantalla mostraba 1D en verde mientras
  // portfolio mostraba el mismo período en naranja.
  const { totalArs, dayPct } = useMemo(() => {
    const holdings = assets.filter(
      (a: Asset) =>
        a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    );
    let total = 0;
    let realDay = 0;
    for (const a of holdings) {
      const native = a.price * (a.qty ?? 0);
      const ars = convertAmount(native, assetCurrency(a), "ARS");
      total += ars;
      realDay += ars * (a.change / 100);
    }
    /* FORCE_LOSS_PREVIEW: sync con portfolio.tsx — sacar cuando se
     * desactive ese flag. */
    const FORCE_LOSS_PREVIEW = true;
    const daySumArs = FORCE_LOSS_PREVIEW
      ? -Math.abs(realDay || 1)
      : realDay;
    const yesterdayArs = total - daySumArs;
    const pct = yesterdayArs > 0 ? (daySumArs / yesterdayArs) * 100 : 0;
    return { totalArs: total, dayPct: pct };
  }, []);

  const totalDisplay =
    currency === "ARS" ? totalArs : convertAmount(totalArs, "ARS", currency);
  /* Para 1D usamos el % real del día computado arriba (mismo que
   * portfolio); para el resto, el mock de RENDIMIENTO_PCTS. */
  const rangePct = range === "1D" ? dayPct : RENDIMIENTO_PCTS[range];
  const invertido = totalDisplay / (1 + rangePct / 100);

  const series = useMemo(
    () =>
      buildSeries(
        invertido,
        totalDisplay,
        RENDIMIENTO_LENGTHS[range],
        `rend-${range}-${currency}`,
      ),
    [invertido, totalDisplay, range, currency],
  );

  const current =
    scrubIndex != null ? series[scrubIndex] : series[series.length - 1];
  const startVal = series[0];
  const ganancia = current - startVal;
  const gananciaPct = startVal > 0 ? (ganancia / startVal) * 100 : 0;
  const up = ganancia >= 0;
  const color = up ? c.brand : c.red;
  /* Mismo split que el chart del Inicio: el "chart" pill / arrows usan
   * el verde brand vibrante; la línea del Sparkline usa dataGreen
   * (en light coincide con brand, en dark es el verde más amigable). */
  const sparklineColor = up ? c.dataGreen : c.red;

  /* toDisplay para el Tier1StatsBento — convierte ARS al display
   * currency (alineado con cómo el screen ya convierte totalArs y
   * el resto de las cifras). */
  const toDisplay = useMemo(
    () =>
      (ars: number) =>
        currency === "ARS" ? ars : convertAmount(ars, "ARS", currency),
    [currency],
  );

  /* Tier 1 + Tier 2 stats para el AI Commentary que vive entre los
   * range pills y el Tier 1 bento. El bento tiene su propio cómputo
   * interno de Tier 1 (vía computeTier1Stats) — acá necesitamos
   * el shape completo para alimentar el commentary. */
  const tier1Stats = useMemo(
    () => getTier1Stats(range, toDisplay),
    [range, toDisplay],
  );
  const tier2Stats = useMemo(
    () => computeTier2Stats(range, toDisplay),
    [range, toDisplay],
  );
  const fmtAmount = (n: number) => formatMoney(n, currency);

  return (
    <AssetColorProvider up={up}>
      <View style={[s.root, { backgroundColor: c.bg }]}>
        {/* Header — back arrow + title. Mismo lenguaje que detail.tsx */}
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <Tap
            onPress={() => router.back()}
            haptic="selection"
            hitSlop={12}
            style={s.iconBtn}
          >
            <Feather name="arrow-left" size={24} color={c.text} />
          </Tap>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.heroBlock}>
            {/* Title "Rendimiento" — mismo tamaño que "Portfolio" en
                la tab de Cartera (32pt), peso fontFamily[800] como
                "Briefing" del stock detail. Color tone: brand cuando
                el rendimiento es positivo, naranja (c.red) cuando
                es negativo. */}
            <Text style={[s.heroTitle, { color }]}>Rendimiento</Text>

            <View style={s.heroAmountRow}>
              <Text style={[s.tri, { color }]}>{up ? "▲" : "▼"}</Text>
              <AmountDisplay
                value={Math.abs(ganancia)}
                size={42}
                color={color}
                decimalsColor={color}
                currency={currency}
              />
            </View>
            <View style={s.subRow}>
              <Text style={[s.subPct, { color }]}>
                {formatPct(gananciaPct)}
              </Text>
              <Text style={[s.subPeriod, { color: c.textMuted }]}>
                · {rendPeriodLabel(range)}
              </Text>
            </View>
          </View>

          <View style={s.chartWrap}>
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
              onScrub={(idx) => setScrubIndex(idx)}
              onScrubEnd={() => setScrubIndex(null)}
            />
          </View>

          <View style={s.rangeRow}>
            {RENDIMIENTO_RANGES.map((r) => {
              const active = r === range;
              const fg = active ? c.bg : color;
              return (
                <Tap
                  key={r}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setRange(r);
                  }}
                  haptic="none"
                  pressScale={0.92}
                  style={[
                    s.rangePill,
                    active && { backgroundColor: color },
                  ]}
                  hitSlop={8}
                >
                  <Text style={[s.rangeText, { color: fg }]}>{r}</Text>
                </Tap>
              );
            })}
          </View>

          {/* AI Portfolio Commentary — análisis narrativo basado en
              las stats Tier 1 + Tier 2 del período seleccionado.
              Vive acá entre los range pills y el Tier 1 bento: la
              narrativa primero (qué pasó y por qué), después los
              números (cómo se descompone). */}
          <AiCommentaryCard
            range={range}
            tier1={tier1Stats}
            tier2={tier2Stats}
            formatAmount={fmtAmount}
          />

          {/* Tier 1 stats — bento grid de 8 cards según la spec
              interna (Portfolio Statistics Engine v1.0). Tap a una
              card abre el StatInfoSheet con el nombre técnico +
              explicación retail. */}
          <Tier1StatsBento
            range={range}
            currency={currency}
            totalInvertido={computeLifetimeInvertido(totalDisplay)}
            gananciaAbs={ganancia}
            twrPct={rangePct}
            totalArs={totalArs}
            toDisplay={toDisplay}
          />

          {/* Entradas Fase 3: "Proyección de tu portfolio" (Monte Carlo)
              + "ADN de tu portfolio" (Factor Exposure). Mismo pattern
              que el BriefingCard de stock detail — título c.brand 22pt
              + arrow-right verde pegado al lado, descripción debajo.
              Labels retail per spec 5.5 + 6.4 — nunca decimos
              "Monte Carlo" o "Factor Exposure" en la UI. */}
          <Tap
            onPress={() => router.push("/proyeccion" as never)}
            haptic="selection"
            pressScale={0.98}
            style={s.sectionLink}
          >
            <View style={s.sectionLinkHead}>
              <Text style={[s.sectionLinkTitle, { color: c.brand }]}>
                Proyección de tu portfolio
              </Text>
              <Feather name="arrow-right" size={20} color={c.brand} />
            </View>
            <Text style={[s.sectionLinkSub, { color: c.textMuted }]}>
              Simulamos miles de escenarios posibles para estimar cómo
              podría crecer tu inversión.
            </Text>
          </Tap>

          <Tap
            onPress={() => router.push("/adn" as never)}
            haptic="selection"
            pressScale={0.98}
            style={s.sectionLink}
          >
            <View style={s.sectionLinkHead}>
              <Text style={[s.sectionLinkTitle, { color: c.brand }]}>
                ADN de tu portfolio
              </Text>
              <Feather name="arrow-right" size={20} color={c.brand} />
            </View>
            <Text style={[s.sectionLinkSub, { color: c.textMuted }]}>
              Analizamos las características principales de tus
              inversiones según distintos factores.
            </Text>
          </Tap>

          {/* Cobros — dividendos, cupones y amortizaciones del
              portfolio. Calendario forward + breakdown del año
              proyectado. Lo que ningún ALyC AR muestra bien. */}
          <View
            onLayout={(e) => {
              cobrosY.current = e.nativeEvent.layout.y;
            }}
          >
            <CobrosSection
              currency={currency}
              onMonthSelect={() => {
                scrollRef.current?.scrollTo({
                  y: cobrosY.current,
                  animated: true,
                });
              }}
            />
          </View>

          <Text style={[s.disclaimer, { color: c.textFaint }]}>
            Cálculo time-weighted (TWR) sobre la valuación diaria del
            portfolio. Los datos históricos son referenciales y se
            actualizan al cierre de cada rueda. Los cobros futuros son
            proyecciones según el cronograma de cada activo y pueden
            variar por decisión del emisor o ajustes fiscales.
          </Text>
        </ScrollView>
      </View>
    </AssetColorProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  /* Title del hero — peso fontFamily[800] como Briefing del stock
   * detail, tamaño 32pt como el "Portfolio" de la tab de Cartera.
   * El color lo dicta el caller según el signo del rendimiento. */
  heroTitle: {
    fontFamily: fontFamily[800],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    marginBottom: 6,
  },
  heroAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tri: {
    fontFamily: fontFamily[700],
    fontSize: 20,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 8,
  },
  subPct: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.2,
  },
  subPeriod: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* Chart wrap — mismo lenguaje que el Inicio: position relative +
   * overflow hidden. El chart ya vive a nivel de ScrollView (sin
   * padding horizontal del padre), así que no necesita marginHorizontal
   * negativo — respira edge-to-edge naturalmente. */
  chartWrap: {
    position: "relative",
    overflow: "hidden",
    marginTop: 18,
  },
  /* Range pills — copia del Inicio: justifyContent space-between,
   * pill con radius.md (no pill 999) y typography más editorial. El
   * paddingHorizontal 28 = 24 (rail estándar) + 4 (offset del Inicio
   * para que las pills no toquen el chart). */
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 0,
    paddingHorizontal: 28,
  },
  rangePill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderCurve: "continuous",
    borderRadius: radius.md,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
  },

  /* ─── Section links "Proyección de tu portfolio" + "ADN" ───
   * Pattern del BriefingCard de stock detail: título + arrow-right
   * tight (gap 6) y descripción debajo. */
  sectionLink: {
    paddingHorizontal: 24,
    marginTop: 28,
    paddingVertical: 4,
  },
  sectionLinkHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  sectionLinkTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
  },
  sectionLinkSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },

  disclaimer: {
    marginTop: 24,
    marginHorizontal: 20,
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
});
