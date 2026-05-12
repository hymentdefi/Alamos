import { memo } from "react";
import { View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos de acción del home (Ingresar / Enviar / Convertir / Invertir).
 *
 * Squircle (borderCurve continuous) con tint suave del verde brand y
 * un símbolo (flecha down / up / arrows-swap / chart-up) en stroke
 * c.text. La squircle es el bloque visual; el SVG dentro es transparente
 * y solo aporta el glyph. Más Álamos que un círculo perfecto — la app
 * usa borderCurve continuous en TODAS las esquinas redondeadas.
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
  /** Override del color del stroke (símbolo). Default: c.text del
   *  theme (casi-negro en light, casi-blanco en dark). El verde
   *  brand queda solo en el tint del squircle — el glyph en sí es
   *  neutro para que tenga peso editorial sin gritar marca. */
  stroke?: string;
  /** Override del fill del squircle. Default: tint del verde brand
   *  (14% en light, 20% en dark) — un poco más sólido que el círculo
   *  previo para darle más presencia tactil al botón. */
  fill?: string;
}

/** Tint del squircle cuando no se pasa override — siempre verde brand,
 *  independientemente del color del stroke. El acento brand vive en
 *  el fondo, no en el glyph. */
const tintFor = (mode: "light" | "dark") =>
  mode === "dark" ? "rgba(0,200,5,0.20)" : "rgba(0,200,5,0.14)";

export const ActionIcon = memo(function ActionIcon({
  name,
  size = 56,
  stroke,
  fill,
}: Props) {
  const { mode, c } = useTheme();
  const resolvedStroke = stroke ?? c.text;
  const resolvedFill = fill ?? tintFor(mode);
  // Ratio ~0.32 da un squircle "rounded square" — más cuadrado que
  // un icono iOS app (0.22) pero menos que un squircle pleno (0.45).
  // En 51 (size del home) sale ~16, alineado con radius.lg del theme.
  const cornerRadius = Math.round(size * 0.32);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: cornerRadius,
        borderCurve: "continuous",
        backgroundColor: resolvedFill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <G
          transform="translate(32 32)"
          fill="none"
          stroke={resolvedStroke}
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
    </View>
  );
});
