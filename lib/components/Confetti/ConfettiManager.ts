import { Confetto, type Shape } from "./Confetto";
import { pickColor } from "./colors";

const SHAPES: readonly Shape[] = ["square", "circle", "triangle"];

export interface BurstConfig {
  x: number;
  y: number;
  /** Cantidad de partículas en el burst único. Default 500 (el peak
   *  del burst principal en la secuencia 3-stage). El total perceptual
   *  es 500 + 250 (encore) + 50 (sparkle tail) = 800.
   *
   *  Bumped agresivo post-migración a Skia: el canvas GPU traga
   *  miles de primitivas sin caer de 60fps. Antes el techo View-per-
   *  particle era ~280. */
  count?: number;
  /** Multiplicador de velocidad uniforme — el encore usa 0.7 para
   *  que las partículas viajen menos lejos. Default 1. */
  speedScale?: number;
  /** Override de tamaño absoluto (px). El sparkle tail usa [4, 6]. */
  sizeRange?: [number, number];
  /** Override de TTL absoluto (ms). El sparkle tail usa [2500, 3500]
   *  para flotar más tiempo. */
  ttlRange?: [number, number];
  /** Override de velocidad ABSOLUTA (px/s) — ignora pickSpeed entera
   *  y por lo tanto speedScale tampoco aplica. El sparkle tail usa
   *  [200, 400] para que las partículas tengan personalidad propia
   *  y no parezcan rezagadas del burst grande. */
  speedRange?: [number, number];
}

/**
 * Manager de partículas. Mantiene la lista activa y limpia las
 * muertas. Emisión: UN solo burst instantáneo en el frame 0, sin
 * stream continuo. Pure JS para testabilidad y para que pueda
 * correr en cualquier driver de loop.
 */
export class ConfettiManager {
  particles: Confetto[] = [];
  private particleScale = 1;
  /** Callback opcional para que el Canvas pueda reanudar su frame
   *  loop cuando alguien llama burst() después de quedar idle. */
  onActivity?: () => void;

  /** 0..1 para reducir la cantidad de partículas en dispositivos
   *  low-end. La cantidad solicitada se redondea. */
  setParticleScale(scale: number) {
    this.particleScale = Math.max(0.1, Math.min(1, scale));
  }

  burst({
    x,
    y,
    count = 500,
    speedScale,
    sizeRange,
    ttlRange,
    speedRange,
  }: BurstConfig) {
    const total = Math.round(count * this.particleScale);
    for (let i = 0; i < total; i++) {
      this.spawnAt(x, y, { speedScale, sizeRange, ttlRange, speedRange });
    }
    this.onActivity?.();
  }

  private spawnAt(
    x: number,
    y: number,
    overrides: {
      speedScale?: number;
      sizeRange?: [number, number];
      ttlRange?: [number, number];
      speedRange?: [number, number];
    },
  ) {
    const shape = SHAPES[(Math.random() * SHAPES.length) | 0];
    const color = pickColor();
    this.particles.push(new Confetto({ x, y, color, shape, ...overrides }));
  }

  update(dt: number, canvasW: number, canvasH: number) {
    // Sweep + update in-place (write index) — más barato que map
    // o splice por cada muerta.
    let write = 0;
    for (let read = 0; read < this.particles.length; read++) {
      const p = this.particles[read];
      p.update(dt, canvasH);
      if (!p.isDead(canvasW, canvasH)) {
        if (write !== read) this.particles[write] = p;
        write++;
      }
    }
    this.particles.length = write;
  }

  isIdle(): boolean {
    return this.particles.length === 0;
  }

  reset() {
    this.particles.length = 0;
  }
}
