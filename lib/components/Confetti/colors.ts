/**
 * Paleta verde inspirada en el comercial "Confetti Office" de
 * Robinhood (Super Bowl LIV) — versión Álamos. Pesos sumados = 100,
 * la selección random es ponderada (no uniforme) para que el verde
 * primario domine visualmente.
 *
 * Verde de marca: #00C805 (mismo que `brand.green` en lib/theme).
 * Las otras tonalidades son vecinas cromáticas para que la familia
 * se sienta coherente sin ser monocroma plana.
 */
export interface PaletteEntry {
  hex: string;
  weight: number;
}

export const PALETTE: readonly PaletteEntry[] = [
  { hex: "#00C805", weight: 45 }, // verde primario Álamos (brand.green)
  { hex: "#009A04", weight: 20 }, // verde profundo
  { hex: "#4DEB55", weight: 18 }, // verde claro
  { hex: "#B8FFB5", weight: 10 }, // verde casi blanco
  { hex: "#FFFFFF", weight: 7 },  // blanco puro
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
