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
 * Burst secuencial 4-stage — windup + dos explosiones + ambient
 * tail. Lleva a la celebración con anticipación auditiva y visual
 * en lugar de empezar "en frío" con un pum de la nada:
 *
 *   t = 0    WINDUP. confetti_windup sound ("weeoooo" rising 280ms)
 *            + onAnticipation callback (la screen estira el check
 *            scale 1.0 → 1.3 progresivamente). Sin haptic. Le da
 *            al cerebro 280-300ms de "viene algo grande".
 *
 *   t = +300ms PEAK. Heavy haptic + confetti_pop sound (volume 0.75)
 *            + onPeak callback (flash blanco + spring del check
 *            con overshoot 1.3 → 1.5 → 1.0) + burst principal de
 *            1000 partículas. EL momento de la explosión.
 *
 *   t = +650ms Encore. Light haptic + segundo burst de 500
 *            partículas con velocidad 30% reducida. SIN sonido
 *            extra acá — la segunda explosion del WAV de
 *            confetti_pop está splicada a 350ms internos del file,
 *            que coincide exactamente con este momento.
 *
 *   t = +1000ms Sparkle tail. 100 partículas chiquitas (4-6px)
 *            que flotan largo (TTL 2.5-3.5s). Sin haptic. El
 *            debris natural del WAV (post-splice) acompaña.
 *
 * Sonidos:
 *   - `order_success` (bell ding) vive en confirm.tsx — suena en
 *     todas las órdenes en el momento de "Orden Ejecutada".
 *   - `confetti_windup` ("weeoooo") en t=0 — solo first trade.
 *   - `confetti_pop` (PUM PUM + debris splicado) en t=+300 — solo
 *     first trade.
 */
export function useConfetti() {
  const burst = useCallback((opts: BurstOptions) => {
    const { x, y, count, onAnticipation, onPeak } = opts;

    // t = 0 — windup. Sound rising "weeooo" + el callback visual
    // que estira el check progresivamente. SIN haptic — quiero que
    // el cerebro registre solo audio + visual leadup, sin
    // distracción táctil. El haptic se reserva para EL momento
    // del peak (300ms después).
    playSound("confetti_windup");
    onAnticipation?.();

    // t = +300ms — peak. Heavy impact + confetti_pop a volume 0.75
    // (un poco más bajo que full para no competir con el debris
    // que sigue del windup) + onPeak callback (flash + spring del
    // check con overshoot) + burst principal de 1000 partículas.
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      playSound("confetti_pop", { volume: 0.75 });
      onPeak?.();
      globalManager.burst({ x, y, count });
    }, 300);

    // t = +650ms — encore. Light haptic SOLAMENTE — la segunda
    // explosion ya viene en el WAV de confetti_pop splicada a 350ms
    // internos (= +650ms desde windup, exactamente ahora).
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      globalManager.burst({ x, y, count: 500, speedScale: 0.7 });
    }, 650);

    // t = +1000ms — sparkle tail. El debris natural del WAV sigue
    // sonando, las partículas pequeñas acompañan el cierre.
    setTimeout(() => {
      globalManager.burst({
        x,
        y,
        count: 100,
        sizeRange: [4, 6],
        speedRange: [200, 400],
        ttlRange: [2500, 3500],
      });
    }, 1000);
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
