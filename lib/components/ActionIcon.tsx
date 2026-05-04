import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir).
 *
 * Versión outlined-G del brand pack: circulo blanco con stroke
 * verde brand, y un símbolo (flecha down / up / arrows-swap) en
 * el mismo verde dentro. Mucho más airoso que los squircles
 * filled previos — la jerarquía visual baja para que el bloque
 * de acciones no domine sobre el saldo.
 *
 * SVG fuente: assets/icons/actions/alamos-{ingresar|enviar|
 * convertir}.svg.
 */

export type ActionIconName = "ingresar" | "enviar" | "convertir";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del color del stroke (anillo + símbolo). Default:
   *  brand.green canónico (#00C805 — coincide con c.brand del
   *  theme y con el isotipo del logo). */
  stroke?: string;
  /** Override del fill del círculo. Default: blanco — pensado
   *  para fondos cálidos del home. En dark mode podés pasar
   *  c.surface o transparent. */
  fill?: string;
}

const BRAND_GREEN = "#00C805";
const WHITE = "#FFFFFF";

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke = BRAND_GREEN,
  fill = WHITE,
}: Props) {
  // Stroke widths — en el SVG fuente eran 3 (anillo) y 3.5 (símbolo)
  // sobre un viewBox 64×64. Lo reusamos tal cual; viewBox escala.
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle
        cx={32}
        cy={32}
        r={30}
        fill={fill}
        stroke={stroke}
        strokeWidth={3}
      />
      <G
        fill="none"
        stroke={stroke}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {name === "ingresar" ? (
          <>
            <Path d="M32 24 L32 38" />
            <Path d="M26 33 L32 39 L38 33" />
          </>
        ) : name === "enviar" ? (
          <>
            <Path d="M32 40 L32 26" />
            <Path d="M26 31 L32 25 L38 31" />
          </>
        ) : (
          // convertir — dos flechas horizontales opuestas
          <>
            <Path d="M24 27 L40 27" />
            <Path d="M35 23 L40 27 L35 31" />
            <Path d="M40 37 L24 37" />
            <Path d="M29 33 L24 37 L29 41" />
          </>
        )}
      </G>
    </Svg>
  );
});
