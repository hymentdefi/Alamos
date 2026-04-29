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
    location: "Cuenta argentina",
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
    location: "Crypto",
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

/** Liquidación que aplica al cambio de moneda. T+1 sólo cuando hay
 *  ruta MEP (ARS ↔ USD). Cripto y same-currency liquidan al toque. */
export type Settlement = "T+0" | "T+1";

export function settlementFor(
  from: AccountCurrency,
  to: AccountCurrency,
): Settlement {
  if (from === to) return "T+0";
  if ((from === "ARS" && to === "USD") || (from === "USD" && to === "ARS"))
    return "T+1";
  return "T+0";
}

/** % de spread / fee implícito por par de monedas. Mock — la API real
 *  va a devolverlo embebido en el rate de cada quote. */
export function feePctFor(
  from: AccountCurrency,
  to: AccountCurrency,
): number {
  if (from === to) return 0;
  // MEP (ARS ↔ USD): spread típico de la operatoria.
  if ((from === "ARS" && to === "USD") || (from === "USD" && to === "ARS"))
    return 0.005;
  // Cripto on-ramp / off-ramp: spread más alto que MEP.
  if (
    (from === "ARS" && to === "USDT") ||
    (from === "USDT" && to === "ARS")
  )
    return 0.007;
  // USD ↔ USDT: spread chico, casi paridad.
  return 0.002;
}

export interface BridgeOption {
  /** Cuenta de origen — desde donde se debitan los fondos. */
  from: Account;
  /** Cantidad que necesitamos debitar en la cuenta origen (incluye spread). */
  debitSource: number;
  /** Cuánto del débito se va en spread/fee. */
  feeAmountSource: number;
  /** % de fee aplicado (informativo). */
  feePct: number;
  /** Tipo de cambio efectivo (post-fee) que recibe el usuario. */
  rateNet: number;
  /** Equivalente del débito en ARS — siempre, para que el usuario tenga
   *  una sola unidad de comparación entre fuentes. */
  arsEquivalent: number;
  /** ¿Alcanza el saldo de la cuenta para cubrir la operación? */
  enough: boolean;
  /** Liquidación — T+1 si hay ruta MEP. */
  settles: Settlement;
}

/**
 * Calcula desde qué cuentas se puede tomar `targetAmount` en
 * `targetCurrency`. Ordena: primero las que ya están en la moneda
 * destino (no requieren conversión), después por mejor rate efectivo,
 * y al final las que no alcanzan.
 */
export function bridgeOptionsFor(
  targetAmount: number,
  targetCurrency: AccountCurrency,
  available: Account[] = accounts,
): BridgeOption[] {
  const opts: BridgeOption[] = available.map((acc) => {
    const fee = feePctFor(acc.currency, targetCurrency);
    const grossRate = rateBetween(acc.currency, targetCurrency);
    // Rate neto que recibe el user — gross × (1 − fee).
    const rateNet = grossRate * (1 - fee);
    // Cuánto necesitamos debitar en source para obtener target en destino.
    const debitSource = rateNet > 0 ? targetAmount / rateNet : 0;
    const feeAmountSource = debitSource * fee;
    const arsEquivalent =
      acc.currency === "ARS"
        ? debitSource
        : convertAmount(debitSource, acc.currency, "ARS");
    return {
      from: acc,
      debitSource,
      feeAmountSource,
      feePct: fee,
      rateNet,
      arsEquivalent,
      enough: acc.balance >= debitSource,
      settles: settlementFor(acc.currency, targetCurrency),
    };
  });

  return opts.sort((a, b) => {
    // Same-currency siempre primero.
    const aSame = a.from.currency === targetCurrency ? 0 : 1;
    const bSame = b.from.currency === targetCurrency ? 0 : 1;
    if (aSame !== bSame) return aSame - bSame;
    // Las que alcanzan, antes que las que no.
    if (a.enough !== b.enough) return a.enough ? -1 : 1;
    // Después por mejor rate (menos ARS-equivalente para mismo target).
    return a.arsEquivalent - b.arsEquivalent;
  });
}

/* ─── CBUs vinculados ────────────────────────────────────────── */

/**
 * Cuenta bancaria vinculada al usuario. La app permite tener varios
 * CBUs declarados (cuenta sueldo, caja de ahorro, etc.) y reenviar a
 * cualquiera cuando un débito queda "comprometido" en otro.
 */
export interface LinkedBank {
  id: string;
  /** Nombre del banco (Galicia, Santander, Brubank, etc.). */
  bank: string;
  /** Tipo de cuenta para mostrar como subtítulo. */
  alias: string;
  /** Últimos 4 dígitos del CBU — el resto se enmascara en UI. */
  last4: string;
  /** Estado: "active" disponible, "pending" en validación,
   *  "compromised" con un débito comprometido en curso. */
  status: "active" | "pending" | "compromised";
}

export const linkedBanks: LinkedBank[] = [
  {
    id: "bank-galicia",
    bank: "Galicia",
    alias: "Cuenta sueldo · CA $",
    last4: "4421",
    status: "active",
  },
  {
    id: "bank-santander",
    bank: "Santander",
    alias: "Caja de ahorro · CA $",
    last4: "9087",
    status: "active",
  },
  {
    id: "bank-brubank",
    bank: "Brubank",
    alias: "Cuenta única · CA $",
    last4: "1502",
    status: "active",
  },
];

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
