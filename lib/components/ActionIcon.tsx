import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir).
 *
 * Círculo lleno con un tint suave del verde brand (10% en light,
 * 14% en dark) y símbolo en stroke brand de 4px adentro. Sin anillo
 * — el tint hace de surface y le da peso al botón sin sentirse
 * pesado.
 *
 * Variantes fuente:
 *   assets/icons/actions/light/alamos-{ingresar|enviar|convertir}.svg
 *   assets/icons/actions/dark/alamos-{ingresar|enviar|convertir}.svg
 */

export type ActionIconName = "ingresar" | "enviar" | "convertir";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del color del stroke del símbolo. Default: brand.green
   *  canónico (#00C805 — coincide con c.brand del theme y con el
   *  isotipo del logo). */
  stroke?: string;
}

const BRAND_GREEN = "#00C805";

const tintFor = (mode: "light" | "dark") =>
  mode === "dark" ? "rgba(0,200,5,0.14)" : "rgba(0,200,5,0.10)";

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke = BRAND_GREEN,
}: Props) {
  const { mode } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={32} fill={tintFor(mode)} />
      <G
        transform="translate(32 32)"
        fill="none"
        stroke={stroke}
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
