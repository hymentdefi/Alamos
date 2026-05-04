import { memo } from "react";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../theme";

interface Props {
  size?: number;
  /** True = activa (verde brand con tint), false = outline neutral. */
  filled: boolean;
  /** Override del color del stroke en estado outline. Default: c.text. */
  outlineColor?: string;
}

/**
 * Estrella de favoritos — set 'fav-bold' del brand pack.
 *
 * Mismo path d en ambos estados; solo cambian colores:
 *   - outline: stroke en outlineColor (default c.text), sin fill
 *   - filled: stroke verde brand + fill verde brand al 18% opacity
 *
 * Geometría 1:1 con assets/icons/favoritos/{light,dark}/favoritos-*
 * (viewBox 28×28, stroke-width 2.6, round join/cap).
 */
export const FavStar = memo(function FavStar({
  size = 22,
  filled,
  outlineColor,
}: Props) {
  const { c } = useTheme();
  const stroke = filled ? c.brand : (outlineColor ?? c.text);
  const fill = filled ? c.brand : "none";
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path
        d="M14 4 L16.5 10.5 L23.5 11 L18 15.5 L19.7 22.5 L14 18.7 L8.3 22.5 L10 15.5 L4.5 11 L11.5 10.5 Z"
        stroke={stroke}
        strokeWidth={2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={fill}
        fillOpacity={filled ? 0.18 : 0}
      />
    </Svg>
  );
});
