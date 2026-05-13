/**
 * Tier 1 portfolio statistics — el bento grid del Rendimiento.
 *
 * Spec interna define dos capas por métrica: retail (label en español
 * humano) y técnica (nombre formal, fórmula, lectura). Acá computamos
 * los 8 valores del Tier 1 a partir del estado actual del portfolio
 * y un mock determinístico para las que requieren histórico largo
 * (Sharpe, Vol, Max DD, Alpha) que todavía no tenemos en data.
 *
 * Cuando se enchufe el batch nightly de snapshots reales, este
 * archivo es el único punto a tocar — la UI consume el shape de
 * Tier1Stats independientemente de la fuente.
 */

import { generatePayouts, isPaid, MOCK_TODAY } from "./payouts";
import { convertAmount } from "./accounts";
import { assets, assetCurrency, type Asset } from "./assets";

export type Semaforo = "verde" | "amarillo" | "rojo";

/** Range keys del selector global de período. Mantener en sync con
 *  rendimiento.tsx (que es donde nacen). */
export type StatsRange =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "YTD"
  | "1A"
  | "MAX";

/* ─── Shape final de las 8 stats del Tier 1 ───────────────────── */

export interface MoneyStat {
  /** En la moneda de display (la que pasa el caller). */
  amount: number;
  pct: number;
}

export interface RiskStat {
  pct: number;
  semaforo: Semaforo;
}

export interface DrawdownStat {
  pct: number;
  /** Mes/año del peor punto, e.g., "abril 2026". */
  date: string;
  recoveryDays: number;
  semaforo: Semaforo;
}

export interface SharpeStat {
  value: number;
  semaforo: Semaforo;
}

export interface AlphaStat {
  /** Excess return del portfolio sobre el benchmark, en pp. */
  pct: number;
  benchmark: "S&P 500";
  /** % del benchmark en el mismo período, para contextualizar. */
  benchmarkPct: number;
  semaforo: Semaforo;
}

export interface YieldStat {
  /** Yield TTM (last 12M) en %. */
  pct: number;
  /** Monto ya cobrado en el año en curso (display currency). */
  cobradoYtd: number;
}

export interface Tier1Stats {
  totalInvertido: number;
  /** Money-weighted return — refleja timing del user. */
  mwr: MoneyStat;
  /** Time-weighted return — limpio de aportes/retiros. */
  twr: { pct: number };
  /** Volatilidad anualizada. */
  volatility: RiskStat;
  /** Peor caída peak-to-trough. */
  maxDrawdown: DrawdownStat;
  /** Sharpe Ratio. */
  sharpe: SharpeStat;
  /** Alpha vs benchmark. */
  alpha: AlphaStat;
  /** Dividend yield TTM + cobrado YTD. */
  dividendYield: YieldStat;
  /** true cuando el período tiene < 6 meses de historial — la UI
   *  muestra badge "Datos limitados" en las stats sensibles. */
  limitedData: boolean;
}

/* ─── Mocks determinísticos por range ─────────────────────────── */

/* Magnitudes que parecen reales para un portfolio AR-heavy con algo
 * de US + crypto. Los 1D / 1W son chicos, los largos van aumentando.
 * Sharpe sube con el horizon (más datos, menos noise). */
const MOCK_BY_RANGE: Record<
  StatsRange,
  {
    twrPct: number;
    volAnn: number;
    maxDdPct: number;
    maxDdMonth: string;
    recoveryDays: number;
    sharpe: number;
    alphaPct: number;
    benchmarkPct: number;
  }
> = {
  "1D": {
    twrPct: -0.99,
    volAnn: 14.2,
    maxDdPct: 0.99,
    maxDdMonth: "hoy",
    recoveryDays: 0,
    sharpe: 0.42,
    alphaPct: -0.2,
    benchmarkPct: -0.79,
  },
  "1W": {
    twrPct: 0.6,
    volAnn: 13.8,
    maxDdPct: 1.4,
    maxDdMonth: "esta semana",
    recoveryDays: 2,
    sharpe: 0.58,
    alphaPct: 0.1,
    benchmarkPct: 0.5,
  },
  "1M": {
    twrPct: 1.8,
    volAnn: 13.5,
    maxDdPct: 3.2,
    maxDdMonth: "abril 2026",
    recoveryDays: 8,
    sharpe: 0.84,
    alphaPct: 0.4,
    benchmarkPct: 1.4,
  },
  "3M": {
    twrPct: 4.2,
    volAnn: 14.0,
    maxDdPct: 5.8,
    maxDdMonth: "marzo 2026",
    recoveryDays: 12,
    sharpe: 1.12,
    alphaPct: 1.6,
    benchmarkPct: 2.6,
  },
  YTD: {
    twrPct: 8.4,
    volAnn: 14.6,
    maxDdPct: 7.4,
    maxDdMonth: "febrero 2026",
    recoveryDays: 21,
    sharpe: 1.38,
    alphaPct: 2.9,
    benchmarkPct: 5.5,
  },
  "1A": {
    twrPct: 10.8,
    volAnn: 15.1,
    maxDdPct: 8.7,
    maxDdMonth: "octubre 2025",
    recoveryDays: 28,
    sharpe: 1.42,
    alphaPct: 3.2,
    benchmarkPct: 7.6,
  },
  MAX: {
    twrPct: 12.4,
    volAnn: 15.6,
    maxDdPct: 11.2,
    maxDdMonth: "octubre 2025",
    recoveryDays: 28,
    sharpe: 1.46,
    alphaPct: 3.8,
    benchmarkPct: 8.6,
  },
};

