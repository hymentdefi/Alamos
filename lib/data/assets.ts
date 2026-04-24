export type AssetCategory =
  | "efectivo"
  | "cedears"
  | "acciones"
  | "bonos"
  | "obligaciones"
  | "letras"
  | "caucion"
  | "fci"
  | "crypto"
  | "futuros"
  | "opciones";

export interface Asset {
  ticker: string;
  name: string;
  /** Una línea corta que acompaña al ticker en listas (ej: "Apple · CEDEAR"). */
  subLabel: string;
  /** 2 caracteres para el ícono cuadrado — si no, se usan los 2 primeros del ticker. */
  iconCode?: string;
  /** Variante visual del ícono en listas. */
  iconTone?: "dark" | "neutral" | "accent";
  category: AssetCategory;
  /** Precio actual en ARS. Para efectivo = 1. */
  price: number;
  /** Variación del día en %. Para efectivo = 0. */
  change: number;
  held: boolean;
  qty?: number;
  favorite?: boolean;
  /** Volumen 24h en unidades de cotización (solo crypto/futuros). */
  volume24h?: number;
  /** Apalancamiento máximo disponible (solo futuros). */
  maxLeverage?: number;
  /** Funding rate % cada 8h (solo futuros perpetuos). */
  fundingRate?: number;
  /**
   * Tasa anual de rendimiento — para FCI money-market/renta fija es la
   * TNA; para FCI renta variable es el rendimiento histórico 12M.
   * Si no está, no se muestra esa columna en listas.
   */
  annualYield?: number;
}

