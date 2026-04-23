/**
 * BYMA (Bolsas y Mercados Argentinos) opera de lunes a viernes,
 * de 11:00 a 17:00 hora Argentina (UTC-3).
 * Fuera de ese rango se considera "fuera de mercado" y las órdenes
 * quedan en espera hasta la próxima apertura.
 */

const OPEN_HOUR = 11;
const CLOSE_HOUR = 17;

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

export function isMarketOpen(date = new Date()): boolean {
  const { day, hour } = argentinaNow(date);
  if (day === 0 || day === 6) return false;
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

/** Texto para el disclaimer cuando el mercado está cerrado. */
export function marketClosedMessage(date = new Date()): string {
  const { day, hour } = argentinaNow(date);
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) {
    return "Mercado cerrado · Las órdenes quedan pendientes hasta el lunes a las 11:00.";
  }
  if (hour < OPEN_HOUR) {
    return "Fuera de horario de mercado · Abrimos hoy a las 11:00.";
  }
  return "Mercado cerrado · Reanudamos mañana a las 11:00.";
}
