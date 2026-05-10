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
  updateAlert as apiUpdate,
  setAlertPaused as apiSetPaused,
  createIndicatorAlert as apiCreateIndicator,
  deleteIndicatorAlert as apiDeleteIndicator,
  updateIndicatorAlert as apiUpdateIndicator,
  setIndicatorAlertPaused as apiSetIndicatorPaused,
  getAllAlerts,
  getAllIndicatorAlerts,
  AlertApiError,
  type AlertDirection,
  type CreateAlertInput,
  type CreateIndicatorAlertInput,
  type IndicatorAlert,
  type PriceAlert,
  type UpdateIndicatorAlertPatch,
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
  /** Todas las alertas conocidas para el user (active + paused +
   *  triggered + cancelled). El consumer filtra por status según
   *  necesite. */
  alerts: PriceAlert[];
  /** Alertas active O paused de un activo puntual — las que
   *  todavía no dispararon, sigan armadas o silenciadas. */
  activeForAsset: (assetId: string) => PriceAlert[];
  /** Alertas triggered de un activo, ordenadas más recientes
   *  primero. Para la sección de historial. */
  triggeredForAsset: (assetId: string) => PriceAlert[];
  /** True si el activo tiene alguna alerta active (no cuenta paused).
   *  Para decidir si la campana del header se prende. */
  hasActiveForAsset: (assetId: string) => boolean;
  /** ¿Estamos cargando la lista inicial? */
  isLoading: boolean;
  /** Crear una alerta. Resuelve con la alerta creada. Si falla por
   *  duplicado, lanza AlertApiError code='duplicate'. El caller
   *  decide cómo mostrarlo (la AlertSheet lo hace inline, no toast). */
  create: (input: CreateAlertInput) => Promise<PriceAlert>;
  /** Editar una alerta — solo threshold + direction. La currency y
   *  el asset no se cambian. Mismo manejo de errores que create. */
  update: (
    alertId: string,
    patch: { threshold: number; direction: AlertDirection },
  ) => Promise<PriceAlert>;
  /** Pausar o reactivar una alerta. */
  setPaused: (alertId: string, paused: boolean) => Promise<void>;
  /** Borrar una alerta. */
  remove: (alertId: string) => Promise<void>;
  /** Refresh de toda la lista — útil al pull-to-refresh en
   *  pantalla "Mis alertas". */
  refresh: () => Promise<void>;

  /* ─── Indicator alerts (RSI / SMA / MACD / Bollinger / Volume) ─
   *
   * Mantenemos un store paralelo para alertas de indicadores
   * técnicos. Comparten AlertStatus y la lógica de active/paused/
   * triggered, pero el modelo de datos es completamente distinto
   * (no hay threshold ni currency, sólo condiciones por tipo). */
  indicatorAlerts: IndicatorAlert[];
  activeIndicatorsForAsset: (assetId: string) => IndicatorAlert[];
  triggeredIndicatorsForAsset: (assetId: string) => IndicatorAlert[];
  createIndicator: (
    input: CreateIndicatorAlertInput,
  ) => Promise<IndicatorAlert>;
  updateIndicator: (
    alertId: string,
    patch: UpdateIndicatorAlertPatch,
  ) => Promise<IndicatorAlert>;
  setIndicatorPaused: (alertId: string, paused: boolean) => Promise<void>;
  removeIndicator: (alertId: string) => Promise<void>;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [indicatorAlerts, setIndicatorAlerts] = useState<IndicatorAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  // Hidratación inicial: cuando el user pasa a autenticado,
  // hacemos un GET /alerts y /indicator-alerts para llenar la caché.
  // Si se desloguea, las limpiamos.
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setAlerts([]);
      setIndicatorAlerts([]);
      return;
    }
    (async () => {
      setIsLoading(true);
      try {
        const [items, indicators] = await Promise.all([
          getAllAlerts(),
          getAllIndicatorAlerts(),
        ]);
        if (!cancelled) {
          setAlerts(items);
          setIndicatorAlerts(indicators);
        }
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
        (a) =>
          a.assetId === assetId &&
          (a.status === "active" || a.status === "paused"),
      ),
    [alerts],
  );

  const triggeredForAsset = useCallback(
    (assetId: string) =>
      alerts
        .filter((a) => a.assetId === assetId && a.status === "triggered")
        .sort((a, b) =>
          (b.triggeredAt ?? "").localeCompare(a.triggeredAt ?? ""),
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

  const update = useCallback(
    async (
      alertId: string,
      patch: { threshold: number; direction: AlertDirection },
    ) => {
      const updated = await apiUpdate(alertId, patch);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? updated : a)),
      );
      return updated;
    },
    [],
  );

  const setPaused = useCallback(async (alertId: string, paused: boolean) => {
    /* Optimistic — flippeamos el status local ya, después confirmamos.
     * Si el server falla, revertimos. */
    const previous = alerts.find((a) => a.id === alertId);
    if (!previous) return;
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, status: paused ? "paused" : "active" }
          : a,
      ),
    );
    try {
      await apiSetPaused(alertId, paused);
    } catch (e) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? previous : a)),
      );
      throw e;
    }
  }, [alerts]);

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
      const [items, indicators] = await Promise.all([
        getAllAlerts(),
        getAllIndicatorAlerts(),
      ]);
      setAlerts(items);
      setIndicatorAlerts(indicators);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ─── Indicator alerts methods — mismo patrón que las price ──── */

  const activeIndicatorsForAsset = useCallback(
    (assetId: string) =>
      indicatorAlerts.filter(
        (a) =>
          a.assetId === assetId &&
          (a.status === "active" || a.status === "paused"),
      ),
    [indicatorAlerts],
  );

  const triggeredIndicatorsForAsset = useCallback(
    (assetId: string) =>
      indicatorAlerts
        .filter((a) => a.assetId === assetId && a.status === "triggered")
        .sort((a, b) =>
          (b.triggeredAt ?? "").localeCompare(a.triggeredAt ?? ""),
        ),
    [indicatorAlerts],
  );

  const createIndicator = useCallback(
    async (input: CreateIndicatorAlertInput) => {
      const created = await apiCreateIndicator(input);
      setIndicatorAlerts((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const updateIndicator = useCallback(
    async (alertId: string, patch: UpdateIndicatorAlertPatch) => {
      const updated = await apiUpdateIndicator(alertId, patch);
      setIndicatorAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? updated : a)),
      );
      return updated;
    },
    [],
  );

  const setIndicatorPaused = useCallback(
    async (alertId: string, paused: boolean) => {
      const previous = indicatorAlerts.find((a) => a.id === alertId);
      if (!previous) return;
      // Optimistic flip — revertimos si el server falla.
      setIndicatorAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? ({ ...a, status: paused ? "paused" : "active" } as IndicatorAlert)
            : a,
        ),
      );
      try {
        await apiSetIndicatorPaused(alertId, paused);
      } catch (e) {
        setIndicatorAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? previous : a)),
        );
        throw e;
      }
    },
    [indicatorAlerts],
  );

  const removeIndicator = useCallback(async (alertId: string) => {
    let removed: IndicatorAlert | undefined;
    setIndicatorAlerts((prev) => {
      const idx = prev.findIndex((a) => a.id === alertId);
      if (idx === -1) return prev;
      removed = prev[idx];
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    try {
      await apiDeleteIndicator(alertId);
    } catch (e) {
      if (removed) {
        const r = removed;
        setIndicatorAlerts((prev) => [r, ...prev]);
      }
      throw e;
    }
  }, []);

  const value = useMemo<AlertsContextValue>(
    () => ({
      alerts,
      activeForAsset,
      triggeredForAsset,
      hasActiveForAsset,
      isLoading,
      create,
      update,
      setPaused,
      remove,
      refresh,
      indicatorAlerts,
      activeIndicatorsForAsset,
      triggeredIndicatorsForAsset,
      createIndicator,
      updateIndicator,
      setIndicatorPaused,
      removeIndicator,
    }),
    [
      alerts,
      activeForAsset,
      triggeredForAsset,
      hasActiveForAsset,
      isLoading,
      create,
      update,
      setPaused,
      remove,
      refresh,
      indicatorAlerts,
      activeIndicatorsForAsset,
      triggeredIndicatorsForAsset,
      createIndicator,
      updateIndicator,
      setIndicatorPaused,
      removeIndicator,
    ],
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
