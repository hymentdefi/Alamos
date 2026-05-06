import { memo } from "react";
import Svg, { G, Path } from "react-native-svg";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir).
 *
 * Sólo el símbolo en stroke verde brand de 4px sobre transparente —
 * sin anillo ni fondo tint. Geometría delgada, presencia limpia.
 *
 * Variantes fuente:
 *   assets/icons/actions/light/alamos-{ingresar|enviar|convertir}.svg
 *   assets/icons/actions/dark/alamos-{ingresar|enviar|convertir}.svg
 */

export type ActionIconName = "ingresar" | "enviar" | "convertir";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del color del stroke. Default: brand.green canónico
   *  (#00C805 — coincide con c.brand del theme y con el isotipo del
   *  logo). */
  stroke?: string;
}

const BRAND_GREEN = "#00C805";

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke = BRAND_GREEN,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
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
