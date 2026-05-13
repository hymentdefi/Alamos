/**
 * Cobros del portfolio — dividendos, cupones y amortizaciones que
 * generan los holdings. Mock determinístico hasta que enchufemos data
 * real (BYMA tiene cronogramas públicos para bonos AR, dividendos de
 * CEDEARs vienen ratio-adjusted del subyacente).
 *
 * El ALyC promedio en Argentina muestra los pagos cuando ya pasaron.
 * Acá la apuesta es el calendario forward: ¿cuándo cobro?, ¿cuánto?,
 * ¿de qué activo? Esto es lo que diferencia a Álamos del resto.
 */

import {
  assetCurrency,
  assets,
  type Asset,
  type AssetCategory,
  type AssetCurrency,
} from "./assets";

export type PayoutType = "cupon" | "dividendo" | "amortizacion";

export interface PayoutEvent {
  id: string;
  ticker: string;
  /** Nombre del activo para display (ej. "Bonar 2030"). */
  assetName: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Monto del evento en moneda nativa del activo. */
  amount: number;
  currency: AssetCurrency;
  type: PayoutType;
}

/**
 * "Hoy" determinístico — alineado con la fecha del entorno
 * (CLAUDE.md: 2026-05-13). En producción se reemplaza por `new Date()`.
 */
export const MOCK_TODAY = new Date(2026, 4, 13);

const MS_DAY = 86_400_000;

type Cadence = "trimestral" | "semestral" | "anual";

interface CategorySchedule {
  cadence: Cadence;
  /** Yield anual sobre valor de mercado, en %. */
  yieldPct: number;
  type: PayoutType;
  /** Si está, además se emite una amortización anual de % del valor. */
  amortPct?: number;
}

/* Cronogramas por categoría — mock pero ordenados de mayor a menor
 * realismo. Los bonos soberanos AR pagan cupón semestral chico (post
 * reestructuración 2020 son step-up) y amortizan capital escalonado.
 * Las ONs corporativas pagan más alto. CEDEARs y acciones US replican
 * el % típico blue-chip. Acciones AR pocas pagan dividendo relevante. */
const SCHEDULES: Partial<Record<AssetCategory, CategorySchedule>> = {
  bonos: { cadence: "semestral", yieldPct: 7.0, type: "cupon", amortPct: 4 },
  obligaciones: { cadence: "semestral", yieldPct: 9.0, type: "cupon" },
  cedears: { cadence: "trimestral", yieldPct: 1.8, type: "dividendo" },
  acciones: { cadence: "trimestral", yieldPct: 2.2, type: "dividendo" },
};

/* Tickers que en la vida real no pagan dividendos relevantes —
 * los excluimos para no inventar eventos donde no los hay. */
const SKIP_PAYOUTS = new Set<string>([
  "TSLA.US",
  "NVDA.US", // ~$0.04/share/año, irrisorio
]);

