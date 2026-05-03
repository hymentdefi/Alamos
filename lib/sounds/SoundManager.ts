import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

/**
 * Sistema de sonidos compartido para la app — pre-loads + play
 * imperativos vía un singleton.
 *
 * NOTA SOBRE EL ARCHIVO `order_success.wav` ACTUAL:
 *   Es un placeholder generado sintéticamente con el script en
 *   `scripts/generate-success-sound.js` (3 notas de triangle wave
 *   formando un acorde C mayor ascendente). Suena a "notificación
 *   de Windows 95" porque son ondas matemáticas puras sin texturas
 *   reales. Funciona para shippar y tener probada la integración,
 *   pero el archivo final debe reemplazarse por uno real (Mixkit,
 *   Pixabay, o sound designer) en una iteración futura. Reemplazo
 *   = drop del nuevo archivo en `assets/sounds/order_success.wav`,
 *   no requiere correr el script de nuevo.
 *
 * REGLA CRÍTICA — SILENT MODE:
 *   `playsInSilentMode: false` es no-negociable en fintech. Si el
 *   usuario tiene el celular en silencio, los sonidos de la app NO
 *   suenan. Queremos que la app respete esa señal del usuario,
 *   especialmente alrededor de transacciones de plata.
 *
 * MANEJO DE ERRORES:
 *   Cualquier falla del subsistema de audio (archivo faltante, audio
 *   mode rechazado, lib no disponible) se traga y se logguea. Un
 *   sonido que no suena no debe crashear la app.
 */

export type SoundName = "order_success" | "confetti_pop" | "confetti_windup";

/**
 * Mapping `name → require()` de los assets. `require()` se evalúa
 * en build-time así que el bundle ya incluye los archivos referenciados.
 *
 * Para agregar más sonidos: agregar entry acá + extender el type
 * `SoundName` arriba. Sin cambios en el resto del código.
 *
 * `confetti_pop` es un splice del WAV de Epidemic Sound (Confetti
 * Cannon Medium): `[explosion][explosion][debris]`. La duplicación
 * de la primera explosion se hace en build-time vía
 * `scripts/splice-confetti-sound.js`. Para regenerar, correr el
 * script con la ruta al WAV original como argumento.
 */
const SOUND_SOURCES: Record<SoundName, number> = {
  order_success: require("../../assets/sounds/order_success.wav"),
  confetti_pop: require("../../assets/sounds/confetti_pop.wav"),
  confetti_windup: require("../../assets/sounds/confetti_windup.wav"),
};

class SoundManagerImpl {
  private players: Partial<Record<SoundName, AudioPlayer>> = {};
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Llamar UNA VEZ al boot de la app (desde el root _layout).
   *   1) Setea el audio mode (respeta silent mode)
   *   2) Pre-carga todos los players para que play() sea instant.
   * Es idempotente — múltiples llamadas devuelven el mismo Promise.
   */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      await setAudioModeAsync({
        // CRÍTICO: respetar silent mode (no-negociable en fintech).
        playsInSilentMode: false,
        // Duck other audio (Spotify, podcasts) durante nuestros SFX.
        interruptionModeAndroid: "duckOthers",
        shouldPlayInBackground: false,
        allowsRecording: false,
      });
    } catch (err) {
      console.warn("[SoundManager] setAudioModeAsync failed:", err);
      // Continuamos igual — el audio mode default igual permite tocar,
      // solo que no respetará silent mode tan estrictamente.
    }

    for (const name of Object.keys(SOUND_SOURCES) as SoundName[]) {
      try {
        this.players[name] = createAudioPlayer(SOUND_SOURCES[name]);
      } catch (err) {
        console.warn(`[SoundManager] failed to load "${name}":`, err);
      }
    }

    this.initialized = true;
  }

  /**
   * Reproduce el sonido. No-op silencioso si:
   *   - init() todavía no terminó (jugando seguro al boot)
   *   - el archivo no se cargó
   *   - el subsistema de audio crashea
   *
   * Para SFX cortos `seekTo(0)` antes de `play()` garantiza
   * reinicio desde el principio aunque el sonido anterior no
   * haya terminado.
   */
  play(name: SoundName, options?: { volume?: number }): void {
    const player = this.players[name];
    if (!player) {
      if (this.initialized) {
        console.warn(`[SoundManager] sound "${name}" not loaded`);
      }
      return;
    }

    try {
      if (options?.volume != null) {
        player.volume = Math.max(0, Math.min(1, options.volume));
      }
      player.seekTo(0);
      player.play();
    } catch (err) {
      console.warn(`[SoundManager] play("${name}") failed:`, err);
    }
  }

  /**
   * Libera los players. Útil para tests o teardown explícito.
   * En la app normal no hace falta llamar — el OS limpia al matar
   * el proceso.
   */
  dispose(): void {
    for (const player of Object.values(this.players)) {
      try {
        player?.remove();
      } catch {
        // ignore
      }
    }
    this.players = {};
    this.initialized = false;
    this.initPromise = null;
  }
}

export const SoundManager = new SoundManagerImpl();

/**
 * Helper de conveniencia. Equivalente a `SoundManager.play(name, opts)`.
 */
export function playSound(
  name: SoundName,
  options?: { volume?: number },
): void {
  SoundManager.play(name, options);
}
