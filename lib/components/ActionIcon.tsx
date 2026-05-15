import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos de acción del home (Ingresar / Enviar / Invertir / Actividad).
 *
 * Layout Lemon-style: círculo oscuro sólido (c.ink en light, gris
 * oscuro en dark) con el símbolo en c.brand (verde). Alto contraste,
 * el verde pop sobre la base oscura.
 */

export type ActionIconName = "ingresar" | "enviar" | "invertir" | "actividad";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del color del símbolo. Default: c.brand del theme. */
  stroke?: string;
}

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke,
}: Props) {
  const { c, mode } = useTheme();
  const isDark = mode === "dark";
  const symbolColor = stroke ?? c.brand;
  /* Círculo Lemon-style: bien oscuro en light (#0E0F0C ink),
   * gris oscuro en dark (#1F1F1F surfaceHover-ish) para que se
   * lea sobre el card #0F0F0F sin desaparecer. */
  const circleColor = isDark ? "#1F1F1F" : "#0E0F0C";

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={30.5} fill={circleColor} />
      <G
        transform="translate(32 32)"
        fill="none"
        stroke={symbolColor}
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
        ) : name === "invertir" ? (
          // invertir: flecha trending up (growth/invest universal).
          <>
            <Path d="M-10 8 L10 -10" />
            <Path d="M3 -10 L10 -10 L10 -3" />
          </>
        ) : (
          // actividad: pulso flat-spike-flat (activity feed / heartbeat).
          <Path d="M-11 0 L-5 0 L-3 -7 L0 7 L3 -7 L5 0 L11 0" />
        )}
      </G>
    </Svg>
  );
});
