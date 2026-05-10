import Svg, { Circle, Ellipse, Path } from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 44 — para el row del
   *  picker del IndicatorSheet. */
  size?: number;
}

/**
 * Illustration "Media Móvil" — línea de precio con su moving
 * average superpuesta + dot dorado al final. Misma paleta que el
 * resto de las illustrations brand (5FE850 / FFB300 / 0E4310 ink).
 */
export function MAIndicatorIllustration({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Ellipse cx={140} cy={244} rx={80} ry={6} fill="#000" opacity={0.1} />
      <Circle cx={42} cy={68} r={3.6} fill="#5FE850" />
      <Circle cx={244} cy={86} r={3.2} fill="#FFB300" />
      <Circle cx={44} cy={220} r={3} fill="#0E4310" />
      <Path
        d="M44 220 H236"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Path
        d="M52 174 L74 138 L94 168 L116 116 L138 156 L162 102 L188 144 L212 84 L232 122"
        fill="none"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />
      <Path
        d="M52 168 Q90 150 120 140 T180 116 T232 96"
        fill="none"
        stroke="#5FE850"
        strokeWidth={14}
        strokeLinecap="round"
      />
      <Path
        d="M52 162 Q90 144 120 134 T180 110"
        fill="none"
        stroke="#A0F58C"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Path
        d="M52 168 Q90 150 120 140 T180 116 T232 96"
        fill="none"
        stroke="#0E4310"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Circle
        cx={232}
        cy={96}
        r={10}
        fill="#FFB300"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
    </Svg>
  );
}
