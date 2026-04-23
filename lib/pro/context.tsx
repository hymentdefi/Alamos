import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import * as Haptics from "expo-haptics";
import { ProTransition } from "./Transition";

export type ProTransitionTarget = "toPro" | "toLite" | null;

interface ProContextValue {
  isPro: boolean;
  /**
   * Pide cambiar de modo. Dispara la pantalla de bienvenida y, en el
   * medio de la animación, flippea `isPro`. Ignora taps si ya hay una
   * transición corriendo.
   */
  requestSwitch: () => void;
  /** True mientras se está reproduciendo la transición visual. */
  transitioning: boolean;
}

const ProContext = createContext<ProContextValue>({
  isPro: false,
  requestSwitch: () => {},
  transitioning: false,
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [target, setTarget] = useState<ProTransitionTarget>(null);

  const requestSwitch = useCallback(() => {
    setTarget((current) => {
      if (current) return current; // ya corriendo, ignorar
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return isPro ? "toLite" : "toPro";
    });
  }, [isPro]);

  const commitFlip = useCallback(() => {
    setIsPro((p) => !p);
  }, []);

  const endTransition = useCallback(() => {
    setTarget(null);
  }, []);

  const value = useMemo(
    () => ({ isPro, requestSwitch, transitioning: target !== null }),
    [isPro, requestSwitch, target],
  );

  return (
    <ProContext.Provider value={value}>
      {children}
      <ProTransition
        target={target}
        onCommit={commitFlip}
        onEnd={endTransition}
      />
    </ProContext.Provider>
  );
}

export function useProMode(): ProContextValue {
  return useContext(ProContext);
}
