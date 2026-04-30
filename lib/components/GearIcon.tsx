import Svg, { Circle, Rect } from "react-native-svg";

interface Props {
  size?: number;
  color: string;
  /** Color del agujero central. Default 'transparent' (deja ver el
   *  bg padre); pasale c.bg si querés un agujero "blanco" sólido. */
  holeColor?: string;
}

/**
 * Gear icon construido con primitivas — body circular + 8 dientes
 * rectangulares rotados a 45° + agujero central. Más robusto que un
 * Path con `fillRule="evenodd"`, que algunos renderers de RN-svg
 * ignoraban dejando el centro relleno (eso era el "gear bugueado").
 *
 * viewBox 24×24, mismo grid que el set core del brand-kit.
 */
export function GearIcon({ size = 18, color, holeColor }: Props) {
  const cx = 12;
  const cy = 12;
  const teethAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Body — círculo principal del gear. */}
      <Circle cx={cx} cy={cy} r={6.5} fill={color} />
      {/* 8 dientes — cada uno es un rect chiquito rotado alrededor
          del centro. */}
      {teethAngles.map((angle) => (
        <Rect
          key={angle}
          x={11}
          y={1.6}
          width={2}
          height={4.4}
          rx={0.5}
          fill={color}
          origin={`${cx}, ${cy}`}
          rotation={angle}
        />
      ))}
      {/* Agujero central — Circle del holeColor. Si holeColor es
          transparent, RN-svg deja ver el bg del padre. */}
      <Circle
        cx={cx}
        cy={cy}
        r={2.7}
        fill={holeColor ?? "transparent"}
      />
    </Svg>
  );
}
