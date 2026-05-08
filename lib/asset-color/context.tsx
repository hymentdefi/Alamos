import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useTheme } from "../theme";

/**
 * Estado cromático del activo. Se calcula a partir de la variación %
 * del rango actualmente seleccionado en el chart (NO del día). Cuando
 * el usuario tappea un range tab distinto, este estado se recalcula
 * en el componente que monta el provider, todos los consumidores
 * rerenderean con la paleta correspondiente.
 *
 * Estados:
 *   - "up"   variación rango ≥ 0%  → verde data Álamos (#5AC53A)
 *   - "down" variación rango < 0%  → naranja cálido (red token = #EB5D2A)
 *
 * No hay "flat" — variación 0.00% defaultea a up.
 */
export type AssetColorState = "up" | "down";

export interface AssetColorValue {
  state: AssetColorState;
  /** Color sólido del estado actual — para texto, líneas, fills. */
  color: string;
  /** Color tenue (rgba bajo opacity) — para badge bgs, pills. */
  dim: string;
  /** Color "on color" para texto sobre fondo de `color` (típicamente
   *  blanco puro). */
  onColor: string;
}

const Ctx = createContext<AssetColorValue | null>(null);

export function AssetColorProvider({
  up,
  children,
}: {
  /** True si el activo está positivo en el rango seleccionado. */
  up: boolean;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const value = useMemo<AssetColorValue>(
    () => ({
      state: up ? "up" : "down",
      color: up ? c.dataGreen : c.red,
      dim: up ? c.dataGreenDim : c.redDim,
      onColor: "#FFFFFF",
    }),
    [up, c.dataGreen, c.red, c.dataGreenDim, c.redDim],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Hook para consumir el color contextual del activo. Lanza si no hay
 * provider — eso significa que el componente está rendereando fuera
 * de pantalla de detalle, lo cual probablemente es un bug. Si querés
 * un fallback "default up", usá `useAssetColorOptional()`.
 */
export function useAssetColor(): AssetColorValue {
  const v = useContext(Ctx);
  if (!v)
    throw new Error(
      "useAssetColor: hook llamado fuera de <AssetColorProvider>",
    );
  return v;
}

/**
 * Variante que devuelve null fuera del provider — útil para componentes
 * que pueden mostrarse tanto en detalle (con chromatic) como afuera.
 */
export function useAssetColorOptional(): AssetColorValue | null {
  return useContext(Ctx);
}
