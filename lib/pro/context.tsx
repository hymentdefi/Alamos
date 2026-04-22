import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import * as Haptics from "expo-haptics";

interface ProContextValue {
  isPro: boolean;
  togglePro: () => void;
}

const ProContext = createContext<ProContextValue>({
  isPro: false,
  togglePro: () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);

  const togglePro = useCallback(() => {
    setIsPro((p) => {
      const next = !p;
      Haptics.impactAsync(
        next
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ isPro, togglePro }), [isPro, togglePro]);

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function useProMode(): ProContextValue {
  return useContext(ProContext);
}
