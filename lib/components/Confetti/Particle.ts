import { Skia, type SkColor } from "@shopify/react-native-skia";
import { PALETTE } from "./colors";

/**
 * Sistema de partículas worklet-friendly. Sin clases, sin métodos —
 * data interface plana + funciones puras con `'worklet'` directive
 * que pueden correr en el UI thread vía Reanimated.
 *
 * Tuning post-research (Cash App / Strava / Duolingo):
 *   - 70% sale al hemisferio superior, 30% lateral.
 *   - Velocidades en 3 buckets temporales (rápidas/medias/lentas).
 *   - Tamaños bimodal (polvo + hero).
 *   - Gravedad fuerte (700) + TTL corto (1.8-2.4s) — libera la
 *     pantalla rápido para que el card sea legible.
 *
 * Overrides opcionales (speedScale / sizeRange / ttlRange / speedRange):
 *   permiten que las etapas posteriores del burst secuencial (encore,
 *   sparkle tail) usen distintas físicas sin duplicar la función.
 *
 * El color se almacena como ÍNDICE a la paleta precomputada (no como
 * Float32Array por partícula) — ahorra alocaciones y permite que la
 * paleta se mantenga en `colors.ts` como source of truth.
 */

export const SHAPE_SQUARE = 0;
export const SHAPE_CIRCLE = 1;
export const SHAPE_TRIANGLE = 2;
export type ShapeId = 0 | 1 | 2;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  ttl: number;
  age: number;
  alpha: number;
  /** Índice dentro de PALETTE_COLORS — el draw worklet hace lookup. */
  colorIdx: number;
  shape: ShapeId;
}

export interface SpawnOpts {
  /** Multiplica la velocidad pickeada por pickSpeed. */
  speedScale?: number;
  /** Override del rango de tamaño absoluto (px). */
  sizeRange?: [number, number];
  /** Override del rango de TTL absoluto (ms). */
  ttlRange?: [number, number];
  /** Override del rango de velocidad absoluto (px/s) — ignora pickSpeed. */
  speedRange?: [number, number];
}

/**
 * Paleta precomputada como SkColor (Float32Array [r,g,b,a]) para que
 * el draw worklet no tenga que parsear hex strings por frame. Una
 * sola alocación por color al cargar el módulo, después se reusa.
 */
export const PALETTE_COLORS: SkColor[] = PALETTE.map((p) => Skia.Color(p.hex));

const PALETTE_WEIGHTS: number[] = PALETTE.map((p) => p.weight);
const PALETTE_TOTAL: number = PALETTE_WEIGHTS.reduce((a, b) => a + b, 0);

const TAU = Math.PI * 2;
const GRAVITY = 700; // px/s²
const DRAG_PER_60FPS_FRAME = 0.985;

/* ─── Pickers (worklets puros, sin closures) ──────────────────────── */

function pickAngle(): number {
  "worklet";
  const r = Math.random();
  if (r < 0.7) {
    // Cono superior 90° centrado en -90° (up).
    return -Math.PI * 0.75 + Math.random() * Math.PI * 0.5;
  }
  // Lateral ±45° desde horizontal, izquierda o derecha al azar.
  const offset = (Math.random() - 0.5) * Math.PI * 0.5;
  const goesRight = Math.random() < 0.5;
  return goesRight ? offset : Math.PI + offset;
}

function pickSpeedDefault(): number {
  "worklet";
  const r = Math.random();
  if (r < 0.25) return 720 + Math.random() * 360; // rápidas
  if (r < 0.75) return 420 + Math.random() * 300; // medianas
  return 240 + Math.random() * 180; // lentas
}

function pickSizeDefault(): number {
  "worklet";
  const r = Math.random();
  if (r < 0.3) return 4 + Math.random() * 3; // chicas
  if (r < 0.8) return 8 + Math.random() * 4; // medianas
  return 14 + Math.random() * 4; // hero
}

function pickColorIdx(): number {
  "worklet";
  let r = Math.random() * PALETTE_TOTAL;
  for (let i = 0; i < PALETTE_WEIGHTS.length; i++) {
    r -= PALETTE_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

function pickShape(): ShapeId {
  "worklet";
  return ((Math.random() * 3) | 0) as ShapeId;
}

/* ─── Lifecycle worklets ──────────────────────────────────────────── */

/**
 * Crea una partícula nueva. Pure worklet — no muta nada externo,
 * devuelve un objeto plano que puede vivir en una SharedValue<Particle[]>.
 */
export function makeParticle(
  x: number,
  y: number,
  opts: SpawnOpts,
): Particle {
  "worklet";
  const angle = pickAngle();
  const speed = opts.speedRange
    ? opts.speedRange[0] +
      Math.random() * (opts.speedRange[1] - opts.speedRange[0])
    : pickSpeedDefault() * (opts.speedScale ?? 1);
  const size = opts.sizeRange
    ? opts.sizeRange[0] +
      Math.random() * (opts.sizeRange[1] - opts.sizeRange[0])
    : pickSizeDefault();
  const ttl = opts.ttlRange
    ? opts.ttlRange[0] +
      Math.random() * (opts.ttlRange[1] - opts.ttlRange[0])
    : 1800 + Math.random() * 600;
  return {
    // Jitter ±20px en X — el burst no se ve como un chorro alineado.
    x: x + (Math.random() * 40 - 20),
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: Math.random() * TAU,
    rotationSpeed: (Math.random() * 6 - 3) * Math.PI, // ±3π rad/s
    size,
    ttl,
    age: 0,
    alpha: 1,
    colorIdx: pickColorIdx(),
    shape: pickShape(),
  };
}

/**
 * Avanza una partícula `dt` ms. Muta in-place porque vive dentro
 * de una SharedValue<Particle[]> que reasignamos vía .modify().
 */
export function updateParticle(p: Particle, dt: number, canvasH: number) {
  "worklet";
  const s = dt / 1000;
  p.x += p.vx * s;
  p.y += p.vy * s;
  p.vy += GRAVITY * s;
  p.vx *= Math.pow(DRAG_PER_60FPS_FRAME, s * 60);
  p.rotation += p.rotationSpeed * s;
  p.age += dt;

  // Fade-out: por TTL (último 25%) o por estar saliendo del frame
  // (y > 90%) — el más alto domina.
  const ttlRatio = p.age / p.ttl;
  const yRatio = canvasH > 0 ? p.y / canvasH : 0;
  let fadeProgress = 0;
  if (ttlRatio > 0.75) fadeProgress = (ttlRatio - 0.75) / 0.25;
  if (yRatio > 0.9) {
    const yFade = (yRatio - 0.9) / 0.1;
    if (yFade > fadeProgress) fadeProgress = yFade;
  }
  p.alpha = Math.max(0, Math.min(1, 1 - fadeProgress));
}

export function isParticleDead(
  p: Particle,
  canvasW: number,
  canvasH: number,
): boolean {
  "worklet";
  return (
    p.alpha <= 0 ||
    p.age >= p.ttl ||
    p.x < -50 ||
    p.x > canvasW + 50 ||
    p.y > canvasH + 50
  );
}

/** Para el "flip 3D" de los cuadrados — scale Y oscilante por rotación. */
export function squareScaleY(rotation: number): number {
  "worklet";
  return Math.max(0.2, Math.abs(Math.cos(rotation * 2.0)));
}
