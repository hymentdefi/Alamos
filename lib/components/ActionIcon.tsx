import { memo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir / Invertir).
 *
 * Set "tint-S" del brand pack: círculo lleno con un tint suave del
 * verde brand (10% en light, 14% en dark) y un símbolo (flecha down /
 * up / arrows-swap / chart-up) en stroke verde brand de 4px. Sin
 * anillo — delgado en geometría, fuerte en presencia.
 *
 * Variantes fuente:
 *   assets/icons/actions/light/alamos-{ingresar|enviar|convertir}.svg
 *   assets/icons/actions/dark/alamos-{ingresar|enviar|convertir}.svg
 *
 * El glyph "invertir" es generado in-code (todavía no hay svg fuente
 * en el brand pack): línea quebrada ascendente terminada en flecha
 * up-right, evocando un chart de growth.
 */

export type ActionIconName =
  | "ingresar"
  | "enviar"
  | "convertir"
  | "invertir";

interface Props {
  name: ActionIconName;
  size?: number;
  /** Override del color del stroke (símbolo) y base del tint del
   *  círculo. Default: brand.green canónico (#00C805 — coincide con
   *  c.brand del theme y con el isotipo del logo). */
  stroke?: string;
  /** Override del fill del círculo. Default: tint del stroke a 10%
   *  en light y 14% en dark. */
  fill?: string;
}

const BRAND_GREEN = "#00C805";

/** Tint del fill cuando no se pasa override. Misma RGB que el stroke,
 *  alpha distinto por modo. */
const tintFor = (mode: "light" | "dark") =>
  mode === "dark" ? "rgba(0,200,5,0.14)" : "rgba(0,200,5,0.10)";

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke = BRAND_GREEN,
  fill,
}: Props) {
  const { mode } = useTheme();
  const resolvedFill = fill ?? tintFor(mode);

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={32} fill={resolvedFill} />
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
        ) : name === "convertir" ? (
          <>
            <Path d="M-10 -6 L10 -6" />
            <Path d="M4 -12 L10 -6 L4 0" />
            <Path d="M10 6 L-10 6" />
            <Path d="M-4 0 L-10 6 L-4 12" />
          </>
        ) : (
          /* invertir — chart up: zigzag ascendente que termina en
             flecha up-right. Trazado en el mismo grid (-12..12) que
             los demás glyphs para que pese igual visualmente. */
          <>
            <Path d="M-11 6 L-3 -2 L2 3 L10 -7" />
            <Path d="M3 -7 L10 -7 L10 0" />
          </>
        )}
      </G>
    </Svg>
  );
});
