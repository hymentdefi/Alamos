import { memo } from "react";
import Svg, { Circle, Path } from "react-native-svg";

interface Props {
  size?: number;
  color: string;
  /** Stroke width — default 2.8 da un look bold sin ser pesado. */
  strokeWidth?: number;
}

/**
 * Lupa custom — inline SVG con stroke configurable. La usamos en el
 * input del search del Mercado porque los icons de @expo/vector-icons
 * (Feather/Ionicons/MaterialCommunityIcons) tienen stroke fijo y se
 * sienten finitos al lado de un input medianamente grande. Acá
 * controlamos el grosor exactamente.
 */
export const MagnifyIcon = memo(function MagnifyIcon({
  size = 20,
  color,
  strokeWidth = 2.8,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={11}
        cy={11}
        r={7}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M16 16 L21 21"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
});
