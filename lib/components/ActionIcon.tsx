import { memo } from "react";
import Svg, { G, Path, Rect } from "react-native-svg";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir).
 *
 * Los SVGs originales viven en `assets/icons/actions/alamos-*.svg`,
 * y son squircles 64×64 con fill verde brand (`#00E676`) y stroke
 * blanco para el símbolo (flecha down / up / arrows-swap).
 *
 * El componente acepta `name` y `size`, y rendea el squircle entero
 * (background + stroke). NO necesita un wrapper circular alrededor —
 * el icono YA incluye su propia surface coloreada.
 */

export type ActionIconName = "ingresar" | "enviar" | "convertir";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del fill del squircle. Default: verde brand del icono.
   *  Se usa solo para casos de pressed/disabled state (atenuar). */
  bg?: string;
  /** Override del stroke del símbolo. Default: blanco. */
  stroke?: string;
}

const BRAND_GREEN = "#00C805"; // brand.green del theme — coincide
                               // con el verde canónico, en lugar
                               // del #00E676 que tenía el SVG fuente.
const WHITE = "#FFFFFF";

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  bg = BRAND_GREEN,
  stroke = WHITE,
}: Props) {
  // Radio del squircle proporcional — los SVG fuente usaban rx=20
  // sobre un viewBox 64×64, o sea 31.25%. Mantengo esa proporción
  // para que escale parejo a cualquier size.
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={0} y={0} width={64} height={64} rx={20} ry={20} fill={bg} />
      <G
        fill="none"
        stroke={stroke}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {name === "ingresar" ? (
          <>
            <Path d="M32 22 L32 40" />
            <Path d="M24 33 L32 41 L40 33" />
          </>
        ) : name === "enviar" ? (
          <>
            <Path d="M32 42 L32 24" />
            <Path d="M24 31 L32 23 L40 31" />
          </>
        ) : (
          // convertir — dos flechas horizontales opuestas
          <>
            <Path d="M23 26 L41 26" />
            <Path d="M36 21 L41 26 L36 31" />
            <Path d="M41 38 L23 38" />
            <Path d="M28 33 L23 38 L28 43" />
          </>
        )}
      </G>
    </Svg>
  );
});
