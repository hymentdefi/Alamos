import { createElement, useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import {
  ConfettiManager,
  type BurstConfig,
} from "../components/Confetti/ConfettiManager";
import { ConfettiCanvas } from "../components/Confetti/ConfettiCanvas";

export interface BurstOptions {
  /** Coordenadas en window-space del epicentro. */
  x: number;
  y: number;
  /** Override del count del burst PRINCIPAL (etapa 2). Default 500.
   *  Encore (250) y sparkle tail (50) son fijos. */
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
 * En low-end bajamos a particleScale 0.55 (500 peak → ~275). Con
 * Skia esto es overkill — ya bancaba 800+ — pero lo dejamos por
 * ahorro de batería en GPUs antiguas.
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
 *   t = 0    Anticipación. Light haptic + callback `onAnticipation`
 *            (la screen suele hacer un pulse sutil del check icon).
 *            Le dice al cerebro "viene algo".
 *
 *   t = +100ms PEAK. Success haptic + `onPeak` callback (la screen
 *            suele tirar flash blanco + spring overshoot del check)
 *            + burst principal de 500 partículas. Es EL momento.
 *
 *   t = +450ms Encore. Medium haptic + segundo burst de 250 partículas
 *            con velocidad 30% reducida. Como una "ola que sigue":
 *            confirma que lo del peak no fue un accidente.
 *
 *   t = +800ms Sparkle tail. 50 partículas chiquitas (4-6px) que
 *            flotan largo (TTL 2.5-3.5s). Sin haptic. Es el "polvo"
 *            ambiental que cierra la celebración.
 *
 * El SONIDO (`order_success`) NO se dispara desde acá — vive en el
 * mount de la success screen, así suena en TODAS las órdenes (no
 * solo en la primera donde corre el burst). Ver SoundManager.
 */
export function useConfetti() {
  const burst = useCallback((opts: BurstOptions) => {
    const { x, y, count, onAnticipation, onPeak } = opts;

    // t = 0 — anticipación.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAnticipation?.();

    // t = +100ms — peak.
    setTimeout(() => {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      onPeak?.();
      globalManager.burst({ x, y, count });
    }, 100);

    // t = +450ms — encore.
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      globalManager.burst({ x, y, count: 250, speedScale: 0.7 });
    }, 450);

    // t = +800ms — sparkle tail.
    setTimeout(() => {
      globalManager.burst({
        x,
        y,
        count: 50,
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
