import Svg, {
  Circle,
  Ellipse,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 44 — para el row del
   *  picker del IndicatorSheet. */
  size?: number;
}

/**
 * Illustration "RSI" — chart con bandas de sobrecompra (70) y
 * sobreventa (30) tinted, líneas de threshold dotted, curva del
 * RSI cruzando, dot dorado al final.
 */
export function RSIIndicatorIllustration({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Ellipse cx={140} cy={244} rx={84} ry={6} fill="#000" opacity={0.1} />
      <Circle cx={42} cy={70} r={3.6} fill="#5FE850" />
      <Circle cx={244} cy={80} r={3.2} fill="#FFB300" />
      <Circle cx={46} cy={222} r={3} fill="#0E4310" />
      <Rect x={40} y={76} width={200} height={26} fill="#FFB300" opacity={0.3} />
      <Rect x={40} y={198} width={200} height={26} fill="#5FE850" opacity={0.3} />
      <Path
        d="M40 102 H240"
        stroke="#0E4310"
        strokeWidth={2.2}
        strokeDasharray="5 4"
        strokeLinecap="round"
      />
      <Path
        d="M40 198 H240"
        stroke="#0E4310"
        strokeWidth={2.2}
        strokeDasharray="5 4"
        strokeLinecap="round"
      />
      <Path
        d="M40 230 H240"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Path
        d="M48 210 Q70 220 90 196 T130 130 T180 160 T232 90"
        fill="none"
        stroke="#5FE850"
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M48 210 Q70 220 90 196 T130 130 T180 160 T232 90"
        fill="none"
        stroke="#0E4310"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Circle
        cx={232}
        cy={90}
        r={11}
        fill="#FFB300"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
      <SvgText x={48} y={96} fontSize={10} fontWeight={700} fill="#0E4310">
        70
      </SvgText>
      <SvgText x={48} y={216} fontSize={10} fontWeight={700} fill="#0E4310">
        30
      </SvgText>
    </Svg>
  );
}
