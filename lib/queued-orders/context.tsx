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
  cancelQueuedOrder as apiCancel,
  createQueuedOrder as apiCreate,
  getQueuedOrders,
  type CreateQueuedOrderInput,
  type QueuedOrder,
} from "../api/queued-orders";
import { useAuth } from "../auth/context";

/**
 * Estado global de las órdenes encoladas (deferred orders) del
 * usuario. Caché en memoria, hidratada al login y refrescable
 * desde la pantalla "Órdenes pendientes".
 */

interface QueuedOrdersContextValue {
  orders: QueuedOrder[];
  /** Sólo las que están todavía en la queue (no executed/cancelled). */
  pendingOrders: QueuedOrder[];
  isLoading: boolean;
  create: (input: CreateQueuedOrderInput) => Promise<QueuedOrder>;
  cancel: (orderId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const QueuedOrdersContext = createContext<QueuedOrdersContextValue | null>(
  null,
);

export function QueuedOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<QueuedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setOrders([]);
      return;
    }
    (async () => {
      setIsLoading(true);
      try {
        const items = await getQueuedOrders();
        if (!cancelled) setOrders(items);
      } catch {
        // Silent — pantalla refresh puede reintentar.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "queued"),
    [orders],
  );

  const create = useCallback(async (input: CreateQueuedOrderInput) => {
    const created = await apiCreate(input);
    setOrders((prev) => [created, ...prev]);
    return created;
  }, []);

  const cancel = useCallback(async (orderId: string) => {
    let prevSnapshot: QueuedOrder | null = null;
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === orderId);
      if (idx === -1) return prev;
      prevSnapshot = prev[idx];
      const next = [...prev];
      next[idx] = { ...next[idx], status: "cancelled" };
      return next;
    });
    try {
      await apiCancel(orderId);
    } catch (e) {
      // Revert: volvemos al status original.
      if (prevSnapshot) {
        const snap = prevSnapshot;
        setOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === orderId);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = snap;
          return next;
        });
      }
      throw e;
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await getQueuedOrders();
      setOrders(items);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<QueuedOrdersContextValue>(
    () => ({
      orders,
      pendingOrders,
      isLoading,
      create,
      cancel,
      refresh,
    }),
    [orders, pendingOrders, isLoading, create, cancel, refresh],
  );

  return (
    <QueuedOrdersContext.Provider value={value}>
      {children}
    </QueuedOrdersContext.Provider>
  );
}

export function useQueuedOrders(): QueuedOrdersContextValue {
  const ctx = useContext(QueuedOrdersContext);
  if (!ctx) {
    throw new Error(
      "useQueuedOrders debe usarse dentro de <QueuedOrdersProvider>",
    );
  }
  return ctx;
}
