import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createAlert as apiCreate,
  deleteAlert as apiDelete,
  getAllAlerts,
  getAlertsForAsset,
  AlertApiError,
  type CreateAlertInput,
  type PriceAlert,
} from "../api/alerts";
import { useAuth } from "../auth/context";

/**
 * Estado global de las alertas de precio del usuario.
 *
 * Mantiene una caché en memoria para que la UI pueda preguntar
 * "¿este activo tiene alertas activas?" sin pegarle al backend
 * cada vez (ej: render del ícono de la campana en el header del
 * detail). La caché se hidrata al boot (si hay user logueado) y
 * se sincroniza con cada operación CRUD.
 *
 * Estados:
 *   active     → alerta vigente, esperando ser triggered
 *   triggered  → ya disparó (push enviado, sigue en lista para
 *                que el user vea el historial)
 *   cancelled  → user la borró desde el cliente
 */

interface AlertsContextValue {
  /** Todas las alertas conocidas para el user (active + triggered). */
  alerts: PriceAlert[];
  /** Alertas active de un activo puntual. Lectura sincrónica. */
  activeForAsset: (assetId: string) => PriceAlert[];
  /** True si el activo tiene alguna alerta active. Atajo para
   *  decidir el estado del ícono en el header. */
  hasActiveForAsset: (assetId: string) => boolean;
  /** ¿Estamos cargando la lista inicial? */
  isLoading: boolean;
  /** Crear una alerta. Resuelve con la alerta creada. Si falla por
   *  duplicado, lanza AlertApiError code='duplicate'. El caller
   *  decide cómo mostrarlo (la AlertSheet lo hace inline, no toast). */
  create: (input: CreateAlertInput) => Promise<PriceAlert>;
  /** Borrar una alerta. */
  remove: (alertId: string) => Promise<void>;
  /** Refresh de toda la lista — útil al pull-to-refresh en
   *  pantalla "Mis alertas". */
  refresh: () => Promise<void>;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  // Hidratación inicial: cuando el user pasa a autenticado,
  // hacemos un GET /alerts para llenar la caché. Si se desloguea,
  // la limpiamos.
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setAlerts([]);
      return;
    }
    (async () => {
      setIsLoading(true);
      try {
        const items = await getAllAlerts();
        if (!cancelled) setAlerts(items);
      } catch {
        // Silent — la pantalla "Mis alertas" puede reintentar con
        // pull-to-refresh. No queremos un toast al boot.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const activeForAsset = useCallback(
    (assetId: string) =>
      alerts.filter(
        (a) => a.assetId === assetId && a.status === "active",
      ),
    [alerts],
  );

  const hasActiveForAsset = useCallback(
    (assetId: string) =>
      alerts.some(
        (a) => a.assetId === assetId && a.status === "active",
      ),
    [alerts],
  );

  const create = useCallback(
    async (input: CreateAlertInput) => {
      const created = await apiCreate(input);
      setAlerts((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const remove = useCallback(async (alertId: string) => {
    // Optimistic — sacamos de la caché ya. Si el delete falla,
    // re-fetchamos para volver al estado real.
    let removed: PriceAlert | undefined;
    setAlerts((prev) => {
      const idx = prev.findIndex((a) => a.id === alertId);
      if (idx === -1) return prev;
      removed = prev[idx];
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    try {
      await apiDelete(alertId);
    } catch (e) {
      // Revert: si guardé la versión removida, la re-meto en
      // su lugar aproximado (al frente para no perder al user).
      if (removed) {
        const r = removed;
        setAlerts((prev) => [r, ...prev]);
      }
      throw e;
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await getAllAlerts();
      setAlerts(items);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AlertsContextValue>(
    () => ({
      alerts,
      activeForAsset,
      hasActiveForAsset,
      isLoading,
      create,
      remove,
      refresh,
    }),
    [alerts, activeForAsset, hasActiveForAsset, isLoading, create, remove, refresh],
  );

  return (
    <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error("useAlerts debe usarse dentro de <AlertsProvider>");
  }
  return ctx;
}

/** Hook helper para detectar errores de duplicado en el caller
 *  sin tener que importar la clase de error. */
export function isDuplicateAlertError(e: unknown): boolean {
  return e instanceof AlertApiError && e.code === "duplicate";
}

/* Cargar opcionalmente — para componentes que no requieren provider
 * (ej: lib/components/PriceAlertButton se renderea fuera de detail
 * cuando el user no está logueado por una pantalla previa). */
export function useOptionalAlerts(): AlertsContextValue | null {
  return useContext(AlertsContext);
}
