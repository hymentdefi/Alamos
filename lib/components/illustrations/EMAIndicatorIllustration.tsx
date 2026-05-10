import Svg, { Circle, Ellipse, Path } from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 44 — para el row del
   *  picker del IndicatorSheet. */
  size?: number;
}

/**
 * Illustration "EMA" (Exponential Moving Average) — variante más
 * reactiva de la MA. Misma estructura visual (precio + curva +
 * dot dorado) pero con la curva ajustada a un trazado más
 * pegado al precio (responde más rápido).
 */
export function EMAIndicatorIllustration({ size = 44 }: Props) {
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

      {/* Línea de precio detrás (más opaca) */}
      <Path
        d="M52 174 L74 138 L94 168 L116 116 L138 156 L162 102 L188 144 L212 84 L232 122"
        fill="none"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />

      {/* EMA — más reactiva, curva pegada al precio */}
      <Path
        d="M52 170 Q74 144 96 156 T140 132 T184 116 T232 96"
        fill="none"
        stroke="#5FE850"
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M52 164 Q74 138 96 150 T140 126"
        fill="none"
        stroke="#A0F58C"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Path
        d="M52 170 Q74 144 96 156 T140 132 T184 116 T232 96"
        fill="none"
        stroke="#0E4310"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dot dorado al final */}
      <Circle
        cx={232}
        cy={96}
        r={11}
        fill="#FFB300"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
    </Svg>
  );
}
