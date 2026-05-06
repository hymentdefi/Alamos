import type {
  Asset,
  AssetCategory,
  AssetMarket,
} from "./assets";

/**
 * Slug identifier de cada categoría visible en /Mercado. Sirve
 * como key estable para deep-links (ej: /market-category?slug=X)
 * y aggregations cross-screen.
 */
export type CategorySlug =
  | "ar-acciones"
  | "ar-cedears"
  | "ar-bonos-usd"
  | "ar-bonos-ars"
  | "ar-letras"
  | "ar-ons"
  | "ar-opciones"
  | "ar-futuros"
  | "ar-fci"
  | "ar-cauciones"
  | "ar-mep"
  | "ar-ccl"
  | "us-acciones"
  | "us-etfs"
  | "us-opciones"
  | "us-tbills"
  | "us-bonos-corp"
  | "us-short"
  | "us-cash"
  | "us-fpsl"
  | "cr-crypto";

/**
 * Categorías visibles en el listado de cada mercado en /Mercado.
 * Cada categoría tiene su slug (matchea el icono del brand pack), un
 * label visible, una descripción opcional y un display string de
 * cantidad de instrumentos (ej: "+11.000 acciones US").
 *
 * El filtro maps el catálogo `assets` a la categoría: si está
 * presente, la pantalla de detalle muestra los assets que matchean.
 * Si no está, mostramos un empty state 'Próximamente' — el dato
 * vendría de la API en producción y todavía no está mockeado.
 */

export interface MarketCategory {
  slug: CategorySlug;
  label: string;
  /** Subline corta debajo del label en el listado. */
  hint?: string;
  /** Display 'count' a la derecha del row (mock: hardcoded). */
  count?: string;
  /** Filtro de assets para la pantalla de detalle. Devuelve el subset
   *  del catálogo que pertenece a esta categoría. Si es undefined,
   *  la categoría está como placeholder ('Próximamente'). */
  filter?: (a: Asset) => boolean;
}

/* Helper para filtros por AssetCategory simple. */
const byCategory = (cat: AssetCategory) => (a: Asset) =>
  a.category === cat;

/* AR + US disambig por moneda — los bonos AR están denominados en
 *  ARS o USD según el instrumento. Como `category: "bonos"` es
 *  agnóstico, distinguimos por currency. */
import { assetCurrency } from "./assets";

const arBonosByCurrency = (cur: "ARS" | "USD") => (a: Asset) =>
  a.category === "bonos" && assetCurrency(a) === cur;

/* US-specific filters — la categoría 'acciones' del catálogo no
 *  diferencia AR vs US, así que filtramos también por market. */
import { assetMarket } from "./assets";

const usAcciones = (a: Asset) =>
  a.category === "acciones" && assetMarket(a) === "US";
const arAcciones = (a: Asset) =>
  a.category === "acciones" && assetMarket(a) === "AR";

export const CATEGORIES_BY_MARKET: Record<AssetMarket, MarketCategory[]> = {
  AR: [
    {
      slug: "ar-acciones",
      label: "Acciones locales",
      hint: "Merval + panel general",
      filter: arAcciones,
    },
    {
      slug: "ar-cedears",
      label: "CEDEARs",
      hint: "Acciones y ETFs internacionales",
      filter: byCategory("cedears"),
    },
    {
      slug: "ar-bonos-usd",
      label: "Bonos soberanos USD",
      hint: "Globales y Bonares",
      filter: arBonosByCurrency("USD"),
    },
    {
      slug: "ar-bonos-ars",
      label: "Bonos soberanos ARS",
      hint: "Lecaps, Boncaps, Boncer, Duales",
      filter: arBonosByCurrency("ARS"),
    },
    {
      slug: "ar-letras",
      label: "Letras del Tesoro",
      filter: byCategory("letras"),
    },
    {
      slug: "ar-ons",
      label: "Obligaciones Negociables",
      hint: "ONs",
      filter: byCategory("obligaciones"),
    },
    {
      slug: "ar-opciones",
      label: "Opciones",
      hint: "Sobre acciones, CEDEARs, títulos públicos",
    },
    {
      slug: "ar-futuros",
      label: "Futuros",
      hint: "S&P Merval, dólar, tasa de caución",
      filter: byCategory("futuros"),
    },
    {
      slug: "ar-fci",
      label: "Fondos Comunes de Inversión",
      hint: "FCI",
      filter: byCategory("fci"),
    },
    {
      slug: "ar-cauciones",
      label: "Cauciones bursátiles",
      hint: "1–120 días, ARS y USD",
      filter: byCategory("caucion"),
    },
    {
      slug: "ar-mep",
      label: "Dólar MEP",
    },
    {
      slug: "ar-ccl",
      label: "Dólar CCL",
    },
  ],
  US: [
    {
      slug: "us-acciones",
      label: "Acciones US",
      count: "+11.000",
      filter: usAcciones,
    },
    {
      slug: "us-etfs",
      label: "ETFs US",
    },
    {
      slug: "us-opciones",
      label: "Opciones",
      hint: "Single-leg y multi-leg",
    },
    {
      slug: "us-tbills",
      label: "US Treasury Bills",
      count: "229+",
    },
    {
      slug: "us-bonos-corp",
      label: "Bonos corporativos US",
      count: "500+",
    },
    {
      slug: "us-short",
      label: "Short selling",
    },
    {
      slug: "us-cash",
      label: "Cash sweep",
      hint: "High-yield",
    },
    {
      slug: "us-fpsl",
      label: "Securities lending",
      hint: "FPSL",
    },
  ],
  CRYPTO: [
    {
      slug: "cr-crypto",
      label: "Crypto",
      filter: (a) => a.category === "crypto" || a.category === "futuros",
    },
  ],
};

/** Lookup de una categoría por slug — útil en la pantalla de detalle
 *  cuando solo recibimos el slug en los params. */
export function findCategoryBySlug(
  slug: string,
): { market: AssetMarket; category: MarketCategory } | null {
  for (const market of ["AR", "US", "CRYPTO"] as AssetMarket[]) {
    const found = CATEGORIES_BY_MARKET[market].find((c) => c.slug === slug);
    if (found) return { market, category: found };
  }
  return null;
}

/** Mapea un asset a la categoría visible del brand pack.
 *
 *  - Crypto → cr-crypto (incluye spot + futuros perpetuos)
 *  - US acciones → us-acciones (US ETFs/T-Bills/etc no están en
 *    el catálogo todavía, devolvemos null)
 *  - AR: mapeamos por category + currency (los bonos AR se splitean
 *    USD vs ARS porque las categorías del brand pack los separan).
 *
 *  Los assets que no calzan en ninguna categoría visible (ej:
 *  efectivo) devuelven null y los descarta el caller. */
export function categorizeAsset(a: Asset): CategorySlug | null {
  const market = assetMarket(a);
  if (market === "CRYPTO") return "cr-crypto";
  if (market === "US") {
    if (a.category === "acciones") return "us-acciones";
    return null;
  }
  // AR
  switch (a.category) {
    case "acciones":
      return "ar-acciones";
    case "cedears":
      return "ar-cedears";
    case "bonos":
      return assetCurrency(a) === "USD" ? "ar-bonos-usd" : "ar-bonos-ars";
    case "letras":
      return "ar-letras";
    case "obligaciones":
      return "ar-ons";
    case "fci":
      return "ar-fci";
    case "caucion":
      return "ar-cauciones";
    case "futuros":
      return "ar-futuros";
    case "opciones":
      return "ar-opciones";
    default:
      return null;
  }
}
