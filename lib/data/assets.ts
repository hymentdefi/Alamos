export type AssetCategory =
  | "efectivo"
  | "cedears"
  | "acciones"
  | "bonos"
  | "obligaciones"
  | "letras"
  | "caucion"
  | "fci";

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
}

export const assets: Asset[] = [
  // ─── Efectivo (es un activo más de la cartera) ───
  {
    ticker: "ARS",
    name: "Pesos argentinos",
    subLabel: "Efectivo · Disponible",
    iconCode: "$",
    iconTone: "accent",
    category: "efectivo",
    price: 1,
    change: 0,
    held: true,
    qty: 342180,
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
  efectivo: "Efectivo",
  cedears: "CEDEARs",
  bonos: "Bonos",
  fci: "Fondos",
  acciones: "Acciones AR",
  obligaciones: "Obligaciones",
  letras: "Letras",
  caucion: "Caución",
};

export function formatARS(n: number): string {
  return "$ " + Math.abs(n).toLocaleString("es-AR");
}

export function formatPct(n: number, withSign = true): string {
  const sign = n > 0 && withSign ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(2).replace(".", ",")}%`;
}

export function assetIconCode(asset: Pick<Asset, "ticker" | "iconCode">): string {
  return asset.iconCode ?? asset.ticker.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
}
