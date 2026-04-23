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

export function isMarketOpen(date = new Date()): boolean {
  const { day, hour, minute } = argentinaNow(date);
  if (day === 0 || day === 6) return false;
  const mins = minutesOfDay(hour, minute);
  return mins >= OPEN_MINS && mins < CLOSE_MINS;
}

/** Texto para el disclaimer cuando el mercado está cerrado. */
export function marketClosedMessage(date = new Date()): string {
  const { day, hour, minute } = argentinaNow(date);
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) {
    return "Mercado cerrado · Las órdenes quedan pendientes hasta el lunes a las 10:30.";
  }
  if (minutesOfDay(hour, minute) < OPEN_MINS) {
    return "Fuera de horario de mercado · Abrimos hoy a las 10:30.";
  }
  return "Mercado cerrado · Reanudamos mañana a las 10:30.";
}
