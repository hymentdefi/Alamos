export type AssetCategory =
  | 'cedears'
  | 'acciones'
  | 'bonos'
  | 'obligaciones'
  | 'letras'
  | 'caucion'
  | 'fci';

export interface Asset {
  ticker: string;
  name: string;
  category: AssetCategory;
  price: number;
  change: number;
  held: boolean;
  qty?: number;
  favorite?: boolean;
}

export const assets: Asset[] = [
  // Acciones
  { ticker: 'YPFD', name: 'YPF S.A.', category: 'acciones', price: 45280, change: 4.21, held: true, qty: 12, favorite: true },
  { ticker: 'GGAL', name: 'Grupo Financiero Galicia', category: 'acciones', price: 5420, change: 2.15, held: false, favorite: true },
  { ticker: 'ALUA', name: 'Aluar Aluminio', category: 'acciones', price: 1842, change: -1.33, held: true, qty: 80 },
  { ticker: 'COME', name: 'Soc. Comercial del Plata', category: 'acciones', price: 562, change: 2.94, held: false },
  { ticker: 'TXAR', name: 'Ternium Argentina', category: 'acciones', price: 3240, change: 3.15, held: false },
  { ticker: 'PAMP', name: 'Pampa Energía', category: 'acciones', price: 5890, change: -0.45, held: false },
  { ticker: 'BBAR', name: 'BBVA Argentina', category: 'acciones', price: 4890, change: 1.56, held: false },
  { ticker: 'BMA', name: 'Banco Macro', category: 'acciones', price: 9450, change: 0.87, held: false },
  { ticker: 'SUPV', name: 'Grupo Supervielle', category: 'acciones', price: 2180, change: -0.62, held: false },
  { ticker: 'CEPU', name: 'Central Puerto', category: 'acciones', price: 1920, change: 1.45, held: false },
  { ticker: 'EDN', name: 'Edenor', category: 'acciones', price: 1340, change: 0.33, held: false },
  { ticker: 'TRAN', name: 'Transener', category: 'acciones', price: 890, change: -0.78, held: false },

  // CEDEARs
  { ticker: 'AAPL.BA', name: 'Apple', category: 'cedears', price: 32150, change: 0.78, held: true, qty: 8, favorite: true },
  { ticker: 'AMZN.BA', name: 'Amazon', category: 'cedears', price: 28470, change: 1.52, held: false },
  { ticker: 'TSLA.BA', name: 'Tesla', category: 'cedears', price: 14890, change: -2.17, held: false },
  { ticker: 'MSFT.BA', name: 'Microsoft', category: 'cedears', price: 27830, change: 0.43, held: true, qty: 6 },
  { ticker: 'GOOGL.BA', name: 'Alphabet', category: 'cedears', price: 19650, change: 1.14, held: false },
  { ticker: 'NVDA.BA', name: 'NVIDIA', category: 'cedears', price: 18740, change: 3.42, held: false, favorite: true },
  { ticker: 'META.BA', name: 'Meta Platforms', category: 'cedears', price: 15320, change: 0.91, held: false },
  { ticker: 'MELI.BA', name: 'MercadoLibre', category: 'cedears', price: 42100, change: 2.08, held: false },
  { ticker: 'KO.BA', name: 'Coca-Cola', category: 'cedears', price: 8920, change: 0.12, held: false },
  { ticker: 'WMT.BA', name: 'Walmart', category: 'cedears', price: 11450, change: -0.34, held: false },

  // Bonos públicos
  { ticker: 'AL30', name: 'Bono AL30 (USD Ley Arg)', category: 'bonos', price: 68420, change: 0.62, held: true, qty: 3, favorite: true },
  { ticker: 'GD30', name: 'Bono Global 2030 (USD Ley NY)', category: 'bonos', price: 72340, change: 1.87, held: true, qty: 5 },
  { ticker: 'AL35', name: 'Bono AL35 (USD Ley Arg)', category: 'bonos', price: 58200, change: 0.45, held: false },
  { ticker: 'GD35', name: 'Bono Global 2035 (USD Ley NY)', category: 'bonos', price: 61800, change: 1.12, held: false },
  { ticker: 'GD41', name: 'Bono Global 2041 (USD Ley NY)', category: 'bonos', price: 54300, change: 0.78, held: false },
  { ticker: 'AE38', name: 'Bono AE38 (USD Ley Arg)', category: 'bonos', price: 49100, change: -0.21, held: false },
  { ticker: 'TX26', name: 'Boncer TX26 (CER)', category: 'bonos', price: 15420, change: 0.15, held: false },

  // Obligaciones negociables
  { ticker: 'YPF-ON', name: 'YPF ON 2025 (USD 9%)', category: 'obligaciones', price: 102500, change: 0.08, held: false },
  { ticker: 'PAM-ON', name: 'Pampa ON 2027 (USD 7.5%)', category: 'obligaciones', price: 98700, change: 0.12, held: false },
  { ticker: 'ARC-ON', name: 'Arcor ON 2026 (USD 6%)', category: 'obligaciones', price: 101200, change: 0.05, held: false },
  { ticker: 'IRSA-ON', name: 'IRSA ON 2028 (USD 8.75%)', category: 'obligaciones', price: 97400, change: -0.15, held: false },
  { ticker: 'TGS-ON', name: 'TGS ON 2025 (USD 6.75%)', category: 'obligaciones', price: 100800, change: 0.03, held: false },

  // Letras
  { ticker: 'S30A5', name: 'LECAP 30/04/2025', category: 'letras', price: 98540, change: 0.02, held: false },
  { ticker: 'S31Y5', name: 'LECAP 31/05/2025', category: 'letras', price: 96200, change: 0.04, held: false },
  { ticker: 'S30J5', name: 'LECAP 30/06/2025', category: 'letras', price: 93800, change: 0.03, held: false },
  { ticker: 'S29G5', name: 'LECAP 29/08/2025', category: 'letras', price: 89100, change: 0.05, held: false },

  // Caución
  { ticker: 'CAUCION1', name: 'Caución 1 día (TNA 35%)', category: 'caucion', price: 100000, change: 0, held: false },
  { ticker: 'CAUCION7', name: 'Caución 7 días (TNA 36%)', category: 'caucion', price: 100000, change: 0, held: false },
  { ticker: 'CAUCION30', name: 'Caución 30 días (TNA 38%)', category: 'caucion', price: 100000, change: 0, held: false },

  // Fondos de inversión
  { ticker: 'FIMA-AHO', name: 'FIMA Ahorro Pesos', category: 'fci', price: 4250, change: 0.09, held: false },
  { ticker: 'FIMA-RFP', name: 'FIMA Renta Fija Pesos', category: 'fci', price: 6120, change: 0.11, held: false },
  { ticker: 'FIMA-ACC', name: 'FIMA Acciones', category: 'fci', price: 8340, change: 2.45, held: false },
  { ticker: 'GAL-AHO', name: 'Galicia Ahorro', category: 'fci', price: 3890, change: 0.08, held: false },
  { ticker: 'SBS-RV', name: 'SBS Renta Variable', category: 'fci', price: 12450, change: 1.87, held: false },
];

export const assetCategories = [
  { id: 'cedears' as const, label: 'CEDEARs' },
  { id: 'acciones' as const, label: 'Acciones' },
  { id: 'bonos' as const, label: 'Bonos' },
  { id: 'obligaciones' as const, label: 'ONs' },
  { id: 'letras' as const, label: 'Letras' },
  { id: 'caucion' as const, label: 'Caución' },
  { id: 'fci' as const, label: 'Fondos' },
  { id: 'favoritos' as const, label: 'Favoritos' },
];

export function formatARS(n: number): string {
  return '$' + n.toLocaleString('es-AR');
}