/* Umbrales del semáforo según spec. */
function volSemaforo(volPct: number): Semaforo {
  if (volPct < 10) return "verde";
  if (volPct < 20) return "amarillo";
  return "rojo";
}

function ddSemaforo(ddPct: number): Semaforo {
  if (ddPct < 10) return "verde";
  if (ddPct < 25) return "amarillo";
  return "rojo";
}

function sharpeSemaforo(s: number): Semaforo {
  if (s > 1.0) return "verde";
  if (s > 0.5) return "amarillo";
  return "rojo";
}

function alphaSemaforo(a: number): Semaforo {
  return a > 0 ? "verde" : "rojo";
}

/** Para 1D / 1W / 1M la métrica Sharpe es artefacto-prone. Marcamos
 *  "datos limitados" en esos casos. */
function isLimitedRange(range: StatsRange): boolean {
  return range === "1D" || range === "1W" || range === "1M";
}

/* ─── Dividend yield TTM + cobrado YTD (REAL, del data layer) ─── */

function computeYieldFromPayouts(
  totalArs: number,
  toDisplay: (ars: number) => number,
): { yieldTtmPct: number; cobradoYtdDisplay: number } {
  const events = generatePayouts();
  const today = MOCK_TODAY;
  const oneYearAgo = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    today.getDate(),
  );
  const oneYearAgoIso = oneYearAgo.toISOString().slice(0, 10);
  const currentYear = today.getFullYear();

  let ttmArs = 0;
  let ytdArs = 0;
  for (const e of events) {
    const amountArs = convertAmount(e.amount, e.currency, "ARS");
    if (e.date >= oneYearAgoIso) ttmArs += amountArs;
    if (e.date.startsWith(`${currentYear}-`) && isPaid(e)) {
      ytdArs += amountArs;
    }
  }
  const yieldTtmPct = totalArs > 0 ? (ttmArs / totalArs) * 100 : 0;
  return {
    yieldTtmPct,
    cobradoYtdDisplay: toDisplay(ytdArs),
  };
}

/* ─── Helper: total ARS del portfolio (sin efectivo) ──────────── */

/** Suma de holdings convertidos a ARS, excluyendo efectivo. Misma
 *  lógica que rendimiento.tsx — extraído acá para que /estadisticas
 *  y otros consumers del Tier 1/2 puedan computar baseline sin
 *  duplicar código. */
export function computeTotalArs(): number {
  return assets
    .filter(
      (a: Asset) =>
        a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    )
    .reduce((acc, a) => {
      const native = a.price * (a.qty ?? 0);
      return acc + convertAmount(native, assetCurrency(a), "ARS");
    }, 0);
}

/** "Total invertido" lifetime — capital aportado de toda la vida del
 *  portfolio, en moneda de display. Range-invariant: no cambia al
 *  hacer click en otro período. Mock: lo derivamos del retorno MAX
 *  (since launch). En producción = sum of deposits − withdrawals. */
export function computeLifetimeInvertido(totalDisplay: number): number {
  return totalDisplay / (1 + MOCK_BY_RANGE.MAX.twrPct / 100);
}

/** Conveniente para los consumers que solo tienen (range, toDisplay)
 *  y necesitan el shape completo de Tier1Stats sin haber computado
 *  totalArs / invertido / ganancia / twrPct previamente. */
export function getTier1Stats(
  range: StatsRange,
  toDisplay: (ars: number) => number,
): Tier1Stats {
  const totalArs = computeTotalArs();
  const totalDisplay = toDisplay(totalArs);
  const twrPct = MOCK_BY_RANGE[range].twrPct;
  /* invertido del período = valor de partida del período, range
   * dependent. Sirve para computar ganancia del período. */
  const periodInvertido = totalDisplay / (1 + twrPct / 100);
  const ganancia = totalDisplay - periodInvertido;
  /* totalInvertido que se muestra al user es lifetime (range
   * invariant) — no debería cambiar al elegir otro período. */
  return computeTier1Stats({
    range,
    totalInvertido: computeLifetimeInvertido(totalDisplay),
    twrPct,
    gananciaAbs: ganancia,
    totalArs,
    toDisplay,
  });
}

/* ─── Calculadora principal ───────────────────────────────────── */

interface ComputeArgs {
  range: StatsRange;
  /** Total invertido en moneda de display (lo que el user ve). */
  totalInvertido: number;
  /** TWR real del período (el rangePct de rendimiento.tsx). */
  twrPct: number;
  /** Ganancia absoluta del período en moneda de display. */
  gananciaAbs: number;
  /** Total ARS del portfolio (para computar yield TTM real). */
  totalArs: number;
  /** Convertidor ARS → moneda de display (para alinear el cobrado
   *  YTD con el resto de la UI). */
  toDisplay: (ars: number) => number;
}