export const assets: Asset[] = [
  // ─── Dinero (pesos y dólares como activos) ───
  {
    ticker: "ARS",
    name: "Pesos",
    subLabel: "Listos para invertir",
    iconCode: "$",
    iconTone: "accent",
    category: "efectivo",
    price: 1,
    change: 0,
    held: true,
    qty: 342180,
  },
  {
    ticker: "USD",
    name: "Dólares",
    subLabel: "Dólar MEP · saldo",
    iconCode: "US",
    iconTone: "dark",
    category: "efectivo",
    price: 1200, // tipo de cambio mock — dólar MEP en ARS
    change: 0,
    held: true,
    qty: 850,
  },

  // ─── CEDEARs (acciones USA representadas localmente) ───
  {
    ticker: "AAPL",
    name: "Apple",
    subLabel: "Apple · CEDEAR",
    iconCode: "AA",
    iconTone: "dark",
    category: "cedears",
    price: 24120,
    change: 2.4,
    held: true,
    qty: 8,
    favorite: true,
  },
  {
    ticker: "MSFT",
    name: "Microsoft",
    subLabel: "Microsoft · CEDEAR",
    iconCode: "MS",
    category: "cedears",
    price: 27830,
    change: 0.43,
    held: true,
    qty: 6,
  },
  {
    ticker: "NVDA",
    name: "NVIDIA",
    subLabel: "NVIDIA · CEDEAR",
    iconCode: "NV",
    category: "cedears",
    price: 18740,
    change: 3.42,
    held: false,
    favorite: true,
  },
  {
    ticker: "AMZN",
    name: "Amazon",
    subLabel: "Amazon · CEDEAR",
    iconCode: "AM",
    category: "cedears",
    price: 28470,
    change: 1.52,
    held: false,
  },
  {
    ticker: "TSLA",
    name: "Tesla",
    subLabel: "Tesla · CEDEAR",
    iconCode: "TS",
    category: "cedears",
    price: 14890,
    change: -2.17,
    held: false,
  },
  {
    ticker: "GOOGL",
    name: "Alphabet",
    subLabel: "Alphabet · CEDEAR",
    iconCode: "GO",
    category: "cedears",
    price: 19650,
    change: 1.14,
    held: false,
  },
  {
    ticker: "META",
    name: "Meta Platforms",
    subLabel: "Meta · CEDEAR",
    iconCode: "ME",
    category: "cedears",
    price: 15320,
    change: 0.91,
    held: false,
  },
  {
    ticker: "MELI",
    name: "MercadoLibre",
    subLabel: "MercadoLibre · CEDEAR",
    iconCode: "ML",
    category: "cedears",
    price: 42100,
    change: 2.08,
    held: false,
  },
  {
    ticker: "KO",
    name: "Coca-Cola",
    subLabel: "Coca-Cola · CEDEAR",
    iconCode: "KO",
    category: "cedears",
    price: 8920,
    change: 0.12,
    held: false,
  },
  {
    ticker: "WMT",
    name: "Walmart",
    subLabel: "Walmart · CEDEAR",
    iconCode: "WM",
    category: "cedears",
    price: 11450,
    change: -0.34,
    held: false,
  },

  // ─── Bonos soberanos ───
  {
    ticker: "AL30",
    name: "Bonar 2030",
    subLabel: "Bonar 2030 · Ley AR",
    iconCode: "AL",
    category: "bonos",
    price: 71540,
    change: 0.8,
    held: true,
    qty: 3,
    favorite: true,
  },
  {
    ticker: "GD30",
    name: "Bono Global 2030",
    subLabel: "Global 2030 · Ley NY",
    iconCode: "GD",
    category: "bonos",
    price: 72340,
    change: 1.87,
    held: true,
    qty: 5,
  },
  {
    ticker: "AL35",
    name: "Bonar 2035",
    subLabel: "Bonar 2035 · Ley AR",
    iconCode: "AL",
    category: "bonos",
    price: 58200,
    change: 0.45,
    held: false,
  },
  {
    ticker: "GD35",
    name: "Bono Global 2035",
    subLabel: "Global 2035 · Ley NY",
    iconCode: "GD",
    category: "bonos",
    price: 61800,
    change: 1.12,
    held: false,
  },
  {
    ticker: "GD41",
    name: "Bono Global 2041",
    subLabel: "Global 2041 · Ley NY",
    iconCode: "GD",
    category: "bonos",
    price: 54300,
    change: 0.78,
    held: false,
  },
  {
    ticker: "AE38",
    name: "Bonar 2038",
    subLabel: "Bonar 2038 · Ley AR",
    iconCode: "AE",
    category: "bonos",
    price: 49100,
    change: -0.21,
    held: false,
  },
  {
    ticker: "TX26",
    name: "Boncer TX26",
    subLabel: "Boncer · CER",
    iconCode: "TX",
    category: "bonos",
    price: 15420,
    change: 0.15,
    held: false,
  },

  // ─── Fondos comunes de inversión ───
  {
    ticker: "BAL-AHO",
    name: "Balanz Ahorro",
    subLabel: "FCI · Pesos",
    iconCode: "FC",
    category: "fci",
    price: 12840,
    change: -0.1,
    held: true,
    qty: 1,
    annualYield: 42.5,
  },
  {
    ticker: "FIMA-AHO",
    name: "FIMA Ahorro Pesos",
    subLabel: "FCI · Pesos",
    iconCode: "FI",
    category: "fci",
    price: 4250,
    change: 0.09,
    held: false,
    annualYield: 38.8,
  },
  {
    ticker: "FIMA-RFP",
    name: "FIMA Renta Fija",
    subLabel: "FCI · Pesos",
    iconCode: "FI",
    category: "fci",
    price: 6120,
    change: 0.11,
    held: false,
    annualYield: 48.2,
  },
  {
    ticker: "FIMA-ACC",
    name: "FIMA Acciones",
    subLabel: "FCI · Renta Variable",
    iconCode: "FI",
    category: "fci",
    price: 8340,
    change: 2.45,
    held: false,
    annualYield: 85.3,
  },
  {
    ticker: "GAL-AHO",
    name: "Galicia Ahorro",
    subLabel: "FCI · Pesos",
    iconCode: "GA",
    category: "fci",
    price: 3890,
    change: 0.08,
    held: false,
    annualYield: 40.1,
  },
  {
    ticker: "SBS-RV",
    name: "SBS Renta Variable",
    subLabel: "FCI · Renta Variable",
    iconCode: "SB",
    category: "fci",
    price: 12450,
    change: 1.87,
    held: false,
    annualYield: 74.6,
  },

  // ─── Acciones argentinas ───
  {
    ticker: "YPFD",
    name: "YPF S.A.",
    subLabel: "YPF · Acción AR",
    iconCode: "YP",
    category: "acciones",
    price: 45280,
    change: 4.21,
    held: false,
  },
  {
    ticker: "GGAL",
    name: "Grupo Galicia",
    subLabel: "Galicia · Acción AR",
    iconCode: "GG",
    category: "acciones",
    price: 5420,
    change: 2.15,
    held: false,
  },
  {
    ticker: "PAMP",
    name: "Pampa Energía",
    subLabel: "Pampa · Acción AR",
    iconCode: "PA",
    category: "acciones",
    price: 5890,
    change: -0.45,
    held: false,
  },
  {
    ticker: "BMA",
    name: "Banco Macro",
    subLabel: "Macro · Acción AR",
    iconCode: "BM",
    category: "acciones",
    price: 9450,
    change: 0.87,
    held: false,
  },

  // ─── Obligaciones negociables ───
  {
    ticker: "YPF-ON",
    name: "YPF ON 2025",
    subLabel: "ON YPF · USD 9%",
    iconCode: "YP",
    category: "obligaciones",
    price: 102500,
    change: 0.08,
    held: false,
  },
  {
    ticker: "PAM-ON",
    name: "Pampa ON 2027",
    subLabel: "ON Pampa · USD 7.5%",
    iconCode: "PA",
    category: "obligaciones",
    price: 98700,
    change: 0.12,
    held: false,
  },

  // ─── Letras ───
  {
    ticker: "S30A5",
    name: "LECAP 30/04/2025",
    subLabel: "Letra capitalizable",
    iconCode: "LE",
    category: "letras",
    price: 98540,
    change: 0.02,
    held: false,
  },

  // ─── Caución ───
  {
    ticker: "CAU1",
    name: "Caución 1 día",
    subLabel: "TNA 35% · Pesos",
    iconCode: "CA",
    category: "caucion",
    price: 100000,
    change: 0,
    held: false,
  },

  // ─── Crypto Spot (solo visible en Alamos Pro) ───
  {
    ticker: "BTC/USDT",
    name: "Bitcoin",
    subLabel: "BTC · Spot",
    iconCode: "BT",
    iconTone: "dark",
    category: "crypto",
    price: 67432.5,
    change: 1.24,
    held: false,
    volume24h: 42_500_000_000,
  },
  {
    ticker: "ETH/USDT",
    name: "Ethereum",
    subLabel: "ETH · Spot",
    iconCode: "ET",
    iconTone: "dark",
    category: "crypto",
    price: 3284.15,
    change: -0.91,
    held: false,
    volume24h: 12_300_000_000,
  },
  {
    ticker: "SOL/USDT",
    name: "Solana",
    subLabel: "SOL · Spot",
    iconCode: "SO",
    iconTone: "dark",
    category: "crypto",
    price: 142.82,
    change: 3.22,
    held: false,
    volume24h: 2_800_000_000,
  },
  {
    ticker: "BNB/USDT",
    name: "BNB",
    subLabel: "BNB · Spot",
    iconCode: "BN",
    iconTone: "dark",
    category: "crypto",
    price: 584.3,
    change: 0.74,
    held: false,
    volume24h: 1_150_000_000,
  },
  {
    ticker: "XRP/USDT",
    name: "XRP",
    subLabel: "XRP · Spot",
    iconCode: "XR",
    iconTone: "dark",
    category: "crypto",
    price: 0.52,
    change: -1.15,
    held: false,
    volume24h: 980_000_000,
  },
  {
    ticker: "ADA/USDT",
    name: "Cardano",
    subLabel: "ADA · Spot",
    iconCode: "AD",
    iconTone: "dark",
    category: "crypto",
    price: 0.45,
    change: 1.87,
    held: false,
    volume24h: 420_000_000,
  },
  {
    ticker: "LINK/USDT",
    name: "Chainlink",
    subLabel: "LINK · Spot",
    iconCode: "LI",
    iconTone: "dark",
    category: "crypto",
    price: 14.32,
    change: 2.14,
    held: false,
    volume24h: 380_000_000,
  },
  {
    ticker: "AVAX/USDT",
    name: "Avalanche",
    subLabel: "AVAX · Spot",
    iconCode: "AV",
    iconTone: "dark",
    category: "crypto",
    price: 32.41,
    change: -2.37,
    held: false,
    volume24h: 310_000_000,
  },

  // ─── Futuros perpetuos USDT-M ───
  {
    ticker: "BTCUSDT.P",
    name: "BTC Perpetuo",
    subLabel: "Futuro USDT-M · 125x",
    iconCode: "BT",
    iconTone: "dark",
    category: "futuros",
    price: 67445.2,
    change: 1.28,
    held: false,
    volume24h: 82_000_000_000,
    maxLeverage: 125,
    fundingRate: 0.0089,
  },
  {
    ticker: "ETHUSDT.P",
    name: "ETH Perpetuo",
    subLabel: "Futuro USDT-M · 100x",
    iconCode: "ET",
    iconTone: "dark",
    category: "futuros",
    price: 3286.4,
    change: -0.88,
    held: false,
    volume24h: 28_500_000_000,
    maxLeverage: 100,
    fundingRate: 0.0052,
  },
  {
    ticker: "SOLUSDT.P",
    name: "SOL Perpetuo",
    subLabel: "Futuro USDT-M · 50x",
    iconCode: "SO",
    iconTone: "dark",
    category: "futuros",
    price: 143.05,
    change: 3.34,
    held: false,
    volume24h: 5_200_000_000,
    maxLeverage: 50,
    fundingRate: 0.0124,
  },
  {
    ticker: "DOGEUSDT.P",
    name: "DOGE Perpetuo",
    subLabel: "Futuro USDT-M · 75x",
    iconCode: "DO",
    iconTone: "dark",
    category: "futuros",
    price: 0.168,
    change: 4.22,
    held: false,
    volume24h: 2_100_000_000,
    maxLeverage: 75,
    fundingRate: 0.018,
  },
  {
    ticker: "ARBUSDT.P",
    name: "ARB Perpetuo",
    subLabel: "Futuro USDT-M · 50x",
    iconCode: "AR",
    iconTone: "dark",
    category: "futuros",
    price: 0.742,
    change: -2.54,
    held: false,
    volume24h: 340_000_000,
    maxLeverage: 50,
    fundingRate: -0.0034,
  },
  {
    ticker: "OPUSDT.P",
    name: "OP Perpetuo",
    subLabel: "Futuro USDT-M · 50x",
    iconCode: "OP",
    iconTone: "dark",
    category: "futuros",
    price: 1.85,
    change: 1.67,
    held: false,
    volume24h: 280_000_000,
    maxLeverage: 50,
    fundingRate: 0.0041,
  },
];

