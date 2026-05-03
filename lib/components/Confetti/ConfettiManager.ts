/**
 * Manager liviano — sirve de puente entre el código JS (que llama
 * `burst()`) y el ConfettiCanvas que vive como UI-thread worklet.
 *
 * Diseño post-migración a useFrameCallback + Picture:
 *   - Las partículas YA NO viven acá. Viven en una SharedValue<Particle[]>
 *     que es propiedad del ConfettiCanvas — el Manager solo recuerda
 *     un `spawnFn` que el Canvas registra al montar.
 *   - `burst()` llama al spawnFn, que internamente hace `runOnUI` para
 *     spawnear partículas en UI thread sin atravesar React.
 *   - Sin ciclo de update — el Canvas drivea su propio loop con
 *     `useFrameCallback` de Reanimated, también en UI thread.
 *
 * Singleton-friendly: una instancia global (`globalManager` en
 * useConfetti) que cualquier pantalla puede usar; el Canvas en el
 * root layout se conecta una vez al mount.
 */

export interface BurstConfig {
  x: number;
  y: number;
  /** Cantidad de partículas en este spawn. Default 1000. Es solo
   *  la etapa SOLICITADA — la secuencia 3-stage (anticipation, peak,
   *  encore, sparkle) la maneja `useConfetti` haciendo varios burst()
   *  en cadena, no este field.
   *
   *  Calibrado post-migración a UI thread (useFrameCallback +
   *  Picture). Antes de eso el techo era ~500 por React reconciliation,
   *  ahora la GPU traga 1500-2500. */
  count?: number;
  /** Multiplicador de velocidad uniforme. Encore usa 0.7. */
  speedScale?: number;
  /** Override de tamaño absoluto (px). Sparkle tail usa [4, 6]. */
  sizeRange?: [number, number];
  /** Override de TTL absoluto (ms). Sparkle tail usa [2500, 3500]. */
  ttlRange?: [number, number];
  /** Override de velocidad ABSOLUTA (px/s). Sparkle tail usa [200, 400]. */
  speedRange?: [number, number];
}

export type SpawnFn = (config: BurstConfig) => void;

export class ConfettiManager {
  private spawnFn: SpawnFn | null = null;
  private particleScale = 1;

  /** 0..1 para reducir la cantidad de partículas en dispositivos
   *  low-end. Con la migración a UI thread + Picture esto es ya
   *  casi cosmético — la GPU traga el doble — pero lo dejamos para
   *  ahorro de batería en GPUs antiguas. */
  setParticleScale(scale: number) {
    this.particleScale = Math.max(0.1, Math.min(1, scale));
  }

  /** Llamado por el ConfettiCanvas al mount. La función pasada
   *  internamente hace `runOnUI` hacia el SharedValue del canvas. */
  attachSpawn(fn: SpawnFn) {
    this.spawnFn = fn;
  }

  detachSpawn() {
    this.spawnFn = null;
  }

  burst(config: BurstConfig) {
    if (!this.spawnFn) {
      // Canvas no montado todavía — no-op silencioso. Pasa solo
      // durante el split-second entre que React arma el árbol y
      // ConfettiPortal se monta. Si el burst es importante (post-trade
      // success), seguro el árbol ya está listo.
      return;
    }
    const count = Math.round((config.count ?? 1000) * this.particleScale);
    this.spawnFn({ ...config, count });
  }
}
