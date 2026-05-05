import type { Asset } from "../data/assets";
import { assetMarket } from "../data/assets";
import { holidayOn, type Holiday, type MarketCode } from "./calendar";

/**
 * BYMA (Bolsas y Mercados Argentinos) opera de lunes a viernes,
 * de 10:30 a 17:00 hora Argentina (UTC-3).
 * Fuera de ese rango se considera "fuera de mercado" y las órdenes
 * quedan en espera hasta la próxima apertura.
 */

const OPEN_HOUR = 10;
const OPEN_MINUTE = 30;
const CLOSE_HOUR = 17;
const CLOSE_MINUTE = 0;

// US market en horario ART — NYSE/NASDAQ 11:30 a 18:00 (sin DST,
// equivale a 9:30–16:00 ET). La spec habla de 9:30 ET en el copy
// del banner — usamos esa hora local en los mensajes y la convertida
// a ART internamente para el cálculo de open/close.
const US_OPEN_HOUR = 11;
const US_OPEN_MINUTE = 30;
const US_CLOSE_HOUR = 18;
const US_CLOSE_MINUTE = 0;

/** Devuelve la hora actual en Argentina (UTC-3) sin DST. */
function argentinaNow(date = new Date()): { day: number; hour: number; minute: number } {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  const arg = new Date(utcMs - 3 * 60 * 60_000);
  return {
    day: arg.getDay(), // 0 = domingo, 6 = sábado
    hour: arg.getHours(),
    minute: arg.getMinutes(),
  };
}

/** Minutos desde 00:00 para comparar contra los bordes OPEN/CLOSE. */
function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

const OPEN_MINS = minutesOfDay(OPEN_HOUR, OPEN_MINUTE);
const CLOSE_MINS = minutesOfDay(CLOSE_HOUR, CLOSE_MINUTE);
const US_OPEN_MINS = minutesOfDay(US_OPEN_HOUR, US_OPEN_MINUTE);
const US_CLOSE_MINS = minutesOfDay(US_CLOSE_HOUR, US_CLOSE_MINUTE);

export function isMarketOpen(date = new Date()): boolean {
  const { day, hour, minute } = argentinaNow(date);
  if (day === 0 || day === 6) return false;
  const mins = minutesOfDay(hour, minute);
  return mins >= OPEN_MINS && mins < CLOSE_MINS;
}

/** Texto para el disclaimer cuando el mercado está cerrado. */
export function marketClosedMessage(_date = new Date()): string {
  // Mensaje único, sin asumir qué día es hoy/mañana: no tenemos un
  // calendario de feriados, así que cualquier referencia temporal
  // concreta (p.ej. 'abrimos mañana') puede ser falsa si el próximo
  // día hábil es feriado. Mejor genérico y siempre correcto.
  return "Mercado cerrado · Operamos de lunes a viernes de 10:30 a 17:00 hs.";
}

/* ─── Sesión por tipo de instrumento ──────────────────────────────── */

export interface MarketSession {
  /** ¿Está abierto AHORA para este instrumento? */
  open: boolean;
  /** Texto humano del horario (para el sheet de cerrado). */
  hours: string;
  /** Días que opera. */
  days: string;
  /** Etiqueta humana del tipo de instrumento, para el copy:
   *  "Las acciones argentinas", "Los CEDEARs", "Los bonos", etc. */
  instrumentLabel: string;
}

function instrumentLabelFor(asset: Asset): string {
  switch (asset.category) {
    case "cedears":
      return "Los CEDEARs";
    case "acciones":
      return assetMarket(asset) === "US"
        ? "Las acciones de Estados Unidos"
        : "Las acciones argentinas";
    case "bonos":
      return "Los bonos";
    case "obligaciones":
      return "Las ONs";
    case "letras":
      return "Las letras";
    case "caucion":
      return "Las cauciones";
    case "fci":
      return "Los fondos comunes";
    case "crypto":
      return "Las crypto";
    case "futuros":
      return "Los futuros";
    default:
      return "Estos instrumentos";
  }
}

