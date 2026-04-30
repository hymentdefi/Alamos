import type { Asset } from "../data/assets";
import { assetMarket } from "../data/assets";

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

// US market en horario ART — NYSE/NASDAQ 11:30 a 18:00 (sin DST).
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
      return "Las cripto";
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