export function computeTier1Stats(args: ComputeArgs): Tier1Stats {
  const { range, totalInvertido, twrPct, gananciaAbs, totalArs, toDisplay } = args;
  const m = MOCK_BY_RANGE[range];
  /* MWR vs TWR: para un buy-and-hold puro coinciden. Para reflejar
   * timing añadimos un pequeño jitter (~+0.3pp del twr) que sugiere
   * que el user "compró en buen momento". Cuando haya snapshots
   * reales, esto se reemplaza por el IRR Newton-Raphson. */
  const mwrPct = twrPct + Math.sign(twrPct) * 0.3;
  const mwrAbs = gananciaAbs * (1 + 0.3 / Math.max(Math.abs(twrPct), 0.1));

  const { yieldTtmPct, cobradoYtdDisplay } = computeYieldFromPayouts(
    totalArs,
    toDisplay,
  );

  return {
    totalInvertido,
    mwr: { amount: mwrAbs, pct: mwrPct },
    twr: { pct: twrPct },
    volatility: {
      pct: m.volAnn,
      semaforo: volSemaforo(m.volAnn),
    },
    maxDrawdown: {
      pct: m.maxDdPct,
      date: m.maxDdMonth,
      recoveryDays: m.recoveryDays,
      semaforo: ddSemaforo(m.maxDdPct),
    },
    sharpe: {
      value: m.sharpe,
      semaforo: sharpeSemaforo(m.sharpe),
    },
    alpha: {
      pct: m.alphaPct,
      benchmark: "S&P 500",
      benchmarkPct: m.benchmarkPct,
      semaforo: alphaSemaforo(m.alphaPct),
    },
    dividendYield: {
      pct: yieldTtmPct,
      cobradoYtd: cobradoYtdDisplay,
    },
    limitedData: isLimitedRange(range),
  };
}

/* ─── Tier 2 (sub-pantalla /estadisticas) ─────────────────────── */

export interface ReturnsByPeriodRow {
  period: StatsRange;
  twr: number;
  mwr: number;
}

export interface Tier2Stats {
  /** Tabla rendimiento por período (7 filas D/W/M/3M/YTD/1A/MAX). */
  returnsByPeriod: ReturnsByPeriodRow[];
  /* Risk-adjusted */
  sortino: { value: number; semaforo: Semaforo };
  calmar: { value: number; semaforo: Semaforo };
  beta: { value: number; benchmark: "S&P 500"; semaforo: Semaforo };
  /* Benchmark capture */
  upCapture: { pct: number };
  downCapture: { pct: number };
  /* Composición */
  posicionesEfectivas: { value: number; semaforo: Semaforo };
  concentracionTop5: { pct: number; semaforo: Semaforo };
  /* Income breakdown (real, del data layer de payouts) */
  income: {
    cupones: number;
    dividendos: number;
    amortizaciones: number;
    totalYtd: number;
    forward12M: number;
  };
  /* Attribution — qué activos aportaron o restaron al return del
   * período. Pp = puntos porcentuales del return total. */
  attribution: {
    topContributor: { ticker: string; contribPp: number } | null;
    topDetractor: { ticker: string; contribPp: number } | null;
  };
  /* Cash idle — efectivo en cuentas que no está invertido, en
   * moneda de display + % del portfolio total (invertido + cash). */
  cashIdle: {
    display: number;
    pctOfPortfolio: number;
  };
}

/* Magnitudes mock por range. Mismo enfoque que Tier 1: cuando el
 * server-side batch nightly esté listo, este map se reemplaza. */
const TIER2_MOCK_BY_RANGE: Record<
  StatsRange,
  {
    sortino: number;
    calmar: number;
    beta: number;
    upCapture: number;
    downCapture: number;
  }
> = {
  "1D": { sortino: 0.58, calmar: 0.42, beta: 0.92, upCapture: 88, downCapture: 78 },
  "1W": { sortino: 0.72, calmar: 0.54, beta: 0.93, upCapture: 90, downCapture: 80 },
  "1M": { sortino: 1.04, calmar: 0.68, beta: 0.94, upCapture: 92, downCapture: 81 },
  "3M": { sortino: 1.32, calmar: 0.84, beta: 0.95, upCapture: 95, downCapture: 78 },
  YTD: { sortino: 1.58, calmar: 1.04, beta: 0.96, upCapture: 98, downCapture: 76 },
  "1A": { sortino: 1.68, calmar: 1.16, beta: 0.97, upCapture: 102, downCapture: 74 },
  MAX: { sortino: 1.74, calmar: 1.22, beta: 0.97, upCapture: 104, downCapture: 73 },
};

function sortinoSemaforo(v: number): Semaforo {
  if (v > 1.5) return "verde";
  if (v > 0.8) return "amarillo";
  return "rojo";
}

