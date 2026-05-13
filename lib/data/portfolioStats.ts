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

/* ─── Catálogo de info sheets por stat ────────────────────────── */

export type StatKey =
  | "totalInvertido"
  | "mwr"
  | "twr"
  | "volatility"
  | "maxDrawdown"
  | "sharpe"
  | "alpha"
  | "dividendYield";

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
};

