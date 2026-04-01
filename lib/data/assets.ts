export interface Asset {
  ticker: string;
  name: string;
  category: 'acciones' | 'bonos' | 'cedears';
  price: number;
  change: number;
  held: boolean;
  qty?: number;
}

export const assets: Asset[] = [
  { ticker: 'YPFD', name: 'YPF S.A.', category: 'acciones', price: 45280, change: 4.21, held: true, qty: 12 },
  { ticker: 'GD30', name: 'Bono Global 2030', category: 'bonos', price: 72340, change: 1.87, held: true, qty: 5 },
  { ticker: 'ALUA', name: 'Aluar Aluminio', category: 'acciones', price: 1842, change: -1.33, held: true, qty: 80 },
  { ticker: 'COME', name: 'Soc. Comercial del Plata', category: 'acciones', price: 562, change: 2.94, held: false },
  { ticker: 'AAPL.BA', name: 'Apple (CEDEAR)', category: 'cedears', price: 32150, change: 0.78, held: true, qty: 8 },
  { ticker: 'AMZN.BA', name: 'Amazon (CEDEAR)', category: 'cedears', price: 28470, change: 1.52, held: false },
  { ticker: 'TSLA.BA', name: 'Tesla (CEDEAR)', category: 'cedears', price: 14890, change: -2.17, held: false },
  { ticker: 'MSFT.BA', name: 'Microsoft (CEDEAR)', category: 'cedears', price: 27830, change: 0.43, held: true, qty: 6 },
  { ticker: 'GOOGL.BA', name: 'Alphabet (CEDEAR)', category: 'cedears', price: 19650, change: 1.14, held: false },
  { ticker: 'AL30', name: 'Bono AL30', category: 'bonos', price: 68420, change: 0.62, held: true, qty: 3 },
  { ticker: 'TXAR', name: 'Ternium Argentina', category: 'acciones', price: 3240, change: 3.15, held: false },
  { ticker: 'PAMP', name: 'Pampa Energía', category: 'acciones', price: 5890, change: -0.45, held: false },
];

export const categories = [
  { id: 'all', label: 'Todos' },
  { id: 'cedears', label: 'CEDEARs' },
  { id: 'acciones', label: 'Acciones AR' },
  { id: 'bonos', label: 'Bonos' },
] as const;

export function formatARS(n: number): string {
  return '$' + n.toLocaleString('es-AR');
}
