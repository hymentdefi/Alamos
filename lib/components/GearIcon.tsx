import Svg, { Circle, Path } from "react-native-svg";

interface Props {
  size?: number;
  color: string;
  /** Color del agujero central — debe matchear el bg sobre el que va,
   *  default 'transparent' para que el bg padre se vea naturalmente. */
  holeColor?: string;
}

/**
 * Gear icon filled, sólido. Pensado para spots donde el icon es
 * accent (verde brand) sobre el bg blanco del home.
 *
 * Implementación: el body del engranaje es un Path filled, y encima
 * un Circle con `holeColor` simula el agujero central. Más robusto
 * cross-platform que confiar en `fillRule="evenodd"` (algunos
 * renderers de RN-svg lo ignoran, dejando el agujero relleno).
 */
export function GearIcon({ size = 18, color, holeColor }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Body con dientes — gear standard, 8 dientes equiespaciados. */}
      <Path
        d="M11 1.5h2c.41 0 .77.31.83.72l.31 2.07c.65.2 1.27.49 1.83.86l1.93-.78c.39-.16.83-.01 1.04.36l1 1.74c.21.36.13.82-.19 1.09l-1.6 1.34c.06.32.09.65.09 1s-.03.68-.09 1l1.6 1.34c.32.27.4.73.19 1.09l-1 1.74c-.21.37-.65.52-1.04.36l-1.93-.78c-.56.37-1.18.66-1.83.86l-.31 2.07c-.06.41-.42.72-.83.72h-2c-.41 0-.77-.31-.83-.72l-.31-2.07c-.65-.2-1.27-.49-1.83-.86l-1.93.78c-.39.16-.83.01-1.04-.36l-1-1.74c-.21-.36-.13-.82.19-1.09l1.6-1.34A6.5 6.5 0 0 1 5.5 12c0-.35.03-.68.09-1l-1.6-1.34c-.32-.27-.4-.73-.19-1.09l1-1.74c.21-.37.65-.52 1.04-.36l1.93.78c.56-.37 1.18-.66 1.83-.86l.31-2.07c.06-.41.42-.72.83-.72Z"
        fill={color}
      />
      {/* Agujero central — Circle del color del bg para "agujerear"
          el body. Si holeColor='transparent' (default) el bg padre
          se ve a través. */}
      <Circle
        cx="12"
        cy="12"
        r="3.4"
        fill={holeColor ?? "transparent"}
      />
    </Svg>
  );
}
