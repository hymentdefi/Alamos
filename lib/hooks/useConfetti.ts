import { createElement, useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { ConfettiManager, type BurstConfig } from "../components/Confetti/ConfettiManager";
import { ConfettiCanvas } from "../components/Confetti/ConfettiCanvas";

export interface BurstOptions extends BurstConfig {
  /** Delay (ms) entre el haptic Success y el burst visual. Default
   *  50 — el cerebro registra primero la sensación física y después
   *  el visual, lo que amplifica la lectura de "recompensa real". */
  hapticLeadMs?: number;
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
 * En low-end bajamos a particleScale 0.55 (180 → ~100 partículas)
 * para mantener 60fps cómodos.
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
 * Patrón de haptic: doble.
 *   1. `Haptics.notificationAsync(Success)` 50ms ANTES del visual
 *      → la sensación física llega primero, amplifica reward.
 *   2. `Haptics.impactAsync(Medium)` 80ms DESPUÉS del Success
 *      → un segundo "thump" sincrónico con el peak visual del
 *      burst, refuerza la lectura de "algo grande pasó".
 */
export function useConfetti() {
  const burst = useCallback((opts: BurstOptions) => {
    const { hapticLeadMs = 50, x, y, ...rest } = opts;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 80);
    setTimeout(() => {
      globalManager.burst({ x, y, ...rest });
    }, hapticLeadMs);
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
