import { memo } from "react";
import Svg, {
  Circle,
  Ellipse,
  G,
  Path,
  Polygon,
  Rect,
} from "react-native-svg";

/**
 * Categorías de mercado — set 'categorias' del brand pack.
 *
 * Geometría 1:1 con assets/icons/categorias/{slug}.svg. Cada icono
 * es un par stroke-dark + fill-light (alpha 0.25 sobre el shape
 * principal) más detalles encima. Los colores son distintos por
 * categoría para que la jerarquía visual del listado se lea por
 * color de un vistazo.
 *
 * Mantenemos los colores hardcoded por categoría — son parte de la
 * identidad visual del brand pack y no varían por theme.
 */

export type CategorySlug =
  // AR
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
  // US
  | "us-acciones"
  | "us-etfs"
  | "us-opciones"
  | "us-tbills"
  | "us-bonos-corp"
  | "us-short"
  | "us-cash"
  | "us-fpsl"
  // CRYPTO
  | "cr-crypto";

interface Props {
  slug: CategorySlug;
  size?: number;
}

/** Paleta por categoría — stroke (oscuro), tint (claro al 25%). */
const PALETTE: Record<CategorySlug, { stroke: string; tint: string }> = {
  "ar-acciones": { stroke: "#0284C7", tint: "#38BDF8" },
  "ar-cedears": { stroke: "#EA580C", tint: "#FB923C" },
  "ar-bonos-usd": { stroke: "#059669", tint: "#34D399" },
  "ar-bonos-ars": { stroke: "#0891B2", tint: "#67E8F9" },
  "ar-letras": { stroke: "#A16207", tint: "#EAB308" },
  "ar-ons": { stroke: "#EA580C", tint: "#FB923C" },
  "ar-opciones": { stroke: "#DB2777", tint: "#F472B6" },
  "ar-futuros": { stroke: "#00B864", tint: "#00E676" },
  "ar-fci": { stroke: "#059669", tint: "#34D399" },
  "ar-cauciones": { stroke: "#A16207", tint: "#EAB308" },
  "ar-mep": { stroke: "#2563EB", tint: "#60A5FA" },
  "ar-ccl": { stroke: "#0E7490", tint: "#22D3EE" },
  "us-acciones": { stroke: "#059669", tint: "#34D399" },
  "us-etfs": { stroke: "#7C3AED", tint: "#A78BFA" },
  "us-opciones": { stroke: "#DB2777", tint: "#F472B6" },
  "us-tbills": { stroke: "#1E3A8A", tint: "#3B82F6" },
  "us-bonos-corp": { stroke: "#7C3AED", tint: "#A78BFA" },
  "us-short": { stroke: "#DC2626", tint: "#F87171" },
  "us-cash": { stroke: "#65A30D", tint: "#A3E635" },
  "us-fpsl": { stroke: "#DC2626", tint: "#F87171" },
  "cr-crypto": { stroke: "#EA580C", tint: "#FB923C" },
};