function hashTicker(ticker: string): number {
  let h = 2166136261;
  for (let i = 0; i < ticker.length; i++) {
    h ^= ticker.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cadenceMonths(c: Cadence): number {
  return c === "semestral" ? 6 : c === "trimestral" ? 3 : 12;
}

function eventsPerYear(c: Cadence): number {
  return c === "semestral" ? 2 : c === "trimestral" ? 4 : 1;
}

function generateEventsForAsset(asset: Asset): PayoutEvent[] {
  const schedule = SCHEDULES[asset.category];
  if (!schedule) return [];
  if (SKIP_PAYOUTS.has(asset.ticker)) return [];

  const qty = asset.qty ?? 0;
  if (qty <= 0) return [];

  const h = hashTicker(asset.ticker);
  const anchorMonth = h % 12;
  const anchorDay = (h % 27) + 1;

  const stepMonths = cadenceMonths(schedule.cadence);
  const ppy = eventsPerYear(schedule.cadence);

  const marketValueNative = asset.price * qty;
  const perEventAmount = (marketValueNative * schedule.yieldPct / 100) / ppy;
  const amortAmount =
    schedule.amortPct != null
      ? (marketValueNative * schedule.amortPct) / 100
      : 0;

  const out: PayoutEvent[] = [];
  const windowStart = addMonths(MOCK_TODAY, -12);
  const windowEnd = addMonths(MOCK_TODAY, 12);

  /* Arrancamos el cursor 24 meses atrás del anchor para barrer
   * sobradamente la ventana, y avanzamos cada `stepMonths`. */
  let cursor = new Date(MOCK_TODAY.getFullYear() - 2, anchorMonth, anchorDay);
  while (cursor < windowEnd) {
    if (cursor >= windowStart) {
      out.push({
        id: `${asset.ticker}-${toIso(cursor)}`,
        ticker: asset.ticker,
        assetName: asset.name,
        date: toIso(cursor),
        amount: perEventAmount,
        currency: assetCurrency(asset),
        type: schedule.type,
      });

      /* Amortización para bonos: emitimos una por año en el cupón
       * que cae en el segundo semestre. Mock simplificado de la
       * amortización escalonada de AL30/GD30. */
      if (
        amortAmount > 0 &&
        schedule.cadence === "semestral" &&
        cursor.getMonth() >= 6
      ) {
        out.push({
          id: `${asset.ticker}-amort-${toIso(cursor)}`,
          ticker: asset.ticker,
          assetName: asset.name,
          date: toIso(cursor),
          amount: amortAmount,
          currency: assetCurrency(asset),
          type: "amortizacion",
        });
      }
    }
    cursor = addMonths(cursor, stepMonths);
  }

  return out;
}

/** Genera todos los eventos de cobro para los holdings actuales, en
 *  una ventana de ±12 meses alrededor de hoy. Sorted asc por fecha. */
export function generatePayouts(): PayoutEvent[] {
  const heldPaying = assets.filter(
    (a) => a.held && (a.qty ?? 0) > 0 && SCHEDULES[a.category],
  );
  const all = heldPaying.flatMap(generateEventsForAsset);
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

/* ─── Estado pagado / próximo ─────────────────────────────────── */

export function isPaid(
  event: PayoutEvent,
  today: Date = MOCK_TODAY,
): boolean {
  return event.date < toIso(today);
}

export function daysUntil(
  eventDate: string,
  today: Date = MOCK_TODAY,
): number {
  const [y, m, d] = eventDate.split("-").map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const t = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  return Math.round((target - t) / MS_DAY);
}

/** "hoy" / "mañana" / "en X días" / "en X semanas" / "en X meses". */
export function formatRelativeDate(
  eventDate: string,
  today: Date = MOCK_TODAY,
): string {
  const d = daysUntil(eventDate, today);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d < 0) {
    const abs = Math.abs(d);
    if (abs === 1) return "ayer";
    if (abs < 14) return `hace ${abs} días`;
    if (abs < 60) return `hace ${Math.round(abs / 7)} semanas`;
    return `hace ${Math.round(abs / 30)} meses`;
  }
  if (d < 14) return `en ${d} días`;
  if (d < 60) return `en ${Math.round(d / 7)} semanas`;
  if (d < 365) return `en ${Math.round(d / 30)} meses`;
  return `en ${(d / 365).toFixed(1)} años`;
}

/** "15 jul" o "15 jul 2027" si difiere del año actual. */
export function formatShortDate(
  eventDate: string,
  today: Date = MOCK_TODAY,
): string {
  const [y, m, d] = eventDate.split("-").map(Number);
  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  const label = `${d} ${months[m - 1]}`;
  return y === today.getFullYear() ? label : `${label} ${y}`;
}

export function payoutTypeLabel(t: PayoutType, plural = false): string {
  if (t === "cupon") return plural ? "Cupones" : "Cupón";
  if (t === "dividendo") return plural ? "Dividendos" : "Dividendo";
  return plural ? "Amortizaciones" : "Amortización";
}

/* ─── Buckets mensuales para el bar chart ──────────────────────── */

export interface MonthBucket {
  /** YYYY-MM */
  key: string;
  /** 0..11 */
  month: number;
  year: number;
  /** Letra del mes en es ("E", "F", "M", ...). */
  label: string;
  totalArs: number;
  /** true si el mes ya pasó o es el actual (≤ hoy). */
  paid: boolean;
  /** true si es el mes actual — para destacarlo levemente. */
  isCurrent: boolean;
}

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MONTH_NAMES_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Nombre completo del mes en español. `month` es 0-indexed (Date#getMonth). */
export function monthNameFull(month: number): string {
  return MONTH_NAMES_FULL[month];
}

/** Abreviación corta del mes en español ("Ene", "Feb", ...). 0-indexed. */
export function monthNameShort(month: number): string {
  return MONTH_LABELS[month];
}

/** Ventana mensual centrada en hoy. Default: 5 atrás + 6 adelante = 12 bars. */
export function monthlyBuckets(
  events: PayoutEvent[],
  toArs: (amount: number, currency: AssetCurrency) => number,
  today: Date = MOCK_TODAY,
  monthsBack = 5,
  monthsFwd = 6,
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const startYear = today.getFullYear();
  const startMonth = today.getMonth() - monthsBack;
  const total = monthsBack + monthsFwd + 1;

  for (let i = 0; i < total; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${(month + 1).toString().padStart(2, "0")}`;
    const isCurrent = i === monthsBack;
    buckets.push({
      key,
      month,
      year,
      label: MONTH_LABELS[month],
      totalArs: 0,
      paid: i <= monthsBack,
      isCurrent,
    });
  }

  for (const e of events) {
    const [y, m] = e.date.split("-");
    const k = `${y}-${m}`;
    const b = buckets.find((bb) => bb.key === k);
    if (b) b.totalArs += toArs(e.amount, e.currency);
  }

  return buckets;
}

/* ─── Resúmenes anuales ────────────────────────────────────────── */

export interface YearSummary {
  totalArs: number;
  byType: Record<PayoutType, number>;
  byTicker: Array<{ ticker: string; assetName: string; ars: number }>;
}

export function summarizeYear(
  events: PayoutEvent[],
  year: number,
  toArs: (amount: number, currency: AssetCurrency) => number,
): YearSummary {
  let total = 0;
  const byType: Record<PayoutType, number> = {
    cupon: 0,
    dividendo: 0,
    amortizacion: 0,
  };
  const byTickerMap = new Map<string, { assetName: string; ars: number }>();

  for (const e of events) {
    if (!e.date.startsWith(`${year}-`)) continue;
    const ars = toArs(e.amount, e.currency);
    total += ars;
    byType[e.type] += ars;
    const prev = byTickerMap.get(e.ticker) ?? {
      assetName: e.assetName,
      ars: 0,
    };
    byTickerMap.set(e.ticker, {
      assetName: prev.assetName,
      ars: prev.ars + ars,
    });
  }

  const byTicker = [...byTickerMap.entries()]
    .map(([ticker, v]) => ({ ticker, assetName: v.assetName, ars: v.ars }))
    .sort((a, b) => b.ars - a.ars);

  return { totalArs: total, byType, byTicker };
}
