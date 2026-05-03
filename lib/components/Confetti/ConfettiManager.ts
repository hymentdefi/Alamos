import { Confetto, type Shape } from "./Confetto";
import { pickColor } from "./colors";

const SHAPES: readonly Shape[] = ["square", "circle", "triangle"];

export interface BurstConfig {
  x: number;
  y: number;
  /** Partículas en el frame 0. Default 60 — es lo que da el "pop". */
  initialBurst?: number;
  /** Cuánto tiempo (ms) sigue emitiendo después del burst. */
  emitDuration?: number;
  /** Partículas por segundo durante la emisión continua. */
  emitRate?: number;
}

interface ActiveBurst {
  origin: { x: number; y: number };
  startedAt: number;
  emitDuration: number;
  emitRate: number;
  emitted: number;
}

/**
 * Manager de partículas. Mantiene la lista activa, agenda emisiones
 * continuas y limpia las muertas. Sin React, sin Skia — pure JS para
 * testabilidad y para que pueda correr en cualquier driver de loop.
 */
export class ConfettiManager {
  particles: Confetto[] = [];
  private bursts: ActiveBurst[] = [];
  private elapsed = 0;
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
    initialBurst = 60,
    emitDuration = 600,
    emitRate = 280,
  }: BurstConfig) {
    const initialCount = Math.round(initialBurst * this.particleScale);
    for (let i = 0; i < initialCount; i++) {
      this.spawnAt(x, y);
    }
    this.bursts.push({
      origin: { x, y },
      startedAt: this.elapsed,
      emitDuration,
      emitRate: emitRate * this.particleScale,
      emitted: 0,
    });
    this.onActivity?.();
  }

  private spawnAt(x: number, y: number) {
    const shape = SHAPES[(Math.random() * SHAPES.length) | 0];
    const color = pickColor();
    this.particles.push(new Confetto({ x, y, color, shape }));
  }

  update(dt: number, canvasW: number, canvasH: number) {
    this.elapsed += dt;

    // Emisión continua de los bursts activos. Calculo la cantidad
    // total que YA debería haberse emitido (rate * burstAge) y
    // emito el delta hasta llegar — esto desacopla el emit-rate del
    // frame-rate.
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      const burstAge = this.elapsed - b.startedAt;
      if (burstAge >= b.emitDuration) {
        // Una última pasada para emitir los que quedaron pendientes
        // dentro de la duración total, y la quito.
        const targetFinal = (b.emitRate * b.emitDuration) / 1000;
        while (b.emitted < targetFinal) {
          this.spawnAt(b.origin.x, b.origin.y);
          b.emitted++;
        }
        this.bursts.splice(i, 1);
        continue;
      }
      const target = (b.emitRate * burstAge) / 1000;
      while (b.emitted < target) {
        this.spawnAt(b.origin.x, b.origin.y);
        b.emitted++;
      }
    }

    // Update + sweep de partículas muertas (filter in place — más
    // barato que crear array nuevo cada frame).
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
    return this.particles.length === 0 && this.bursts.length === 0;
  }

  reset() {
    this.particles.length = 0;
    this.bursts.length = 0;
    this.elapsed = 0;
  }
}
