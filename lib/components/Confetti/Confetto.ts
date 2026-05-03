/**
 * Partícula individual de confetti. Pure JS, sin React ni Skia —
 * fácil de testear y rápida de actualizar en bulk. La instancia se
 * mutea in-place cada frame para evitar churn de GC durante el
 * burst.
 */

export type Shape = "square" | "circle" | "triangle";

export interface SpawnInput {
  x: number;
  y: number;
  color: string;
  shape: Shape;
  rng?: () => number;
}

const TAU = Math.PI * 2;
// Gravedad y drag — calibrados para que el burst tenga "peso" sin
// caer demasiado rápido y se pierda la lectura del color.
const GRAVITY = 520; // px/s²
const DRAG_PER_60FPS_FRAME = 0.992;

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

  constructor({ x, y, color, shape, rng = Math.random }: SpawnInput) {
    // Jitter ±20px en X — el burst no se ve como un chorro alineado.
    this.x = x + (rng() * 40 - 20);
    this.y = y;
    // Velocidad inicial radial hacia arriba, cono de ±0.45π alrededor
    // de -π/2 (vertical up). Magnitud 280-600 px/s.
    const angle = -Math.PI / 2 + (rng() * 0.9 - 0.45) * Math.PI;
    const speed = 280 + rng() * 320;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotation = rng() * TAU;
    this.rotationSpeed = (rng() * 4 - 2) * Math.PI; // ±2π rad/s
    this.size = 6 + rng() * 6; // 6-12px
    this.ttl = 2200 + rng() * 800; // 2.2-3.0s
    this.color = color;
    this.shape = shape;
  }

  /**
   * Avanza la simulación dt ms. `canvasH` se usa para activar el
   * fade-out cuando la partícula está cerca del bottom.
   */
  update(dt: number, canvasH: number) {
    const s = dt / 1000;
    this.x += this.vx * s;
    this.y += this.vy * s;
    this.vy += GRAVITY * s;
    // Drag horizontal frame-rate independiente. El factor 0.992 era
    // por frame asumiendo 60fps; lo escalo por el dt real.
    this.vx *= Math.pow(DRAG_PER_60FPS_FRAME, s * 60);
    this.rotation += this.rotationSpeed * s;
    this.age += dt;

    // Fade-out: por TTL (último 30% de la vida) o por bottom-area
    // (último 30% del canvas). El que esté más avanzado manda.
    const ttlRatio = this.age / this.ttl;
    const yRatio = canvasH > 0 ? this.y / canvasH : 0;
    let fadeProgress = 0;
    if (ttlRatio > 0.7) fadeProgress = (ttlRatio - 0.7) / 0.3;
    if (yRatio > 0.7) {
      const yFade = (yRatio - 0.7) / 0.3;
      if (yFade > fadeProgress) fadeProgress = yFade;
    }
    this.alpha = Math.max(0, Math.min(1, 1 - fadeProgress));
  }

  /**
   * Para los cuadrados — simulamos el flip 3D modulando scaleY con
   * |cos(rotation * 1.5)|. Mantengo un mínimo de 0.2 para que nunca
   * desaparezca por completo (sería ilegible). Se aplica desde el
   * componente de render, no desde acá, pero la lógica vive con la
   * partícula para que sea fácil de testear.
   */
  squareScaleY(): number {
    return Math.max(0.2, Math.abs(Math.cos(this.rotation * 1.5)));
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
