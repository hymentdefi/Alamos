/**
 * Paleta verde inspirada en el comercial "Confetti Office" de
 * Robinhood (Super Bowl LIV) — versión Álamos. Pesos sumados = 100,
 * la selección random es ponderada (no uniforme) para que el verde
 * primario domine visualmente.
 */
export interface PaletteEntry {
  hex: string;
  weight: number;
}

export const PALETTE: readonly PaletteEntry[] = [
  { hex: "#00e676", weight: 45 }, // verde primario Álamos
  { hex: "#00b85c", weight: 20 }, // verde profundo
  { hex: "#5cffa8", weight: 18 }, // verde claro
  { hex: "#c8ffe0", weight: 10 }, // verde casi blanco
  { hex: "#ffffff", weight: 7 },  // blanco puro
];

const TOTAL_WEIGHT = PALETTE.reduce((s, p) => s + p.weight, 0);

/**
 * Picker ponderado. `rng` permite inyectar un RNG determinístico para
 * tests; default `Math.random`.
 */
export function pickColor(rng: () => number = Math.random): string {
  let r = rng() * TOTAL_WEIGHT;
  for (const c of PALETTE) {
    r -= c.weight;
    if (r <= 0) return c.hex;
  }
  return PALETTE[0].hex;
}
