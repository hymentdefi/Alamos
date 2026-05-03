import { createElement, useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import {
  ConfettiManager,
  type BurstConfig,
} from "../components/Confetti/ConfettiManager";
import { ConfettiCanvas } from "../components/Confetti/ConfettiCanvas";
import { playSound } from "../sounds/SoundManager";

export interface BurstOptions {
  /** Coordenadas en window-space del epicentro. */
  x: number;
  y: number;
  /** Override del count del burst PRINCIPAL (etapa 2). Default 1000.
   *  Encore (500) y sparkle tail (100) son fijos. */
  count?: number;
  /** Callback al inicio (t=0 desde burst()): light haptic + esta
   *  callback se dispara. La screen suele usar para un pulse muy
   *  sutil del check icon (scale 1.0 → 1.15 → 1.0 en ~100ms),
   *  telegrafiando "algo grande viene". */
  onAnticipation?: () => void;
  /** Callback al peak (t=+100ms desde burst()): success notification
   *  haptic + burst principal + esta callback. La screen suele usar
   *  para flash blanco overlay (opacity 0 → 0.35 → 0 en ~90ms) +
   *  spring del check icon (scale 1.0 → 1.3 → 1.0 con overshoot). */
  onPeak?: () => void;
}

/**
 * Heurística cheap para detectar dispositivos low-end sin agregar
 * `react-native-device-info` (módulo nativo → requeriría rebuild).
 * En Android lookeamos el API level: < 28 (pre-Pie) lo tratamos como
 * low-end. En iOS asumimos no-low-end (cualquier iPhone que corra
 * iOS 13+ es suficientemente capaz para 180 partículas).
 */
function isLowEndDevice(): boolean {
  if (Platform.OS === "android") {
    const v =
      typeof Platform.Version === "number"
        ? Platform.Version
        : parseInt(Platform.Version as string, 10);
    return Number.isFinite(v) && v < 28;
  }
  return false;
}

/**
 * Singleton del manager. Mantiene UNA sola lista de partículas para
 * toda la app — esto permite disparar burst() desde cualquier
 * pantalla y que la animación renderee en el <ConfettiPortal />
 * montado en el root del árbol.
 *
 * En low-end bajamos a particleScale 0.55 (1000 peak → ~550). Con
 * la migración a UI thread (useFrameCallback + Picture) esto es ya
 * casi cosmético — la GPU traga 1500-2500 partículas a 60fps — pero
 * lo dejamos por ahorro de batería en GPUs antiguas.
 */
const globalManager = new ConfettiManager();
if (isLowEndDevice()) {
  globalManager.setParticleScale(0.55);
}

/**
 * Componente para montar UNA vez en el root del árbol, encima de
 * todo, pointerEvents=none. Se conecta al manager global.
 */
export function ConfettiPortal() {
  return createElement(ConfettiCanvas, { manager: globalManager });
}

/**
 * Hook que expone burst() para celebrar trades exitosos.
 *
 * Burst secuencial 3-stage post-research (Apple Pay / Cash App /
 * Duolingo: la celebración tiene "arc" emocional, no es un pico
 * único):
 *
 *   t = 0    Anticipación. Solo `onAnticipation` callback (la screen
 *            hace un pulse sutil del check icon). Sin haptic — el
 *            telegrafiado es puramente visual para no competir con
 *            el haptic del peak 100ms después.
 *
 *   t = +100ms PEAK. Heavy impact (un solo punch fuerte) + `onPeak`
 *            callback (la screen tira flash blanco + spring overshoot
 *            del check) + burst principal de 1000 partículas + el
 *            sonido que la screen disparó al mount. Es EL momento.
 *
 *   t = +450ms Encore. Light impact (era Medium — too much) +
 *            segundo burst de 500 partículas con velocidad 30%
 *            reducida. "La ola que sigue".
 *
 *   t = +800ms Sparkle tail. 100 partículas chiquitas (4-6px) que
 *            flotan largo (TTL 2.5-3.5s). Sin haptic. Es el "polvo"
 *            ambiental que cierra la celebración.
 *
 * Sonidos:
 *   - `order_success` (el bell ding) NO vive acá — se dispara en
 *     confirm.tsx en el momento de "Orden Ejecutada", para que suene
 *     en TODAS las órdenes (no solo la primera con burst).
 *   - `confetti_pop` SÍ vive acá — se dispara UNA VEZ en peak. El
 *     WAV tiene `[explosion][explosion][debris]` splicado (ver
 *     scripts/splice-confetti-sound.js), así que la segunda
 *     explosion del file coincide naturalmente con el encore visual
 *     y el debris acompaña al sparkle tail.
 */
export function useConfetti() {
  const burst = useCallback((opts: BurstOptions) => {
    const { x, y, count, onAnticipation, onPeak } = opts;

    // t = 0 — anticipación. SIN haptic, solo el callback visual
    // (pulse del check). El haptic acá pelea con el del peak (100ms
    // después) y se siente over-stimulating. El telegrafiado lo da
    // el visual.
    onAnticipation?.();

    // t = +100ms — peak. Heavy impact + un solo playSound del WAV
    // de confetti spliced. El file tiene `[explosion][explosion][debris]`
    // — la SEGUNDA explosion adentro del file está splicada a 350ms,
    // que coincide exactamente con cuando dispara el encore visual
    // a t=+450ms (350ms después del peak). El debris natural del
    // file acompaña al sparkle tail.
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      playSound("confetti_pop");
      onPeak?.();
      globalManager.burst({ x, y, count });
    }, 100);

    // t = +450ms — encore. Light haptic SOLAMENTE — el sonido de
    // esta segunda explosion ya está dentro del WAV que disparamos
    // en peak (splicing). Si tirábamos otro playSound acá se
    // pisaba con el del file y sonaba doble feo.
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      globalManager.burst({ x, y, count: 500, speedScale: 0.7 });
    }, 450);

    // t = +800ms — sparkle tail.
    setTimeout(() => {
      globalManager.burst({
        x,
        y,
        count: 100,
        sizeRange: [4, 6],
        speedRange: [200, 400],
        ttlRange: [2500, 3500],
      });
    }, 800);
  }, []);

  return { burst };
}

/**
 * Acceso directo al manager (low-level). Útil para casos como
 * setParticleScale() en runtime.
 */
export function getConfettiManager(): ConfettiManager {
  return globalManager;
}

/* ─── Notas regulatorias ───
 *
 * El gate "solo el primer trade del usuario" ya no vive acá.
 * Migrado al user model — `user.hasFirstTrade` es la fuente de
 * verdad (ver lib/auth/context.tsx). Cuando el usuario ejecuta su
 * primera compra, success.tsx lee el flag, dispara el burst y
 * llama a `auth.markFirstTrade()` para flippearlo. CNV no permite
 * gamificar cada operación — solo este milestone. */

export type { BurstConfig };
