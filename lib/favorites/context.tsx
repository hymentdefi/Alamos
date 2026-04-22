import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import * as Haptics from "expo-haptics";
import { assets } from "../data/assets";

interface FavoritesContextValue {
  favorites: ReadonlySet<string>;
  isFavorite: (ticker: string) => boolean;
  toggle: (ticker: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/** Seed inicial desde los assets marcados con favorite=true. */
function seed(): Set<string> {
  const s = new Set<string>();
  for (const a of assets) if (a.favorite) s.add(a.ticker);
  return s;
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favs, setFavs] = useState<Set<string>>(seed);

  const toggle = useCallback((ticker: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      const wasFav = next.has(ticker);
      if (wasFav) next.delete(ticker);
      else next.add(ticker);
      Haptics.impactAsync(
        wasFav
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium,
      ).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      favorites: favs,
      isFavorite: (t: string) => favs.has(t),
      toggle,
    }),
    [favs, toggle],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx)
    throw new Error("useFavorites debe usarse dentro de <FavoritesProvider>");
  return ctx;
}
