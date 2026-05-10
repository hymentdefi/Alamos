import Svg, {
  Circle,
  Ellipse,
  Line,
  Path,
  Rect,
} from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 44. */
  size?: number;
}

/**
 * Illustration "Bandas de Bollinger" — banda verde tinted con
 * media móvil dotted al medio + candles de precio dentro y un
 * spike naranja al final.
 */
export function BollingerIndicatorIllustration({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Ellipse cx={140} cy={244} rx={80} ry={6} fill="#000" opacity={0.1} />
      <Circle cx={44} cy={68} r={3.6} fill="#5FE850" />
      <Circle cx={244} cy={76} r={3.2} fill="#FFB300" />
      <Circle cx={42} cy={220} r={3} fill="#0E4310" />
      <Path
        d="M44 220 H236"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />

      {/* Banda Bollinger — área cerrada arriba/abajo */}
      <Path
        d="M50 90 Q100 70 150 100 T232 80 L232 180 Q180 200 130 170 T50 190 Z"
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Path
        d="M140 96 Q160 96 180 96 T232 80 L232 180 Q180 200 140 178 Z"
        fill="#018A09"
        opacity={0.85}
      />
      <Path
        d="M52 92 Q100 72 150 102"
        fill="none"
        stroke="#A0F58C"
        strokeWidth={5}
        strokeLinecap="round"
      />

      {/* Línea media dotted */}
      <Path
        d="M50 140 Q100 130 150 140 T232 130"
        fill="none"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeDasharray="5 5"
      />

      {/* Candles dentro de la banda */}
      <Line
        x1={86}
        y1={118}
        x2={86}
        y2={156}
        stroke="#0E4310"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Rect x={80} y={128} width={12} height={20} rx={2} fill="#0E4310" />

      <Line
        x1={120}
        y1={124}
        x2={120}
        y2={162}
        stroke="#0E4310"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Rect x={114} y={132} width={12} height={22} rx={2} fill="#0E4310" />

      <Line
        x1={166}
        y1={114}
        x2={166}
        y2={160}
        stroke="#0E4310"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Rect x={160} y={120} width={12} height={32} rx={2} fill="#0E4310" />

      {/* Spike naranja al final tocando la banda superior */}
      <Line
        x1={206}
        y1={86}
        x2={206}
        y2={150}
        stroke="#0E4310"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Rect
        x={200}
        y={92}
        width={12}
        height={46}
        rx={2}
        fill="#FFB300"
        stroke="#0E4310"
        strokeWidth={2}
      />
    </Svg>
  );
}
