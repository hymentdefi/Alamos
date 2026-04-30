import Svg, { Path } from "react-native-svg";

interface Props {
  size?: number;
  color: string;
}

/**
 * Gear icon filled — más "chunky" y editorial que el `settings` line
 * del set core. Pensado para el spot del timeline donde el icon abre
 * los ajustes del chart: relleno sólido, geometría regular, sin
 * outline.
 *
 * 8 dientes equiespaciados + círculo central que cuela el bg como
 * "agujero" (clip-rule via fillRule="evenodd").
 */
export function GearIcon({ size = 18, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M11 1.5h2c.41 0 .77.31.83.72l.31 2.07c.65.2 1.27.49 1.83.86l1.93-.78c.39-.16.83-.01 1.04.36l1 1.74c.21.36.13.82-.19 1.09l-1.6 1.34c.06.32.09.65.09 1s-.03.68-.09 1l1.6 1.34c.32.27.4.73.19 1.09l-1 1.74c-.21.37-.65.52-1.04.36l-1.93-.78c-.56.37-1.18.66-1.83.86l-.31 2.07c-.06.41-.42.72-.83.72h-2c-.41 0-.77-.31-.83-.72l-.31-2.07c-.65-.2-1.27-.49-1.83-.86l-1.93.78c-.39.16-.83.01-1.04-.36l-1-1.74c-.21-.36-.13-.82.19-1.09l1.6-1.34A6.5 6.5 0 0 1 5.5 12c0-.35.03-.68.09-1l-1.6-1.34c-.32-.27-.4-.73-.19-1.09l1-1.74c.21-.37.65-.52 1.04-.36l1.93.78c.56-.37 1.18-.66 1.83-.86l.31-2.07c.06-.41.42-.72.83-.72ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
        fill={color}
        fillRule="evenodd"
      />
    </Svg>
  );
}
