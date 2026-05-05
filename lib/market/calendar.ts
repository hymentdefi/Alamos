/**
 * Calendario de feriados de mercado — Argentina (BYMA) y Estados
 * Unidos (NYSE/NASDAQ) — hardcodeado para 2026.
 *
 * TODO: mover a config externa (JSON descargado del backend o un
 * service que mantenga el calendario actualizado). Hardcodear acá
 * sirve para v1 pero el calendario hay que renovarlo cada año.
 *
 * Fuentes:
 *   - AR: feriados nacionales declarados por decreto.
 *   - US: NYSE/NASDAQ holiday schedule (los dos coinciden).
 *
 * Las fechas están en formato YYYY-MM-DD interpretadas en el huso
 * horario del mercado correspondiente (no UTC). El comparador
 * `isHoliday` usa el día calendario local del mercado.
 */

export type MarketCode = "AR" | "US";

export interface Holiday {
  /** YYYY-MM-DD en el huso del mercado. */
  date: string;
  /** Nombre humano para mostrar en el copy de "cerrado por". */
  label: string;
}

/* ─── 2026 — Argentina ─────────────────────────────────────────── */
const HOLIDAYS_AR_2026: Holiday[] = [
  { date: "2026-01-01", label: "Año Nuevo" },
  { date: "2026-02-16", label: "Carnaval" },
  { date: "2026-02-17", label: "Carnaval" },
  { date: "2026-03-24", label: "Día Nacional de la Memoria" },
  { date: "2026-04-02", label: "Día del Veterano de Malvinas" },
  { date: "2026-04-03", label: "Viernes Santo" },
  { date: "2026-05-01", label: "Día del Trabajador" },
  { date: "2026-05-25", label: "Día de la Revolución de Mayo" },
  // Manuel Belgrano se traslada al lunes más cercano cuando cae fin
  // de semana — en 2026 el 20/jun es sábado, observado 15/jun.
  { date: "2026-06-15", label: "Día de la Bandera (observado)" },
  { date: "2026-07-09", label: "Día de la Independencia" },
  { date: "2026-08-17", label: "Paso a la Inmortalidad de San Martín" },
  { date: "2026-10-12", label: "Día del Respeto a la Diversidad Cultural" },
  { date: "2026-11-23", label: "Día de la Soberanía Nacional" },
  { date: "2026-12-08", label: "Inmaculada Concepción" },
  { date: "2026-12-25", label: "Navidad" },
];

/* ─── 2026 — Estados Unidos (NYSE / NASDAQ) ─────────────────────── */
const HOLIDAYS_US_2026: Holiday[] = [
  { date: "2026-01-01", label: "New Year's Day" },
  { date: "2026-01-19", label: "Martin Luther King Jr. Day" },
  { date: "2026-02-16", label: "Presidents' Day" },
  { date: "2026-04-03", label: "Good Friday" },
  { date: "2026-05-25", label: "Memorial Day" },
  { date: "2026-06-19", label: "Juneteenth" },
  // Independence Day cae sábado en 2026 — observado el viernes 3.
  { date: "2026-07-03", label: "Independence Day (observed)" },
  { date: "2026-09-07", label: "Labor Day" },
  { date: "2026-11-26", label: "Thanksgiving" },
  { date: "2026-12-25", label: "Christmas" },
];

const HOLIDAYS: Record<MarketCode, Holiday[]> = {
  AR: HOLIDAYS_AR_2026,
  US: HOLIDAYS_US_2026,
};

/** Lookup rápido: pasa un YYYY-MM-DD y devuelve el feriado si lo es. */
export function holidayOn(
  market: MarketCode,
  ymd: string,
): Holiday | undefined {
  return HOLIDAYS[market].find((h) => h.date === ymd);
}

/** True si esa fecha es feriado para el mercado. */
export function isHoliday(market: MarketCode, ymd: string): boolean {
  return holidayOn(market, ymd) !== undefined;
}

/** Devuelve TODOS los feriados conocidos para inspección/debug. */
export function allHolidays(market: MarketCode): readonly Holiday[] {
  return HOLIDAYS[market];
}