/**
 * Devuelve la sesión de mercado relevante al activo. Crypto/futuros
 * siempre abiertos, FCI considerados abiertos (la suscripción no
 * tiene horario rígido para el usuario), acciones US miran NYSE en
 * ART, todo lo demás (AR) usa BYMA.
 */
export function marketSessionFor(
  asset: Asset,
  date: Date = new Date(),
): MarketSession {
  const instrumentLabel = instrumentLabelFor(asset);

  // 24/7 — crypto y futuros.
  if (asset.category === "crypto" || asset.category === "futuros") {
    return {
      open: true,
      hours: "24 horas",
      days: "todos los días",
      instrumentLabel,
    };
  }

  // FCI — abierto durante el día hábil; la operatoria del usuario no
  // tiene horario rígido (cutoff lo maneja la ALYC).
  if (asset.category === "fci") {
    return {
      open: true,
      hours: "horario continuo",
      days: "días hábiles",
      instrumentLabel,
    };
  }

  const { day, hour, minute } = argentinaNow(date);
  const isWeekend = day === 0 || day === 6;
  const mins = minutesOfDay(hour, minute);

  // Acciones US.
  if (assetMarket(asset) === "US") {
    return {
      open: !isWeekend && mins >= US_OPEN_MINS && mins < US_CLOSE_MINS,
      hours: "11:30 a 18:00 hs (ART)",
      days: "lunes a viernes",
      instrumentLabel,
    };
  }

  // AR — BYMA.
  return {
    open: !isWeekend && mins >= OPEN_MINS && mins < CLOSE_MINS,
    hours: "10:30 a 17:00 hs",
    days: "lunes a viernes",
    instrumentLabel,
  };
}

/* ─── Mercado cerrado: razón estructurada + mensaje específico ──── */

/**
 * Razón por la que el mercado del activo está cerrado AHORA. Sirve
 * para componer el copy del banner del hero con el detalle correcto
 * (cerrado mismo día, fin de semana, feriado AR/US).
 *
 *   - afterHours    → cerró por hoy, abre mañana (o lunes si jueves
 *                     y mañana es feriado, etc. — no resolvemos eso
 *                     en v1, sólo decimos "abre mañana a las X").
 *   - beforeHours   → mismo día, todavía no abrió.
 *   - weekend       → sábado o domingo.
 *   - holiday       → feriado del mercado del activo.
 *   - notApplicable → mercado 24/7 (crypto/futuros) — no debería
 *                     pedirse pero lo modelamos por completitud.
 */
export type ClosedReason =
  | { kind: "open" }
  | { kind: "afterHours" }
  | { kind: "beforeHours" }
  | { kind: "weekend" }
  | { kind: "holiday"; holiday: Holiday }
  | { kind: "notApplicable" };

/** Mercado al que pertenece el activo, para lookup de feriados. */
function marketCodeFor(asset: Asset): MarketCode | null {
  const m = assetMarket(asset);
  if (m === "AR") return "AR";
  if (m === "US") return "US";
  return null; // CRYPTO — no usa calendar
}

/** YYYY-MM-DD del momento dado, en ART (suficiente para AR; para US
 *  el huso varía pero el día calendario en ART suele coincidir con
 *  el de ET para horario laboral — es una aproximación razonable
 *  para v1). */
