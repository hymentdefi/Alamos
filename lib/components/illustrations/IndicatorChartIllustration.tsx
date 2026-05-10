import Svg, {
  Circle,
  Ellipse,
  Line,
  Path,
  Rect,
} from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 184 — mismo size que la
   *  AlertBellIllustration en el empty state del tab "Precio". */
  size?: number;
}

/**
 * Ilustración "Indicator Chart" — cuatro bars techy estilo
 * candle/bar chart con highlights, sparkles flotantes y baseline.
 *
 * Pensada para el empty state del tab "Indicadores" en
 * /asset-alerts. Misma paleta que AlertBellIllustration: brand,
 * brand dark, ink-green stroke, gold y blanco.
 */
export function IndicatorChartIllustration({ size = 184 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      {/* Sombra del piso */}
      <Ellipse cx={140} cy={244} rx={80} ry={6} fill="#000" opacity={0.1} />

      {/* Sparkles flotantes */}
      <Circle cx={42} cy={70} r={3.6} fill="#5FE850" />
      <Circle cx={240} cy={60} r={3.2} fill="#FFB300" />
      <Circle cx={46} cy={220} r={3} fill="#0E4310" />

      {/* Sparkle "+" decorativo */}
      <Path
        d="M232 196 L236 204 M232 204 L236 196 M234 194 V206 M228 200 H240"
        stroke="#0E4310"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Baseline */}
      <Path
        d="M44 222 H236"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />

      {/* Bar 1 — verde, mediana */}
      <Line
        x1={74}
        y1={80}
        x2={74}
        y2={200}
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Rect
        x={60}
        y={118}
        width={28}
        height={64}
        rx={3}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.6}
      />
      <Rect
        x={74}
        y={118}
        width={14}
        height={64}
        fill="#018A09"
        opacity={0.85}
      />
      <Rect x={60} y={118} width={28} height={5} fill="#A0F58C" />

      {/* Bar 2 — verde, alta */}
      <Line
        x1={120}
        y1={58}
        x2={120}
        y2={210}
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Rect
        x={106}
        y={92}
        width={28}
        height={84}
        rx={3}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.6}
      />
      <Rect
        x={120}
        y={92}
        width={14}
        height={84}
        fill="#018A09"
        opacity={0.85}
      />
      <Rect x={106} y={92} width={28} height={5} fill="#A0F58C" />

      {/* Bar 3 — naranja/dorado, la más alta (anomalía / spike) */}
      <Line
        x1={166}
        y1={44}
        x2={166}
        y2={190}
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Rect
        x={152}
        y={74}
        width={28}
        height={86}
        rx={3}
        fill="#FFB300"
        stroke="#0E4310"
        strokeWidth={2.6}
      />
      <Rect
        x={166}
        y={74}
        width={14}
        height={86}
        fill="#C77A00"
        opacity={0.85}
      />

      {/* Bar 4 — verde, baja */}
      <Line
        x1={212}
        y1={92}
        x2={212}
        y2={200}
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Rect
        x={198}
        y={116}
        width={28}
        height={58}
        rx={3}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.6}
      />
      <Rect
        x={212}
        y={116}
        width={14}
        height={58}
        fill="#018A09"
        opacity={0.85}
      />
      <Rect x={198} y={116} width={28} height={5} fill="#A0F58C" />
    </Svg>
  );
}