function calmarSemaforo(v: number): Semaforo {
  if (v > 1.0) return "verde";
  if (v > 0.5) return "amarillo";
  return "rojo";
}

/* Beta sweet spot 0.5-1.2 verde; 1.2-1.5 amarillo (más volátil que
 * el mercado); arriba de 1.5 o muy bajo (<0.3) rojo. */
function betaSemaforo(v: number): Semaforo {
  if (v >= 0.5 && v <= 1.2) return "verde";
  if (v > 1.2 && v < 1.5) return "amarillo";
  return "rojo";
}

/* Posiciones efectivas: spec dice > 8 verde, 4-8 amarillo, < 4 rojo. */
function posicionesEfectivasSemaforo(n: number): Semaforo {
  if (n > 8) return "verde";
  if (n > 4) return "amarillo";
  return "rojo";
}

/* Top-5 concentration: < 40% verde, 40-60% amarillo, > 60% rojo. */
function concentracionSemaforo(pct: number): Semaforo {
  if (pct < 40) return "verde";
  if (pct < 60) return "amarillo";
  return "rojo";
}

/* Pesos del portfolio para HHI / Top-5. Real desde holdings. */
function computeWeights(): Array<{ ticker: string; w: number; ars: number }> {
  const held = assets.filter(
    (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
  );
  const positions = held.map((a: Asset) => {
    const native = a.price * (a.qty ?? 0);
    const ars = convertAmount(native, assetCurrency(a), "ARS");
    return { ticker: a.ticker, ars };
  });
  const total = positions.reduce((acc, p) => acc + p.ars, 0);
  return positions.map((p) => ({
    ticker: p.ticker,
    ars: p.ars,
    w: total > 0 ? p.ars / total : 0,
  }));
}

/* HHI (Herfindahl-Hirschman Index): Σ wᵢ². Posiciones efectivas = 1/HHI. */
function computeHHI(): { hhi: number; posicionesEfectivas: number } {
  const weights = computeWeights();
  const hhi = weights.reduce((acc, p) => acc + p.w * p.w, 0);
  return {
    hhi,
    posicionesEfectivas: hhi > 0 ? 1 / hhi : 0,
  };
}

/* Top-N concentration: % del portfolio en las N posiciones más grandes. */
function computeTopNConcentration(n: number): number {
  const weights = computeWeights().sort((a, b) => b.w - a.w);
  const top = weights.slice(0, n);
  return top.reduce((acc, p) => acc + p.w, 0) * 100;
}

/* Income breakdown — real desde payouts.ts. Cobrado YTD por tipo +
 * forward proyección de los próximos 12M. */
function computeIncomeBreakdown(
  toDisplay: (ars: number) => number,
): Tier2Stats["income"] {
  const events = generatePayouts();
  const today = MOCK_TODAY;
  const currentYear = today.getFullYear();
  const oneYearFromNow = new Date(
    today.getFullYear() + 1,
    today.getMonth(),
    today.getDate(),
  );
  const oneYearFromNowIso = oneYearFromNow.toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  let cupones = 0;
  let dividendos = 0;
  let amortizaciones = 0;
  let forward12M = 0;

  for (const e of events) {
    const amountArs = convertAmount(e.amount, e.currency, "ARS");
    if (e.date.startsWith(`${currentYear}-`) && isPaid(e, today)) {
      if (e.type === "cupon") cupones += amountArs;
      else if (e.type === "dividendo") dividendos += amountArs;
      else if (e.type === "amortizacion") amortizaciones += amountArs;
    }
    if (e.date > todayIso && e.date <= oneYearFromNowIso) {
      forward12M += amountArs;
    }
  }

  return {
    cupones: toDisplay(cupones),
    dividendos: toDisplay(dividendos),
    amortizaciones: toDisplay(amortizaciones),
    totalYtd: toDisplay(cupones + dividendos + amortizaciones),
    forward12M: toDisplay(forward12M),
  };
}

/* Tabla rendimiento por período. TWR del mock (mismo que Tier 1) +
 * MWR derivado (TWR + jitter chiquito que sugiere timing de aportes). */
function computeReturnsByPeriod(): ReturnsByPeriodRow[] {
  const periods: StatsRange[] = [
    "1D", "1W", "1M", "3M", "YTD", "1A", "MAX",
  ];
  return periods.map((p) => {
    const twr = MOCK_BY_RANGE[p].twrPct;
    const mwr = twr + Math.sign(twr) * 0.3;
    return { period: p, twr, mwr };
  });
}

/* Attribution: por cada holding, contribución al return del portfolio
 * en puntos porcentuales (pp). Mock: usa el daily change como proxy
 * del aporte del período. En prod: cálculo real con price series. */
function computeAttribution(): Tier2Stats["attribution"] {
  const weights = computeWeights();
  const totalArs = weights.reduce((acc, p) => acc + p.ars, 0);
  if (totalArs <= 0) return { topContributor: null, topDetractor: null };
  const contribs = assets
    .filter(
      (a: Asset) =>
        a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    )
    .map((a) => {
      const native = a.price * (a.qty ?? 0);
      const ars = convertAmount(native, assetCurrency(a), "ARS");
      const contribArs = ars * (a.change / 100);
      const contribPp = (contribArs / totalArs) * 100;
      return { ticker: a.ticker, contribPp };
    })
    .sort((a, b) => b.contribPp - a.contribPp);
  return {
    topContributor: contribs[0] && contribs[0].contribPp > 0.05 ? contribs[0] : null,
    topDetractor:
      contribs.length > 0 &&
      contribs[contribs.length - 1].contribPp < -0.05
        ? contribs[contribs.length - 1]
        : null,
  };
}

/* Cash idle: efectivo no invertido (category=efectivo), convertido
 * a moneda de display + % del portfolio total (invertido + cash). */
function computeCashIdle(
  toDisplay: (ars: number) => number,
): Tier2Stats["cashIdle"] {
  const cash = assets.filter(
    (a: Asset) =>
      a.held && a.category === "efectivo" && (a.qty ?? 0) > 0,
  );
  const cashArs = cash.reduce((acc, a) => {
    const native = a.price * (a.qty ?? 0);
    return acc + convertAmount(native, assetCurrency(a), "ARS");
  }, 0);
  const investedArs = computeTotalArs();
  const totalArs = investedArs + cashArs;
  return {
    display: toDisplay(cashArs),
    pctOfPortfolio: totalArs > 0 ? (cashArs / totalArs) * 100 : 0,
  };
}

export function computeTier2Stats(
  range: StatsRange,
  toDisplay: (ars: number) => number,
): Tier2Stats {
  const m = TIER2_MOCK_BY_RANGE[range];
  const { posicionesEfectivas: posEf } = computeHHI();
  const concentracion = computeTopNConcentration(5);

  return {
    returnsByPeriod: computeReturnsByPeriod(),
    sortino: { value: m.sortino, semaforo: sortinoSemaforo(m.sortino) },
    calmar: { value: m.calmar, semaforo: calmarSemaforo(m.calmar) },
    beta: { value: m.beta, benchmark: "S&P 500", semaforo: betaSemaforo(m.beta) },
    upCapture: { pct: m.upCapture },
    downCapture: { pct: m.downCapture },
    posicionesEfectivas: {
      value: posEf,
      semaforo: posicionesEfectivasSemaforo(posEf),
    },
    concentracionTop5: {
      pct: concentracion,
      semaforo: concentracionSemaforo(concentracion),
    },
    income: computeIncomeBreakdown(toDisplay),
    attribution: computeAttribution(),
    cashIdle: computeCashIdle(toDisplay),
  };
}

/* ─── Catálogo de info sheets por stat ────────────────────────── */

export type StatKey =
  /* Tier 1 — bento del Rendimiento */
  | "totalInvertido"
  | "mwr"
  | "twr"
  | "volatility"
  | "maxDrawdown"
  | "sharpe"
  | "alpha"
  | "dividendYield"
  /* Tier 2 — sub-pantalla /estadisticas */
  | "sortino"
  | "calmar"
  | "beta"
  | "upCapture"
  | "downCapture"
  | "posicionesEfectivas"
  | "concentracionTop5"
  | "cupones"
  | "dividendos"
  | "amortizaciones"
  | "forward12M"
  | "returnsByPeriod";

/** Contenido del info sheet por métrica. Cada stat tiene su título
 *  retail-friendly + cuerpo explicativo. Usado por la UI para abrir
 *  el sheet al tappear cada card. */
export interface StatInfo {
  /** "¿Qué es Sharpe Ratio?" tipo títulos. */
  title: string;
  /** Nombre técnico, en chico al pie. */
  technicalName: string;
  /** Cuerpo explicativo en lenguaje retail. Plain text con
   *  marcadores **bold** para resaltar términos. */
  body: string;
}

export const STAT_INFO: Record<StatKey, StatInfo> = {
  totalInvertido: {
    title: "¿Qué es el total invertido?",
    technicalName: "Cost basis",
    body: "Es la suma de todo el capital que aportaste al portfolio. No incluye las ganancias o pérdidas: solo lo que pusiste de tu bolsillo. Sirve de ancla para medir cuánto ganaste o perdiste sobre lo invertido.",
  },
  mwr: {
    title: "¿Qué es tu ganancia?",
    technicalName: "Money-Weighted Return (IRR)",
    body: "La tasa de retorno que tuvo TU plata, considerando cuándo aportaste y cuánto. Si compraste en buen momento, va a ser más alta que el rendimiento puro del activo. Mide tu performance personal como inversor.",
  },
  twr: {
    title: "¿Qué es la performance de tus activos?",
    technicalName: "Time-Weighted Return (TWR)",
    body: "La ganancia pura de los activos del portfolio, sin que afecten los aportes o retiros que hiciste. Sirve para comparar tu portfolio contra benchmarks como el S&P 500 en igualdad de condiciones.",
  },
  volatility: {
    title: "¿Qué es el riesgo de tu portfolio?",
    technicalName: "Volatilidad anualizada (σ)",
    body: "Mide cuánto se mueven los precios de tus activos día a día. Un riesgo bajo significa que tu portfolio sube y baja poco; alto significa cambios bruscos. Verde es menos de 10%, amarillo entre 10% y 20%, rojo arriba del 20%.",
  },
  maxDrawdown: {
    title: "¿Qué es la peor caída?",
    technicalName: "Maximum Drawdown",
    body: "La caída más fuerte que tuvo tu portfolio desde un pico hasta el siguiente piso, dentro del período. Mide cuánto dolor pasó tu plata en el peor momento, y cuánto tiempo tardó en recuperarse.",
  },
  sharpe: {
    title: "¿Qué es la relación riesgo/ganancia?",
    technicalName: "Sharpe Ratio",
    body: "Por cada unidad de riesgo que tomaste, cuánto rendimiento extra obtuviste sobre la tasa libre de riesgo. Un Sharpe mayor a 1 es bueno: ganaste más de lo que justificaba el riesgo. Menos de 0,5 significa que el riesgo no se está pagando.",
  },
  alpha: {
    title: "¿Qué es vs Mercado?",
    technicalName: "Alpha de Jensen",
    body: "Cuánto le ganaste o le perdiste al mercado, ajustado por el riesgo que tomaste. Si el alpha es positivo, tus elecciones agregaron valor sobre lo que hubieras conseguido replicando el benchmark.",
  },
  dividendYield: {
    title: "¿Qué son los dividendos?",
    technicalName: "Dividend Yield TTM",
    body: "El rendimiento que generan tus activos en concepto de cupones y dividendos, medido sobre los últimos 12 meses. Se calcula como total cobrado dividido por el valor del portfolio. Un yield alto significa que tu cartera genera ingresos sin que tengas que vender posiciones.",
  },
  /* ─── Tier 2 ─── */
  sortino: {
    title: "¿Qué es la ganancia por riesgo de pérdida?",
    technicalName: "Sortino Ratio",
    body: "Es como el Sharpe Ratio, pero solo penaliza la volatilidad cuando las cosas van mal. Mide cuánto ganaste por cada unidad de riesgo de pérdida que asumiste. Más de 1,5 es bueno; por debajo de 0,8 indica que el riesgo a la baja no se está pagando.",
  },
  calmar: {
    title: "¿Qué es la ganancia vs peor caída?",
    technicalName: "Calmar Ratio",
    body: "Tu rendimiento anual dividido por la peor caída que tuvo el portfolio. Te dice cuánto ganaste por cada punto de máxima pérdida soportada. Más de 1 significa que tus ganancias justificaron el dolor del peor momento.",
  },
  beta: {
    title: "¿Qué es la sensibilidad al mercado?",
    technicalName: "Beta",
    body: "Mide cuánto se mueve tu portfolio cuando el mercado se mueve. Un beta de 1 significa que va igual; mayor a 1 amplifica los movimientos del mercado; menor a 1 los amortigua. Negativo significa que se mueve al revés.",
  },
  upCapture: {
    title: "¿Qué es cuánto capturás en subas?",
    technicalName: "Up-Capture Ratio",
    body: "Cuando el mercado sube, ¿qué porcentaje de esa suba captura tu portfolio? Mayor a 100 significa que ganás más que el mercado en los buenos momentos; menor a 100 significa que te quedás atrás.",
  },
  downCapture: {
    title: "¿Qué es cuánto caés en bajas?",
    technicalName: "Down-Capture Ratio",
    body: "Cuando el mercado cae, ¿qué porcentaje de esa caída sentís en tu portfolio? Menor a 100 significa que perdés menos que el mercado en los malos momentos — un escudo defensivo.",
  },
  posicionesEfectivas: {
    title: "¿Qué son las posiciones efectivas?",
    technicalName: "Inverso del HHI",
    body: "Cuántas posiciones del mismo tamaño equivaldrían a tu portfolio actual, considerando la concentración real. Si tenés 20 holdings pero uno representa el 50%, tu número efectivo es mucho menor que 20. Más alto es más diversificado.",
  },
  concentracionTop5: {
    title: "¿Qué es la concentración top 5?",
    technicalName: "Top-N Concentration",
    body: "Porcentaje del portfolio que vive en tus 5 posiciones más grandes. Menos del 40% se considera bien diversificado; arriba del 60% indica concentración alta que amplifica tanto las subas como las bajas.",
  },
  cupones: {
    title: "¿Qué son los cupones?",
    technicalName: "Bond Coupon Income",
    body: "Los pagos de intereses que hacen los bonos en fechas fijas según su prospecto. Se reciben en cuotas a lo largo del año y son la fuente principal de ingreso de la parte de renta fija del portfolio.",
  },
  dividendos: {
    title: "¿Qué son los dividendos?",
    technicalName: "Stock Dividends",
    body: "Pagos en efectivo que las empresas distribuyen a sus accionistas cuando el directorio los aprueba. Los recibís si tenés acciones argentinas, acciones estadounidenses o CEDEARs que las replican. Las fechas y montos dependen de la política de cada empresa.",
  },
  amortizaciones: {
    title: "¿Qué son las amortizaciones?",
    technicalName: "Principal Repayment",
    body: "Cuando un bono te devuelve parte del capital invertido, no solo intereses. Algunos bonos amortizan en cuotas según un cronograma; otros pagan todo al vencimiento (bullet). Es plata que vuelve a tu mano sin tener que vender.",
  },
  forward12M: {
    title: "¿Qué es la proyección de ingresos?",
    technicalName: "Forward 12M Income",
    body: "Una estimación de cuánto vas a cobrar en los próximos 12 meses, considerando los cronogramas de cupones de tus bonos y las políticas de dividendos esperadas. Los dividendos pueden variar; los cupones de bonos suelen estar fijos en el prospecto.",
  },
  returnsByPeriod: {
    title: "¿Qué es el rendimiento por período?",
    technicalName: "Performance Table",
    body: "Tu rendimiento mostrado en distintas ventanas de tiempo, con TWR (limpio de aportes) y MWR (incluyendo cuándo aportaste). Te deja comparar performance del último día contra el último año o desde que empezaste.",
  },
};

/* ─── AI Portfolio Commentary (mock determinístico) ────────────
 *
 * Genera un análisis narrativo multi-párrafo a partir de las stats
 * Tier 1 + Tier 2. Imita el output esperado del endpoint real
 * POST /api/portfolio/{userId}/commentary (Claude Sonnet API),
 * pero sin la llamada — para mock + dev experience.
 *
 * Estructura siguiendo la spec interna 4.2:
 *   1. Resumen de performance + comparación con benchmark.
 *   2. Riesgo (volatilidad + Sharpe interpretado).
 *   3. Peor caída con contexto temporal.
 *   4. Concentración / diversificación.
 *   5. Income generado (si el portfolio paga rentas).
 *
 * Cuando se enchufe el endpoint real, este function se reemplaza
 * por un fetch al API + parsing del response. La firma queda igual.
 */

export interface CommentaryParagraph {
  /** Texto plano del párrafo. Inline bolds se marcan con **dobles
   *  asteriscos** para que el UI los pinte en c.text bold. */
  text: string;
}

const PERIOD_LABEL: Record<StatsRange, string> = {
  "1D": "hoy",
  "1W": "esta semana",
  "1M": "este mes",
  "3M": "los últimos 3 meses",
  YTD: "lo que va del año",
  "1A": "el último año",
  MAX: "desde el inicio",
};

function pctText(p: number): string {
  const sign = p >= 0 ? "+" : "−";
  return `${sign}${Math.abs(p).toFixed(2).replace(".", ",")}%`;
}

function num1(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

function num2(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

interface CommentaryArgs {
  range: StatsRange;
  tier1: Tier1Stats;
  tier2: Tier2Stats;
  /** Necesario para formatear los montos en moneda de display. */
  formatAmount: (amount: number) => string;
}

/**
 * Estructura del commentary (4 párrafos):
 *   1. Performance — period return + top contributor/detractor +
 *      benchmark (S&P 500).
 *   2. Riesgo — vol level + Sharpe en plano + observación de
 *      drawdown si fue significativo en el período.
 *   3. Composición — concentración top-5 (con alerta si > 60%) +
 *      posiciones efectivas.
 *   4. Contextual — cash idle si es > 5% del portfolio, con
 *      aclaración del tipo de cambio cuando aplica.
 *
 * Voz: usa términos técnicos (Sharpe, volatilidad anualizada,
 * puntos porcentuales) para que el análisis se sienta profesional,
 * pero acompaña cada uno con una explicación ultra-sencilla
 * inline para que cualquier retail entienda. Sin condescender ni
 * tirar jerga sin contexto.
 *
 * Reglas (compliance):
 *   NUNCA recomendar compras o ventas, predecir movimientos del
 *   mercado, mencionar competidores ni dar opiniones sobre la
 *   economía. Solo observaciones descriptivas sobre el estado
 *   actual del portfolio.
 */
export function generateCommentary(args: CommentaryArgs): CommentaryParagraph[] {
  const { range, tier1, tier2, formatAmount } = args;
  const out: CommentaryParagraph[] = [];

  /* ── Párrafo 1: Performance + drivers + benchmark ── */
  const periodLabel = PERIOD_LABEL[range];
  const direction = tier1.twr.pct >= 0 ? "creció" : "cayó";
  const twrFormatted = pctText(tier1.twr.pct);
  const benchmarkFormatted = pctText(tier1.alpha.benchmarkPct);
  const alphaSign = tier1.alpha.pct > 0 ? "superando" : "por debajo de";

  let p1 = `Tu portfolio ${direction} **${twrFormatted}** en ${periodLabel}`;
  if (Math.abs(tier1.alpha.pct) > 0.3) {
    p1 += `, ${alphaSign} al **S&P 500** (el índice más importante de Estados Unidos), que rindió ${benchmarkFormatted}.`;
  } else {
    p1 += `, en línea con el S&P 500 (que rindió ${benchmarkFormatted}).`;
  }

  /* Top contributor / detractor — usamos "puntos al rendimiento"
   * en vez de "pp" para que el retail entienda sin saber la jerga. */
  const top = tier2.attribution.topContributor;
  const bottom = tier2.attribution.topDetractor;
  if (top && top.contribPp >= 0.3) {
    p1 += ` El principal motor fue **${top.ticker}**: te sumó ${num1(top.contribPp)} puntos al rendimiento total`;
    if (bottom && Math.abs(bottom.contribPp) >= 0.3) {
      p1 += `, mientras que **${bottom.ticker}** te restó ${num1(Math.abs(bottom.contribPp))} puntos.`;
    } else {
      p1 += `.`;
    }
  } else if (bottom && Math.abs(bottom.contribPp) >= 0.3) {
    p1 += ` El mayor lastre fue **${bottom.ticker}**: te restó ${num1(Math.abs(bottom.contribPp))} puntos al rendimiento total.`;
  }
  out.push({ text: p1 });

  /* ── Párrafo 2: Riesgo (vol + Sharpe + drawdown contextual) ──
   * Cada término técnico viene con una explicación inline ultra
   * sencilla para que el retail entienda qué está leyendo. */
  const volTone =
    tier1.volatility.semaforo === "verde"
      ? "bajo"
      : tier1.volatility.semaforo === "amarillo"
        ? "moderado"
        : "alto";

  let p2 = `La **volatilidad anualizada** (cuánto oscilan los precios en un año típico) es **${num1(tier1.volatility.pct)}%**, considerada de riesgo ${volTone}. `;

  /* Sharpe en plano: cada caso con una frase que explica qué
   * significa el número en términos prácticos. */
  if (tier1.sharpe.value > 1.0) {
    p2 += `El **Sharpe ratio** (cuánto rendimiento extra obtenés por cada unidad de riesgo) es de **${num2(tier1.sharpe.value)}**: arriba de 1 indica que el riesgo te está siendo bien pagado.`;
  } else if (tier1.sharpe.value > 0.5) {
    p2 += `El **Sharpe ratio** (cuánto rendimiento extra obtenés por cada unidad de riesgo) es **${num2(tier1.sharpe.value)}**: el rendimiento alcanza para justificar el riesgo asumido, pero sin margen amplio.`;
  } else {
    p2 += `El **Sharpe ratio** (cuánto rendimiento extra obtenés por cada unidad de riesgo) es **${num2(tier1.sharpe.value)}**, por debajo de 0,5: estás tomando riesgo que no te está siendo compensado.`;
  }

  /* Drawdown si fue significativo en el período (> 5%) y se recuperó. */
  if (tier1.maxDrawdown.pct > 5 && tier1.maxDrawdown.recoveryDays > 0) {
    p2 += ` La peor caída del período fue de **${num1(tier1.maxDrawdown.pct)}%** en ${tier1.maxDrawdown.date}, y tardaste ${tier1.maxDrawdown.recoveryDays} días en recuperarte hasta el pico anterior.`;
  }
  out.push({ text: p2 });

  /* ── Párrafo 3: Composición (concentración + posiciones efectivas) ── */
  let p3: string;
  if (tier2.concentracionTop5.pct > 60) {
    p3 = `Tus 5 posiciones más grandes concentran el **${tier2.concentracionTop5.pct.toFixed(0)}%** del portfolio, lo cual es mucho: una caída fuerte en cualquiera de ellas te impactaría de lleno. La diversificación equivale a tener apenas **${num1(tier2.posicionesEfectivas.value)} posiciones efectivas** (un número alto significa que el peso está bien repartido entre activos).`;
  } else if (tier2.concentracionTop5.pct > 40) {
    p3 = `Las 5 posiciones más grandes representan el **${tier2.concentracionTop5.pct.toFixed(0)}%** del portfolio. La diversificación es razonable: equivale a tener **${num1(tier2.posicionesEfectivas.value)} posiciones efectivas**, una métrica que ajusta el conteo de activos por su peso real para que se entienda cuán distribuido está el riesgo.`;
  } else {
    p3 = `El portfolio está bien diversificado: las 5 posiciones más grandes representan solo el **${tier2.concentracionTop5.pct.toFixed(0)}%**, equivalente a **${num1(tier2.posicionesEfectivas.value)} posiciones efectivas** (ajuste del conteo de activos por su peso real). Esto reduce el impacto de un solo activo en el rendimiento total.`;
  }
  out.push({ text: p3 });

  /* ── Párrafo 4: Contextual (cash idle si es > 5% del portfolio) ──
   * Aclaración FX al pie: si hay holdings en USD o USDT, el total
   * mostrado se convirtió a pesos al oficial vendedor. */
  if (tier2.cashIdle.pctOfPortfolio > 5) {
    out.push({
      text: `Tenés **${formatAmount(tier2.cashIdle.display)}** sin invertir, un **${num1(tier2.cashIdle.pctOfPortfolio)}%** del portfolio total. Es capital quieto que no está generando rendimiento. Los saldos en dólares y USDT se convierten a pesos al tipo de cambio oficial vendedor para calcular el total.`,
    });
  }

  return out;
}

