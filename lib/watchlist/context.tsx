import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Haptics from "expo-haptics";
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
} from "./api";
import { useAuth } from "../auth/context";
import { useToast } from "../toast/context";

interface WatchlistContextValue {
  /** Set de assetIds que el usuario tiene en su watchlist. */
  items: ReadonlySet<string>;
  /** ¿Está cargando la lista del backend? */
  isLoading: boolean;
  /** Verifica si un activo está en la watchlist. */
  isWatched: (assetId: string) => boolean;
  /** Toggle agregar/quitar — incluye haptic + actualiza optimistic. */
  toggle: (assetId: string) => Promise<void>;
}

const Ctx = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { show: showToast } = useToast();
  const [items, setItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Sync inicial desde el "backend" (mock) cuando el user está logueado.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setItems(new Set());
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listWatchlist(user.id)
      .then((entries) => {
        if (cancelled) return;
        setItems(new Set(entries.map((e) => e.assetId)));
      })
      .catch(() => {
        if (cancelled) return;
        setItems(new Set());
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  const toggle = useCallback(
    async (assetId: string) => {
      if (!user) {
        // TODO: redirigir a auth con deep link de vuelta. Por ahora
        // no-op silencioso — el botón debería estar oculto si no hay
        // sesión.
        return;
      }
      const wasWatched = items.has(assetId);
      // Optimistic update
      setItems((prev) => {
        const next = new Set(prev);
        if (wasWatched) next.delete(assetId);
        else next.add(assetId);
        return next;
      });
      Haptics.impactAsync(
        wasWatched
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium,
      ).catch(() => {});
      try {
        if (wasWatched) await removeFromWatchlist(user.id, assetId);
        else await addToWatchlist(user.id, assetId);
        // Sin toast de confirmación — el ícono del corazón ya cambia
        // al toggle (filled / outline). Eso comunica el estado.
        // Errores sí mantienen toast porque sino el revert del
        // optimistic se vería silencioso.
      } catch {
        // Revertir optimistic update si falla.
        setItems((prev) => {
          const next = new Set(prev);
          if (wasWatched) next.add(assetId);
          else next.delete(assetId);
          return next;
        });
        showToast("No pudimos guardar el cambio. Reintentá.", {
          variant: "error",
        });
      }
    },
    [items, user, showToast],
  );

  const value = useMemo<WatchlistContextValue>(
    () => ({
      items,
      isLoading,
      isWatched: (id: string) => items.has(id),
      toggle,
    }),
    [items, isLoading, toggle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWatchlist must be used within <WatchlistProvider>");
  return v;
}
