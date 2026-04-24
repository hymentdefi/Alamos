import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { ProTransition } from "./Transition";

const STORAGE_KEY = "pro_mode";

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
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);
  const [target, setTarget] = useState<ProTransitionTarget>(null);

  // Cargar preferencia persistida al iniciar la app.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((v) => {
        if (v === "1") setIsPro(true);
      })
      .catch(() => {});
  }, []);

  const requestSwitch = useCallback(() => {
    setTarget((current) => {
      if (current) return current; // ya corriendo, ignorar
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return isPro ? "toLite" : "toPro";
    });
  }, [isPro]);

  const commitFlip = useCallback(() => {
    setIsPro((p) => {
      const next = !p;
      SecureStore.setItemAsync(STORAGE_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
    // Después de switchear de modo, llevar SIEMPRE al usuario al
    // Inicio. La nav ocurre por detrás del overlay opaco del
    // Transition, así que el user no ve el salto — al hacer fade-out
    // queda directamente en el home del modo nuevo.
    router.replace("/(app)/(tabs)");
  }, [router]);

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
