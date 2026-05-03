/**
 * Partícula individual de confetti. Pure JS, sin React ni Skia —
 * fácil de testear y rápida de actualizar en bulk. La instancia se
 * mutea in-place cada frame para evitar churn de GC durante el
 * burst.
 *
 * Tuning post-research (Cash App / Strava / Duolingo):
 *   - 70% sale al hemisferio superior, 30% lateral → no es solo un
 *     géiser hacia arriba, hay partículas que cruzan en horizontal.
 *   - Distribución de velocidades en 3 buckets (rápidas/medias/lentas)
 *     → 3 olas temporales en vez de un único pico.
 *   - Distribución de tamaños bimodal → mezcla "polvo" + "hero" para
 *     que la animación se lea rica, no homogénea.
 *   - Gravedad fuerte (700) + TTL más corto (1800-2400ms) → libera
 *     el card del trade rápido para que sea legible.
 *
 * Overrides opcionales (speedScale / sizeRange / ttlRange): permiten
 * que las etapas posteriores del burst secuencial (encore, sparkle
 * tail) usen distintas físicas sin duplicar la clase entera.
 */

export type Shape = "square" | "circle" | "triangle";

export interface SpawnInput {
  x: number;
  y: number;
  color: string;
  shape: Shape;
  rng?: () => number;
  /** Multiplica la velocidad pickeada por pickSpeed. Default 1.
   *  El encore usa 0.7 → partículas que viajan menos lejos. */
  speedScale?: number;
  /** Override del rango de tamaño (px). Si está, ignora pickSize.
   *  El sparkle tail usa [4, 6] → "polvo" muy fino. */
  sizeRange?: [number, number];
  /** Override del rango de TTL (ms). Si está, ignora el default
   *  1800-2400. El sparkle tail usa [2500, 3500] → flota largo. */
  ttlRange?: [number, number];
  /** Override del rango de velocidad ABSOLUTO (px/s). Si está,
   *  ignora pickSpeed entera (y por ende speedScale no aplica).
   *  El sparkle tail usa [200, 400]. */
  speedRange?: [number, number];
}

const TAU = Math.PI * 2;
const GRAVITY = 700; // px/s² — más fuerte que antes (520) para
                     // liberar la pantalla en ~1.5s
const DRAG_PER_60FPS_FRAME = 0.985; // frenado lateral más agresivo
                                    // (antes 0.992) — menos deriva

/** Picker de ángulo inicial (en radianes, math convention con
 *  Y-down). 70% al hemisferio superior, 30% lateral (mitad a cada
 *  costado). */
function pickAngle(rng: () => number): number {
  const r = rng();
  if (r < 0.7) {
    // -135° a -45° = -3π/4 a -π/4 (cono de 90° centrado sobre -90°/up)
    return -Math.PI * 0.75 + rng() * Math.PI * 0.5;
  }
  // Lateral: ±45° desde la horizontal, izquierda o derecha al azar.
  const offset = (rng() - 0.5) * Math.PI * 0.5; // -π/4 a +π/4
  const goesRight = rng() < 0.5;
  return goesRight ? offset : Math.PI + offset;
}

/** Picker de velocidad — 3 buckets temporales. Bumpeado +20% sobre
 *  los valores originales para que el burst se sienta más explosivo:
 *  las rápidas llegan al borde de pantalla, las medianas pueblan el
 *  campo visual, las lentas dan el "polvo" que cae cerca del origen. */
function pickSpeed(rng: () => number): number {
  const r = rng();
  if (r < 0.25) return 720 + rng() * 360; // 25% rápidas (720-1080)
  if (r < 0.75) return 420 + rng() * 300; // 50% medianas (420-720)
  return 240 + rng() * 180;               // 25% lentas (240-420)
}

/** Picker de tamaño — bimodal con hero particles. */
function pickSize(rng: () => number): number {
  const r = rng();
  if (r < 0.30) return 4 + rng() * 3;  // 30% chicas (4-7)
  if (r < 0.80) return 8 + rng() * 4;  // 50% medianas (8-12)
  return 14 + rng() * 4;               // 20% grandes/hero (14-18)
}

export class Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  ttl: number;
  age = 0;
  alpha = 1;
  color: string;
  shape: Shape;

  constructor({
    x,
    y,
    color,
    shape,
    rng = Math.random,
    speedScale = 1,
    sizeRange,
    ttlRange,
    speedRange,
  }: SpawnInput) {
    // Jitter ±20px en X — el burst no se ve como un chorro alineado.
    this.x = x + (rng() * 40 - 20);
    this.y = y;
    const angle = pickAngle(rng);
    const speed = speedRange
      ? speedRange[0] + rng() * (speedRange[1] - speedRange[0])
      : pickSpeed(rng) * speedScale;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotation = rng() * TAU;
    this.rotationSpeed = (rng() * 6 - 3) * Math.PI; // ±3π rad/s — tumbling más vívido
    this.size = sizeRange
      ? sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0])
      : pickSize(rng);
    this.ttl = ttlRange
      ? ttlRange[0] + rng() * (ttlRange[1] - ttlRange[0])
      : 1800 + rng() * 600; // default 1.8-2.4s
    this.color = color;
    this.shape = shape;
  }

  update(dt: number, canvasH: number) {
    const s = dt / 1000;
    this.x += this.vx * s;
    this.y += this.vy * s;
    this.vy += GRAVITY * s;
    this.vx *= Math.pow(DRAG_PER_60FPS_FRAME, s * 60);
    this.rotation += this.rotationSpeed * s;
    this.age += dt;

    // Fade-out: por TTL (último 25% — empieza más tarde) o por
    // estar saliendo del frame (y > 90% — antes era 70%, las
    // partículas no se desvanecen prematuramente en zona visible).
    const ttlRatio = this.age / this.ttl;
    const yRatio = canvasH > 0 ? this.y / canvasH : 0;
    let fadeProgress = 0;
    if (ttlRatio > 0.75) fadeProgress = (ttlRatio - 0.75) / 0.25;
    if (yRatio > 0.9) {
      const yFade = (yRatio - 0.9) / 0.1;
      if (yFade > fadeProgress) fadeProgress = yFade;
    }
    this.alpha = Math.max(0, Math.min(1, 1 - fadeProgress));
  }

  /** Para los cuadrados — flip 3D más vívido subiendo el
   *  multiplicador de la frecuencia angular (1.5 → 2.0). */
  squareScaleY(): number {
    return Math.max(0.2, Math.abs(Math.cos(this.rotation * 2.0)));
  }

  isDead(canvasW: number, canvasH: number): boolean {
    return (
      this.alpha <= 0 ||
      this.age >= this.ttl ||
      this.x < -50 ||
      this.x > canvasW + 50 ||
      this.y > canvasH + 50
    );
  }
}
