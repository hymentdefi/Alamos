import { createElement, useCallback } from "react";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { ConfettiManager, type BurstConfig } from "../components/Confetti/ConfettiManager";
import { ConfettiCanvas } from "../components/Confetti/ConfettiCanvas";

export interface BurstOptions extends BurstConfig {
  /** Delay (ms) entre el haptic y el burst visual. Default 50 — el
   *  cerebro registra la sensación física antes que el visual,
   *  amplificando la lectura de "recompensa real". */
  hapticLeadMs?: number;
}

/**
 * Singleton del manager. Mantiene UNA sola lista de partículas para
 * toda la app — esto permite disparar burst() desde cualquier
 * pantalla (success, milestones) y que la animación renderee en el
 * <ConfettiPortal /> montado en el root del árbol.
 */
const globalManager = new ConfettiManager();

/**
 * Componente para montar UNA vez en el root del árbol, encima de
 * todo, pointerEvents=none. Se conecta al manager global.
 */
export function ConfettiPortal() {
  return createElement(ConfettiCanvas, { manager: globalManager });
}

/**
 * Hook que expone burst() para celebrar trades exitosos. El haptic
 * se dispara antes del visual para amplificar la sensación de
 * recompensa.
 */
export function useConfetti() {
  const burst = useCallback((opts: BurstOptions) => {
    const { hapticLeadMs = 50, x, y, ...rest } = opts;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setTimeout(() => {
      globalManager.burst({ x, y, ...rest });
    }, hapticLeadMs);
  }, []);
  return { burst };
}

/**
 * Acceso directo al manager (low-level). Útil para casos como
 * setParticleScale() en dispositivos low-end.
 */
export function getConfettiManager(): ConfettiManager {
  return globalManager;
}

/* ─── Gate: primer trade celebrado ───
 *
 * Por CNV (regulación argentina) no podemos celebrar CADA operación
 * — sería gamificar el trading. La gate vive en SecureStore con la
 * key `confetti:first-trade-celebrated` y solo se dispara en la
 * primera ejecución exitosa de la cuenta. */

const FIRST_TRADE_KEY = "confetti:first-trade-celebrated";

/** True si el usuario ya celebró su primer trade. */
export async function hasFirstTradeBeenCelebrated(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(FIRST_TRADE_KEY);
    return v === "1";
  } catch {
    // Si SecureStore falla preferimos NO disparar — más conservador
    // desde la lectura regulatoria (mejor no celebrar dos veces).
    return true;
  }
}

/** Marca que la celebración del primer trade ya ocurrió. */
export async function markFirstTradeCelebrated(): Promise<void> {
  try {
    await SecureStore.setItemAsync(FIRST_TRADE_KEY, "1");
  } catch {
    /* noop */
  }
}
