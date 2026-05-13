import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir).
 *
 * Outline brand puro — círculo con stroke c.brand 2.5px (sin fill ni
 * tint) y símbolo interno (flecha down/up/arrows-swap) en stroke
 * c.brand 4px. Mantiene la presencia del set "tint-S" del brand pack
 * pero sin el medio-fill — sigue la regla del sistema de jerarquía:
 * solid brand (CTA primario) o outline (importante pero secundario).
 */

export type ActionIconName = "ingresar" | "enviar" | "convertir";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del color del stroke (símbolo + círculo). Default:
   *  c.brand del theme (#00C805 canónico). */
  stroke?: string;
}

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke,
}: Props) {
  const { c } = useTheme();
  const strokeColor = stroke ?? c.brand;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle
        cx={32}
        cy={32}
        r={30.5}
        fill="none"
        stroke={strokeColor}
        strokeWidth={3}
      />
      <G
        transform="translate(32 32)"
        fill="none"
        stroke={strokeColor}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {name === "ingresar" ? (
          <>
            <Path d="M0 -10 L0 10" />
            <Path d="M-9 1 L0 10 L9 1" />
          </>
        ) : name === "enviar" ? (
          <>
            <Path d="M0 10 L0 -10" />
            <Path d="M-9 -1 L0 -10 L9 -1" />
          </>
        ) : (
          <>
            <Path d="M-10 -6 L10 -6" />
            <Path d="M4 -12 L10 -6 L4 0" />
            <Path d="M10 6 L-10 6" />
            <Path d="M-4 0 L-10 6 L-4 12" />
          </>
        )}
      </G>
    </Svg>
  );
});
