import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 44. */
  size?: number;
}

/**
 * Illustration "MACD" — histograma de barras (verdes con un spike
 * naranja al final) + dos líneas (MACD sólida + señal dotted)
 * cruzándose por arriba.
 */
export function MACDIndicatorIllustration({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Ellipse cx={140} cy={244} rx={80} ry={6} fill="#000" opacity={0.1} />
      <Circle cx={42} cy={70} r={3.6} fill="#5FE850" />
      <Circle cx={244} cy={74} r={3.2} fill="#FFB300" />
      <Circle cx={46} cy={220} r={3} fill="#0E4310" />
      <Path
        d="M44 152 H236"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />

      {/* Bars 1-4: greens crecientes */}
      <Rect
        x={54}
        y={152}
        width={14}
        height={18}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.2}
      />
      <Rect x={61} y={152} width={7} height={18} fill="#018A09" opacity={0.85} />

      <Rect
        x={74}
        y={152}
        width={14}
        height={28}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.2}
      />
      <Rect x={81} y={152} width={7} height={28} fill="#018A09" opacity={0.85} />

      <Rect
        x={94}
        y={152}
        width={14}
        height={20}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.2}
      />
      <Rect x={101} y={152} width={7} height={20} fill="#018A09" opacity={0.85} />

      <Rect
        x={114}
        y={152}
        width={14}
        height={10}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.2}
      />
      <Rect x={121} y={152} width={7} height={10} fill="#018A09" opacity={0.85} />

      {/* Bars 5-8: arriba de la línea cero, crecientes */}
      <Rect
        x={134}
        y={138}
        width={14}
        height={14}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.2}
      />
      <Rect x={141} y={138} width={7} height={14} fill="#018A09" opacity={0.85} />
      <Rect x={134} y={138} width={14} height={4} fill="#A0F58C" />

      <Rect
        x={154}
        y={120}
        width={14}
        height={32}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.2}
      />
      <Rect x={161} y={120} width={7} height={32} fill="#018A09" opacity={0.85} />
      <Rect x={154} y={120} width={14} height={4} fill="#A0F58C" />

      <Rect
        x={174}
        y={100}
        width={14}
        height={52}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.2}
      />
      <Rect x={181} y={100} width={7} height={52} fill="#018A09" opacity={0.85} />
      <Rect x={174} y={100} width={14} height={4} fill="#A0F58C" />

      <Rect
        x={194}
        y={84}
        width={14}
        height={68}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.2}
      />
      <Rect x={201} y={84} width={7} height={68} fill="#018A09" opacity={0.85} />
      <Rect x={194} y={84} width={14} height={4} fill="#A0F58C" />

      {/* Bar 9: spike naranja */}
      <Rect
        x={214}
        y={72}
        width={14}
        height={80}
        fill="#FFB300"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
      <Rect x={221} y={72} width={7} height={80} fill="#C77A00" opacity={0.85} />

      {/* Líneas MACD + señal por arriba */}
      <Path
        d="M50 168 L88 174 L130 156 L172 130 L220 92"
        fill="none"
        stroke="#0E4310"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M50 158 L92 160 L134 162 L176 150 L222 124"
        fill="none"
        stroke="#0E4310"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="5 4"
      />
    </Svg>
  );
}
