import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos de acción del home (Ingresar / Enviar / Invertir).
 *
 * Por default: outline brand puro — círculo con stroke c.brand 3px y
 * símbolo interno en stroke c.brand 4px. Sin fill ni tint.
 *
 * Con `filled`: círculo solid c.brand, símbolo en stroke c.onColor.
 * Patrón filled brand CTA del design system — usado para destacar el
 * action principal (Ingresar) sobre los secundarios (Enviar, Invertir).
 */

export type ActionIconName = "ingresar" | "enviar" | "invertir";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del color del símbolo (y del stroke del círculo si no
   *  está filled). Default: c.brand del theme (#00C805 canónico). */
  stroke?: string;
  /** Variant filled — círculo solid c.brand, símbolo en c.onColor.
   *  Reservado para el primary action (Ingresar). Default false. */
  filled?: boolean;
}

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke,
  filled = false,
}: Props) {
  const { c } = useTheme();
  const brand = stroke ?? c.brand;
  const symbolColor = filled ? c.onColor : brand;
  const circleFill = filled ? brand : "none";
  const circleStroke = filled ? "none" : brand;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle
        cx={32}
        cy={32}
        r={30.5}
        fill={circleFill}
        stroke={circleStroke}
        strokeWidth={3}
      />
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
        ) : (
          // invertir: flecha trending up (growth/invest universal).
          <>
            <Path d="M-10 8 L10 -10" />
            <Path d="M3 -10 L10 -10 L10 -3" />
          </>
        )}
      </G>
    </Svg>
  );
});
