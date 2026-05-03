import { Confetto, type Shape } from "./Confetto";
import { pickColor } from "./colors";

const SHAPES: readonly Shape[] = ["square", "circle", "triangle"];

export interface BurstConfig {
  x: number;
  y: number;
  /** Cantidad de partículas en el burst único. Default 180. Es
   *  explosión, no fuente continua — esto es lo que da el "POP".
   *  Robinhood-real era lluvia full-screen pero la explosión radial
   *  (Cash App / Strava / Duolingo) genera más respuesta dopamínica. */
  count?: number;
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

  burst({ x, y, count = 180 }: BurstConfig) {
    const total = Math.round(count * this.particleScale);
    console.log(
      `[confetti] manager.burst x=${x.toFixed(0)} y=${y.toFixed(0)} count=${total} hasOnActivity=${!!this.onActivity}`,
    );
    for (let i = 0; i < total; i++) {
      this.spawnAt(x, y);
    }
    this.onActivity?.();
  }

  private spawnAt(x: number, y: number) {
    const shape = SHAPES[(Math.random() * SHAPES.length) | 0];
    const color = pickColor();
    this.particles.push(new Confetto({ x, y, color, shape }));
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
