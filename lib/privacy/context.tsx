import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "privacy:hide_amounts";

interface PrivacyContextValue {
  hideAmounts: boolean;
  toggle: () => void;
  set: (next: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  hideAmounts: false,
  toggle: () => {},
  set: () => {},
});

/**
 * Provider del modo privacidad — cuando está ON, los montos del home
 * se enmascaran como `••••.•••`. Persiste en SecureStore. Pensado
 * para enseñar la app a alguien sin revelar el balance real.
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hideAmounts, setHideAmounts] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((v) => {
        if (v === "1") setHideAmounts(true);
      })
      .catch(() => {});
  }, []);

  const set = useCallback((next: boolean) => {
    setHideAmounts(next);
    SecureStore.setItemAsync(STORAGE_KEY, next ? "1" : "0").catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setHideAmounts((p) => {
      const next = !p;
      SecureStore.setItemAsync(STORAGE_KEY, next ? "1" : "0").catch(() => {});
      return next;
    });
  }, []);

  return (
    <PrivacyContext.Provider value={{ hideAmounts, toggle, set }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export const usePrivacy = () => useContext(PrivacyContext);

/**
 * Enmascara un monto como string `••••.•••` preservando el formato
 * (separadores, cantidad de dígitos). Si privacy está OFF, devuelve
 * el formato original. Útil para envolver valores ya formateados:
 *
 *     mask("$ 342.180", true) → "$ •••.•••"
 *     mask("850,00 US$", true) → "•••,•• US$"
 *
 * Mantiene el prefix de moneda y los separadores; sólo reemplaza
 * dígitos por `•`.
 */
export function maskAmount(formatted: string, hide: boolean): string {
  if (!hide) return formatted;
  return formatted.replace(/\d/g, "•");
}
