import Svg, { Circle, Text as SvgText } from "react-native-svg";

interface Props {
  /** Ticker corto del asset (BTC, ETH, USDT...). */
  ticker: string;
  size?: number;
  /** Color de fondo del círculo (brand color del asset). */
  bg: string;
  /** Color del texto. Default blanco. */
  fg?: string;
  /** Override del texto a mostrar — útil para símbolos como ₮ en USDT. */
  iconText?: string;
}

/**
 * Ícono circular para assets crypto. Sin per-asset SVG paths — solo
 * círculo con texto. Suficiente para identificar y consistente con el
 * sistema de banderas circulares (FlagIcon).
 *
 * Pensado para reemplazarse por logos reales (CoinGecko / nuestro
 * propio set) cuando exista.
 */
export function CryptoIcon({
  ticker,
  size = 40,
  bg,
  fg = "#FFFFFF",
  iconText,
}: Props) {
  const display = iconText ?? ticker;
  // Escala del fontSize según largo del texto: 1 char = grande, 4+ = chico.
  const fontSize =
    display.length === 1
      ? 18
      : display.length === 2
      ? 15
      : display.length === 3
      ? 12
      : 10;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="20" fill={bg} />
      <SvgText
        x="20"
        y={20 + fontSize * 0.36}
        fontSize={fontSize}
        fontWeight="bold"
        fill={fg}
        textAnchor="middle"
      >
        {display}
      </SvgText>
    </Svg>
  );
}
