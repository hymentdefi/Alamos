import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir).
 *
 * Set "outlined-A" del brand pack: circulo con stroke verde brand
 * y un símbolo (flecha down / up / arrows-swap) en el mismo verde
 * dentro. En light mode el círculo es blanco; en dark mode el
 * círculo es transparente (solo el anillo).
 *
 * Variantes fuente:
 *   assets/icons/actions/light/alamos-{ingresar|enviar|convertir}.svg
 *   assets/icons/actions/dark/alamos-{ingresar|enviar|convertir}.svg
 */

export type ActionIconName = "ingresar" | "enviar" | "convertir";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del color del stroke (anillo + símbolo). Default:
   *  brand.green canónico (#00C805 — coincide con c.brand del
   *  theme y con el isotipo del logo). */
  stroke?: string;
  /** Override del fill del círculo. Default: blanco en light,
   *  transparent en dark. */
  fill?: string;
}

const BRAND_GREEN = "#00C805";
const WHITE = "#FFFFFF";

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke = BRAND_GREEN,
  fill,
}: Props) {
  const { mode } = useTheme();
  // Light: círculo blanco. Dark: solo anillo (fill transparente).
  const resolvedFill = fill ?? (mode === "dark" ? "transparent" : WHITE);

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle
        cx={32}
        cy={32}
        r={30.5}
        fill={resolvedFill}
        stroke={stroke}
        strokeWidth={2}
      />
      <G
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {name === "ingresar" ? (
          <>
            <Path d="M32 21 L32 41" />
            <Path d="M23 33 L32 42 L41 33" />
          </>
        ) : name === "enviar" ? (
          <>
            <Path d="M32 43 L32 23" />
            <Path d="M23 31 L32 22 L41 31" />
          </>
        ) : (
          <>
            <Path d="M22 26 L42 26" />
            <Path d="M36 20 L42 26 L36 32" />
            <Path d="M42 38 L22 38" />
            <Path d="M28 32 L22 38 L28 44" />
          </>
        )}
      </G>
    </Svg>
  );
});
