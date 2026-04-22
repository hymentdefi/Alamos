import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../auth/context";
import { DISCLAIMER_VERSION } from "./disclaimers";

interface ConsentRecord {
  /** Versión del disclaimer que el usuario aceptó. */
  version: string;
  /** ISO timestamp. */
  acceptedAt: string;
  /** ID del usuario que aceptó — trazabilidad legal. */
  userId: string;
}

interface ContextValue {
  /** El usuario aceptó la versión vigente del disclaimer. */
  hasAccepted: boolean;
  /** Cargando el estado de SecureStore (antes de mostrar onboarding). */
  loading: boolean;
  /** Registra la aceptación y persiste en SecureStore. */
  accept: () => Promise<void>;
}

const LegalConsentContext = createContext<ContextValue>({
  hasAccepted: false,
  loading: true,
  accept: async () => {},
});

const STORAGE_PREFIX = "legal_consent:news:";
const keyFor = (userId: string) => `${STORAGE_PREFIX}${userId}`;

export function LegalConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const [hasAccepted, setHasAccepted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(keyFor(userId));
        if (cancelled) return;
        if (!raw) {
          setHasAccepted(false);
          return;
        }
        const record = JSON.parse(raw) as ConsentRecord;
        setHasAccepted(record.version === DISCLAIMER_VERSION);
      } catch {
        if (!cancelled) setHasAccepted(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const accept = useCallback(async () => {
    const record: ConsentRecord = {
      version: DISCLAIMER_VERSION,
      acceptedAt: new Date().toISOString(),
      userId,
    };
    try {
      await SecureStore.setItemAsync(keyFor(userId), JSON.stringify(record));
    } catch {
      // No rompemos el flujo si falla el storage — el user ya vio y aceptó.
    }
    setHasAccepted(true);
  }, [userId]);

  return (
    <LegalConsentContext.Provider value={{ hasAccepted, loading, accept }}>
      {children}
    </LegalConsentContext.Provider>
  );
}

export function useLegalConsent(): ContextValue {
  return useContext(LegalConsentContext);
}