export const CategoryGlyph = memo(function CategoryGlyph({
  slug,
  size = 32,
}: Props) {
  const { stroke, tint } = PALETTE[slug];
  const sw = 2.2;
  const common = {
    stroke,
    strokeWidth: sw,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    fill: "none" as const,
  };
  const tintProps = {
    fill: tint,
    fillOpacity: 0.25,
    stroke: undefined,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {slug === "ar-acciones" ? (
        <>
          <G>
            <Path
              d="M16 4 L26 8 L26 17 Q26 23 16 28 Q6 23 6 17 L6 8 Z"
              {...tintProps}
            />
          </G>
          <Path
            d="M16 4 L26 8 L26 17 Q26 23 16 28 Q6 23 6 17 L6 8 Z"
            {...common}
          />
          <Path d="M6 14 L26 14" {...common} />
          <Circle cx={16} cy={14} r={2} fill={tint} />
        </>
      ) : slug === "ar-cedears" ? (
        <>
          <G>
            <Polygon points="16,4 26,10 26,22 16,28 6,22 6,10" {...tintProps} />
          </G>
          <Polygon points="16,4 26,10 26,22 16,28 6,22 6,10" {...common} />
          <Path d="M19 12 Q14 12 14 16 Q14 20 19 20" {...common} />
          <Path d="M16 9 L16 11" {...common} />
          <Path d="M16 21 L16 23" {...common} />
        </>
      ) : slug === "ar-bonos-usd" ? (
        <>
          <Rect x={4} y={9} width={24} height={14} rx={2} {...tintProps} />
          <Rect x={4} y={9} width={24} height={14} rx={2} {...common} />
          <Circle cx={16} cy={16} r={3.5} {...common} />
          <Path d="M16 12 L16 20" {...common} />
        </>
      ) : slug === "ar-bonos-ars" ? (
        <>
          <Rect x={4} y={9} width={24} height={14} rx={2} {...tintProps} />
          <Rect x={4} y={9} width={24} height={14} rx={2} {...common} />
          <Path d="M14 11 L14 21" {...common} />
          <Path d="M18 11 L18 21" {...common} />
          <Path d="M11.5 14 L20.5 14" {...common} />
          <Path d="M11.5 18 L20.5 18" {...common} />
        </>
      ) : slug === "ar-letras" ? (
        <>
          <Path d="M7 4 L21 4 L25 8 L25 28 L7 28 Z" {...tintProps} />
          <Path d="M7 4 L21 4 L25 8 L25 28 L7 28 Z" {...common} />
          <Path d="M21 4 L21 8 L25 8" {...common} />
          <Circle cx={20} cy={20} r={3.5} {...common} />
          <Path d="M11 14 L18 14" {...common} />
        </>
      ) : slug === "ar-ons" ? (
        <>
          <Path
            d="M6 6 Q6 4 8 4 L24 4 Q26 4 26 6 L26 26 Q26 28 24 28 L8 28 Q6 28 6 26 Z"
            {...tintProps}
          />
          <Path
            d="M6 6 Q6 4 8 4 L24 4 Q26 4 26 6 L26 26 Q26 28 24 28 L8 28 Q6 28 6 26 Z"
            {...common}
          />
          <Path d="M11 11 L21 11" {...common} />
          <Path d="M11 16 L21 16" {...common} />
          <Path d="M11 21 L17 21" {...common} />
        </>
      ) : slug === "ar-opciones" ? (
        <>
          <Path d="M16 14 L16 4" {...common} />
          <Path d="M16 14 L8 24" {...common} />
          <Path d="M16 14 L24 24" {...common} />
          <Path d="M12 4 L16 4 L16 8" {...common} />
          <Path d="M5 21 L8 24 L11 21" {...common} />
          <Path d="M21 21 L24 24 L27 21" {...common} />
          <Circle cx={16} cy={14} r={2.4} {...tintProps} />
          <Circle cx={16} cy={14} r={2.4} {...common} />
        </>
      ) : slug === "ar-futuros" ? (
        <>
          <Path d="M5 13 L16 5 L27 13 L27 15 L5 15 Z" {...tintProps} />
          <Path d="M5 13 L16 5 L27 13 L27 15 L5 15 Z" {...common} />
          <Path d="M5 27 L27 27" {...common} />
          <Path d="M9 15 L9 25" {...common} />
          <Path d="M14 15 L14 25" {...common} />
          <Path d="M18 15 L18 25" {...common} />
          <Path d="M23 15 L23 25" {...common} />
          <Path d="M5 25 L27 25" {...common} />
        </>
      ) : slug === "ar-fci" ? (
        <>
          <Circle cx={16} cy={16} r={11} {...tintProps} />
          <Circle cx={16} cy={16} r={11} {...common} />
          <Path d="M16 9 L16 23" {...common} />
          <Path
            d="M12 12 Q12 10 14 10 L18 10 Q20 10 20 12 L20 14 Q20 16 18 16 L14 16 Q12 16 12 18 L12 20 Q12 22 14 22 L18 22 Q20 22 20 20"
            {...common}
          />
        </>
      ) : slug === "ar-cauciones" ? (
        <>
          <Path
            d="M9 5 L23 5 L23 10 L18 16 L23 22 L23 27 L9 27 L9 22 L14 16 L9 10 Z"
            {...tintProps}
          />
          <Path
            d="M9 5 L23 5 L23 10 L18 16 L23 22 L23 27 L9 27 L9 22 L14 16 L9 10 Z"
            {...common}
          />
          <Path d="M11 8 L21 8" {...common} />
          <Path d="M11 24 L21 24" {...common} />
        </>
      ) : slug === "ar-mep" ? (
        <>
          <Rect x={4} y={9} width={24} height={14} rx={2} {...tintProps} />
          <Rect x={4} y={9} width={24} height={14} rx={2} {...common} />
          <Path d="M16 13 L16 19" {...common} />
          <Path d="M14 15 L18 17" {...common} />
          <Path d="M14 17 L18 15" {...common} />
          <Path d="M9 6 Q4 8 4 14" {...common} />
          <Path d="M2 12 L4 14 L6 12" {...common} />
        </>
      ) : slug === "ar-ccl" ? (
        <>
          <Circle cx={14} cy={16} r={9} {...tintProps} />
          <Circle cx={14} cy={16} r={9} {...common} />
          <Path d="M14 9 L14 23" {...common} />
          <Path d="M18 12 Q14 12 14 16 Q14 20 18 20" {...common} />
          <Path d="M22 8 L26 8 L26 12" {...common} />
          <Path d="M20 14 L26 8" {...common} />
        </>
      ) : slug === "us-acciones" ? (
        <>
          <Circle cx={16} cy={16} r={11} {...tintProps} />
          <Circle cx={16} cy={16} r={11} {...common} />
          <Path d="M16 5 L16 16 L26 19" {...common} />
          <Path d="M16 16 L7 11" {...common} />
        </>
      ) : slug === "us-etfs" ? (
        <>
          <Circle cx={16} cy={16} r={11} {...tintProps} />
          <Circle cx={16} cy={16} r={11} {...common} />
          <Ellipse cx={16} cy={16} rx={5} ry={11} {...common} />
          <Path d="M5 16 L27 16" {...common} />
        </>
      ) : slug === "us-opciones" ? (
        <>
          <Path d="M4 24 L28 24" {...common} />
          <Path d="M4 24 L4 6" {...common} />
          <Path d="M4 22 L11 22 L16 12 L21 22 L28 22" {...common} />
          <Circle cx={16} cy={12} r={2} {...tintProps} />
          <Circle cx={16} cy={12} r={2} {...common} />
        </>
      ) : slug === "us-tbills" ? (
        <>
          <Path d="M5 12 L27 12 L27 14 L5 14 Z" {...tintProps} />
          <Path d="M16 5 L16 12" {...common} />
          <Path d="M11 8 L21 8" {...common} />
          <Path d="M5 12 L27 12 L27 14 L5 14 Z" {...common} />
          <Path d="M9 14 L9 24" {...common} />
          <Path d="M16 14 L16 24" {...common} />
          <Path d="M23 14 L23 24" {...common} />
          <Path d="M5 26 L27 26" {...common} />
        </>
      ) : slug === "us-bonos-corp" ? (
        <>
          <Rect x={6} y={6} width={20} height={22} {...tintProps} />
          <Rect x={6} y={6} width={20} height={22} {...common} />
          <Path d="M11 11 L11 13" {...common} />
          <Path d="M16 11 L16 13" {...common} />
          <Path d="M21 11 L21 13" {...common} />
          <Path d="M11 16 L11 18" {...common} />
          <Path d="M21 16 L21 18" {...common} />
          <Circle cx={16} cy={20} r={2.5} {...common} />
          <Path d="M16 17 L16 23" {...common} />
        </>
      ) : slug === "us-short" ? (
        <>
          <Rect x={5} y={7} width={22} height={20} rx={2} {...tintProps} />
          <Rect x={5} y={7} width={22} height={20} rx={2} {...common} />
          <Path d="M10 4 L10 10" {...common} />
          <Path d="M22 4 L22 10" {...common} />
          <Path d="M5 13 L27 13" {...common} />
          <Path d="M11 21 L21 21" {...common} />
          <Path d="M19 18 L21 21 L19 24" {...common} />
        </>
      ) : slug === "us-cash" ? (
        <>
          <Circle cx={16} cy={16} r={11} {...tintProps} />
          <Circle cx={16} cy={16} r={11} {...common} />
          <Path d="M11 13 Q16 9 21 13" {...common} />
          <Path d="M11 19 Q16 23 21 19" {...common} />
          <Path d="M9 13 L11 11 L13 13" {...common} />
          <Path d="M19 19 L21 21 L23 19" {...common} />
        </>
      ) : slug === "us-fpsl" ? (
        <>
          <Circle cx={16} cy={16} r={11} {...tintProps} />
          <Circle cx={16} cy={16} r={11} {...common} />
          <Path
            d="M19 11 Q15 11 15 14 Q15 16 19 16 Q22 16 22 19 Q22 22 19 22 L13 22"
            {...common}
          />
          <Path d="M11 19 L13 22 L11 25" {...common} />
        </>
      ) : (
        // cr-crypto — pentágono con C estilizada (Bitcoin-like).
        <>
          <Polygon
            points="16,4 26,10 26,22 16,28 6,22 6,10"
            {...tintProps}
          />
          <Polygon points="16,4 26,10 26,22 16,28 6,22 6,10" {...common} />
          <Path d="M19 12 Q14 12 14 16 Q14 20 19 20" {...common} />
          <Path d="M16 9 L16 11" {...common} />
          <Path d="M16 21 L16 23" {...common} />
        </>
      )}
    </Svg>
  );
});