export const assetCategories = [
  { id: "cedears" as const, label: "CEDEARs" },
  { id: "bonos" as const, label: "Bonos" },
  { id: "fci" as const, label: "Fondos" },
  { id: "acciones" as const, label: "Acciones" },
  { id: "obligaciones" as const, label: "ONs" },
  { id: "letras" as const, label: "Letras" },
  { id: "caucion" as const, label: "Caución" },
  { id: "efectivo" as const, label: "Efectivo" },
  { id: "favoritos" as const, label: "Favoritos" },
];

/** Labels de categorías para display en grupos / leyendas. */
export const categoryLabels: Record<AssetCategory, string> = {
  efectivo: "Dinero",
  cedears: "CEDEARs",
  bonos: "Bonos",
  fci: "Fondos",
  acciones: "Acciones AR",
  obligaciones: "Obligaciones",
  letras: "Letras",
  caucion: "Caución",
  crypto: "Crypto",
  futuros: "Futuros",
  opciones: "Opciones",
};

/** Formatea un volumen grande como "42.5B", "128.3M", etc. */
export function formatVolume(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

export function formatARS(n: number): string {
  return "$ " + Math.abs(n).toLocaleString("es-AR");
}

/**
 * Formatea una cantidad (acciones, cuotapartes, cripto) con separador
 * decimal ',' y de miles '.' al estilo argentino, sin ceros finales
 * innecesarios. Hasta `maxDecimals` decimales.
 */
export function formatQty(n: number, maxDecimals = 4): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Separa un monto en sus partes para poder renderizar los decimales más
 * chicos que la parte entera (estilo Robinhood / apps bancarias).
 */
export function formatARSParts(n: number): {
  sign: string;
  integer: string;
  decimals: string;
} {
  const abs = Math.abs(n);
  const [int, dec = "00"] = abs.toFixed(2).split(".");
  const integerFormatted = Number(int).toLocaleString("es-AR");
  return { sign: "$", integer: integerFormatted, decimals: dec };
}

export function formatPct(n: number, withSign = true): string {
  const sign = n > 0 && withSign ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2).replace(".", ",")}%`;
}

export function assetIconCode(asset: Pick<Asset, "ticker" | "iconCode">): string {
  return asset.iconCode ?? asset.ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
}
