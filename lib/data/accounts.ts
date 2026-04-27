/**
 * Cuentas operativas de un usuario — distintas a los activos. Cada cuenta
 * tiene una moneda nativa, vive en una jurisdicción y rinde una tasa
 * propia. Modelo separado de `assets` porque varias comparten ticker
 * (USD argentino vs USD USA) pero son cuentas distintas.
 */

export type AccountId = "ars-ar" | "usd-ar" | "usd-us" | "usdt-crypto";

export type AccountCurrency = "ARS" | "USD" | "USDT";

/** País donde reside la cuenta. Wallets crypto no tienen país. */
export type AccountCountry = "AR" | "US";

export interface Account {
  id: AccountId;
  currency: AccountCurrency;
  /** País donde reside la cuenta — undefined para wallets crypto. */
  country?: AccountCountry;
  /** Etiqueta del lugar — se muestra debajo del ticker en la lista. */
  location: string;
  /** Saldo en la moneda nativa de la cuenta. */
  balance: number;
  /** Rendimiento anual de la cuenta (TNA / APY según corresponda). */
  yield: { label: string; pct: number };
}

export const accounts: Account[] = [
  {
    id: "ars-ar",
    currency: "ARS",
    country: "AR",
    location: "Cuenta argentina",
    balance: 342180,
    yield: { label: "% TNA", pct: 38.5 },
  },
  {
    id: "usd-ar",
    currency: "USD",
    country: "AR",
    location: "Cuenta argentina · MEP",
    balance: 850,
    yield: { label: "% anual", pct: 4.2 },
  },
  {
    id: "usd-us",
    currency: "USD",
    country: "US",
    location: "Cuenta USA",
    balance: 1240,
    yield: { label: "% APY", pct: 4.7 },
  },
  {
    id: "usdt-crypto",
    currency: "USDT",
    location: "Wallet crypto",
    balance: 580,
    yield: { label: "% APY", pct: 8.4 },
  },
];

/**
 * Tipos de cambio mock para conversión entre cuentas. Clave: "FROM-TO".
 * Cuando conectemos la API real, reemplazar por endpoints de quotes en
 * tiempo real (rate + spread).
 */
const RATES: Record<string, number> = {
  // Pesos ↔ dólares
  "ARS-USD": 1 / 1200,
  "USD-ARS": 1200,
  "ARS-USDT": 1 / 1230, // levemente peor que MEP por crypto spread
  "USDT-ARS": 1230,
  // USD ↔ USDT (paridad ~1, pequeña fee)
  "USD-USDT": 0.998,
  "USDT-USD": 0.998,
  // Misma moneda entre cuentas: 1:1
  "USD-USD": 1,
  "ARS-ARS": 1,
  "USDT-USDT": 1,
};

/** Devuelve el rate FROM→TO o 1 si no hay match. */
export function rateBetween(from: AccountCurrency, to: AccountCurrency): number {
  return RATES[`${from}-${to}`] ?? 1;
}

/** Convierte un monto entre dos monedas usando el rate mock. */
export function convertAmount(
  amount: number,
  from: AccountCurrency,
  to: AccountCurrency,
): number {
  return amount * rateBetween(from, to);
}

/** Formato del saldo en la moneda nativa de la cuenta. */
export function formatAccountBalance(a: Account): string {
  if (a.currency === "ARS") {
    return "$ " + Math.round(a.balance).toLocaleString("es-AR");
  }
  const symbol = a.currency === "USD" ? "US$" : "USDT";
  return `${symbol} ${a.balance.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
