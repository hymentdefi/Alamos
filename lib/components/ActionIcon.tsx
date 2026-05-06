import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir).
 *
 * Anillo hairline en `c.border` (sin fill) + símbolo en stroke verde
 * brand de 4px adentro. El ring define el touch target y le da
 * tactility al botón sin meter el color tint que se sentía pesado.
 * Vibe ghost-button refinado.
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

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke = BRAND_GREEN,
}: Props) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Ring del frame — strokeWidth 1.5 en viewBox units (~1.2px en
          pantalla a size=51) para que se sienta hairline pero presente.
          r=31.25 deja medio stroke adentro para no clipear. */}
      <Circle
        cx={32}
        cy={32}
        r={31.25}
        fill="none"
        stroke={c.border}
        strokeWidth={1.5}
      />
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
