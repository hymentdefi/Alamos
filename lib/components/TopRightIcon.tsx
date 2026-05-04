import { memo } from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { useTheme } from "../theme";

/**
 * Iconos del top-right del Home: Sorpresa (regalo) y Notificación
 * (campanita). Misma família visual que ActionIcon (set tint-S):
 * círculo lleno con tint del verde brand (10% light / 14% dark) y
 * el dibujo en stroke verde brand de 4px.
 *
 * El icono YA incluye su propio "fondo" — la pill verde tint —
 * así que el contenedor Pressable que lo envuelve no debería
 * agregar otro background.
 *
 * Variante 'notificacion-dot': mismo bell con un dot rojo en la
 * esquina sup-derecha, indicando notificaciones nuevas. El stroke
 * del dot usa c.bg para punchear limpio sobre el button en ambos
 * modos.
 *
 * Sources del brand pack en assets/icons/topright/{light,dark}/.
 */

export type TopRightIconName =
  | "sorpresa"
  | "notificacion"
  | "notificacion-dot";

interface Props {
  name: TopRightIconName;
  size?: number;
}

const tintFor = (mode: "light" | "dark") =>
  mode === "dark" ? "rgba(0,200,5,0.14)" : "rgba(0,200,5,0.10)";

export const TopRightIcon = memo(function TopRightIcon({
  name,
  size = 40,
}: Props) {
  const { c, mode } = useTheme();
  const isBell = name === "notificacion" || name === "notificacion-dot";

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={32} fill={tintFor(mode)} />
      <G
        transform="translate(32 32)"
        fill="none"
        stroke={c.brand}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isBell ? (
          <>
            <Path d="M-9 6 C-9 -2 -6 -10 0 -10 C6 -10 9 -2 9 6 Z" />
            <Path d="M-3 10 C-3 12 -1.5 13 0 13 C1.5 13 3 12 3 10" />
          </>
        ) : (
          <>
            <Rect x={-11} y={-3} width={22} height={14} />
            <Rect x={-13} y={-9} width={26} height={6} />
            <Path d="M0 -9 L0 11" />
            <Path d="M0 -9 C-6 -15 -10 -10 -6 -9 Z" />
            <Path d="M0 -9 C6 -15 10 -10 6 -9 Z" />
          </>
        )}
      </G>
      {name === "notificacion-dot" ? (
        <Circle cx={44} cy={20} r={5} fill="#FF5C5C" stroke={c.bg} strokeWidth={2} />
      ) : null}
    </Svg>
  );
});