function ymdInArgentina(date: Date): string {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  const arg = new Date(utcMs - 3 * 60 * 60_000);
  const y = arg.getFullYear();
  const m = String(arg.getMonth() + 1).padStart(2, "0");
  const d = String(arg.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Devuelve la razón por la que el mercado del activo está cerrado.
 *  Si está abierto, kind === 'open'. */
export function closedReasonFor(
  asset: Asset,
  date: Date = new Date(),
): ClosedReason {
  const market = assetMarket(asset);

  // Crypto/futuros: 24/7. La spec dice "Crypto: nunca mostrar".
  if (market === "CRYPTO") return { kind: "notApplicable" };
  // FCI: tratamos como abierto (la operatoria del usuario no tiene
  // horario rígido; cutoff lo maneja la ALYC).
  if (asset.category === "fci") return { kind: "open" };

  const { day, hour, minute } = argentinaNow(date);
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) return { kind: "weekend" };

  // Feriado: comparamos contra el calendario del mercado del activo.
  const code = marketCodeFor(asset);
  if (code) {
    const ymd = ymdInArgentina(date);
    const h = holidayOn(code, ymd);
    if (h) return { kind: "holiday", holiday: h };
  }

  const mins = minutesOfDay(hour, minute);
  const openMins = market === "US" ? US_OPEN_MINS : OPEN_MINS;
  const closeMins = market === "US" ? US_CLOSE_MINS : CLOSE_MINS;

  if (mins < openMins) return { kind: "beforeHours" };
  if (mins >= closeMins) return { kind: "afterHours" };
  return { kind: "open" };
}

/* ─── Próxima apertura (Date) — para órdenes encoladas ─────────── */

/** Devuelve un Date con el próximo momento en que el mercado del
 *  activo estará abierto. Salta fines de semana y, si la fecha
 *  candidata cae en feriado, sigue saltando hasta encontrar día
 *  hábil con mercado abierto.
 *
 *  Para AR usa OPEN_HOUR/OPEN_MINUTE en ART. Para US usa la hora
 *  US_OPEN expresada en ART (que es 9:30 ET).
 *
 *  Si el activo es crypto/futuros, devuelve el `date` recibido
 *  (siempre abierto). */
export function nextOpenFor(asset: Asset, date: Date = new Date()): Date {
  const market = assetMarket(asset);
  if (market === "CRYPTO" || asset.category === "fci") return date;

  const code = marketCodeFor(asset);
  const openHour = market === "US" ? US_OPEN_HOUR : OPEN_HOUR;
  const openMinute = market === "US" ? US_OPEN_MINUTE : OPEN_MINUTE;

  // Buscamos hasta 21 días hacia adelante (sobra para cualquier
  // bridge feriados+fin-de-semana — ej: Semana Santa larga).
  const candidate = new Date(date.getTime());
  // Si ya estamos antes de la apertura del mismo día, candidate
  // se setea a hoy a la hora de apertura.
  const today = new Date(date.getTime());
  setArgentinaTime(today, openHour, openMinute);
  if (today.getTime() > date.getTime()) {
    if (isCandidateOpen(asset, today, code)) return today;
  }

  // Sino, arrancamos al día siguiente a la hora de apertura.
  candidate.setDate(candidate.getDate() + 1);
  setArgentinaTime(candidate, openHour, openMinute);

  for (let i = 0; i < 21; i++) {
    if (isCandidateOpen(asset, candidate, code)) return candidate;
    candidate.setDate(candidate.getDate() + 1);
    setArgentinaTime(candidate, openHour, openMinute);
  }
  // Fallback: si después de 21 días no encontramos apertura, algo
  // está muy mal en el calendario — devolvemos el último candidato
  // y dejamos que el caller decida qué hacer.
  return candidate;
}

function isCandidateOpen(
  asset: Asset,
  candidate: Date,
  code: MarketCode | null,
): boolean {
  const { day } = argentinaNow(candidate);
  if (day === 0 || day === 6) return false;
  if (code) {
    const ymd = ymdInArgentina(candidate);
    if (holidayOn(code, ymd)) return false;
  }
  return true;
}

function setArgentinaTime(date: Date, hour: number, minute: number): void {
  // Setear hora ART a partir de un Date local. Más simple si tomamos
  // la fecha local del candidato y construimos un nuevo Date con el
  // offset apropiado. Como el resto del módulo, aproximamos UTC-3
  // sin DST.
  const tzOffsetMin = date.getTimezoneOffset();
  // Hora local ART = UTC - 3hs. Para que la hora visible en ART sea
  // `hour:minute`, en UTC tiene que ser hour+3 (mod 24). Trabajamos
  // sobre el getTime(): partimos del 00:00 ART de la fecha del Date
  // y sumamos los minutos.
  // Equivalencia: si setteo en local time y compenso por (offset -
  // (-180)), termino en ART correctamente.
  // Para mantenerlo simple: setUTCHours.
  // ART = UTC-3 → ART hour `H` corresponde a UTC `H+3`.
  date.setUTCHours(hour + 3, minute, 0, 0);
  void tzOffsetMin;
}

/* ─── Mensajes específicos por escenario ─────────────────────────
 *
 * Spec exacta (en español, días en minúscula, sin duplicar en sticky):
 *   - Cerrado mismo día:   "Cerrado · 17:00 hs"
 *   - Fin de semana:       "Cerrado · Abre lunes 11:00 hs"
 *   - Feriado AR:          "Cerrado por feriado · Abre [día] 11:00 hs"
 *   - Feriado US:          "Cerrado por feriado estadounidense · Abre [día] 9:30 hs ET"
 *   - Crypto:              nunca mostrar
 */
const DAYS_ES_LOWER = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

function dayNameOfNextOpen(date: Date): string {
  const { day } = argentinaNow(date);
  return DAYS_ES_LOWER[day];
}

function openTimeLabel(market: "AR" | "US"): string {
  if (market === "US") return "9:30 hs ET";
  return "10:30 hs";
}

function closeTimeLabel(market: "AR" | "US"): string {
  if (market === "US") return "16:00 hs ET";
  return "17:00 hs";
}

/** Mensaje específico para mostrar en el hero cuando el mercado del
 *  activo está cerrado. Devuelve null si no aplica (mercado abierto
 *  o crypto/FCI). */
export function closedHeroMessageFor(
  asset: Asset,
  date: Date = new Date(),
): string | null {
  const reason = closedReasonFor(asset, date);
  if (reason.kind === "open" || reason.kind === "notApplicable") return null;

  const market = assetMarket(asset);
  if (market === "CRYPTO") return null;
  const m = market === "US" ? "US" : "AR";

  switch (reason.kind) {
    case "afterHours":
      // Cerró por hoy. Dejo el copy idéntico al ejemplo de la spec
      // ("Cerrado · 17:00 hs") sin agregar "Abre mañana" para no
      // mentir si mañana es feriado — la versión rica con próxima
      // apertura va abajo en el flow de orden diferida.
      return `Cerrado · ${closeTimeLabel(m)}`;
    case "beforeHours": {
      const next = nextOpenFor(asset, date);
      const dayName = dayNameOfNextOpen(next);
      return `Cerrado · Abre ${dayName} ${openTimeLabel(m)}`;
    }
    case "weekend": {
      const next = nextOpenFor(asset, date);
      const dayName = dayNameOfNextOpen(next);
      return `Cerrado · Abre ${dayName} ${openTimeLabel(m)}`;
    }
    case "holiday": {
      const next = nextOpenFor(asset, date);
      const dayName = dayNameOfNextOpen(next);
      const flavor =
        m === "US"
          ? "Cerrado por feriado estadounidense"
          : "Cerrado por feriado";
      return `${flavor} · Abre ${dayName} ${openTimeLabel(m)}`;
    }
  }
}

/** Copy específico para el banner ARRIBA del flow de orden diferida.
 *  Más explicativo que el del hero: hace explícito que la orden se
 *  va a ejecutar al mejor precio cuando abra el mercado. */
export function deferredOrderDisclaimerFor(
  asset: Asset,
  date: Date = new Date(),
): string {
  const market = assetMarket(asset);
  const m = market === "US" ? "US" : "AR";
  const next = nextOpenFor(asset, date);
  const dayName = dayNameOfNextOpen(next);
  const time = openTimeLabel(m);
  return `El mercado está cerrado. Tu orden se ejecutará a mercado al mejor precio disponible cuando abra ${dayName} a las ${time}.`;
}

/** Etiqueta humana del activo + texto de "se programa" para el CTA
 *  del flow diferido. Devuelve "Programar compra" o "Programar venta".
 */
export function deferredCtaLabel(side: "buy" | "sell"): string {
  return side === "buy" ? "Programar compra" : "Programar venta";
}
