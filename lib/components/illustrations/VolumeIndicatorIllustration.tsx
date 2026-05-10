import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 44. */
  size?: number;
}

/**
 * Illustration "Volumen" — barras de volumen verdes con un spike
 * naranja en el medio (la anomalía detectada) + flechita arriba
 * señalándolo.
 */
export function VolumeIndicatorIllustration({ size = 44 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280">
      <Ellipse cx={140} cy={244} rx={80} ry={6} fill="#000" opacity={0.1} />
      <Circle cx={42} cy={74} r={3.6} fill="#5FE850" />
      <Circle cx={244} cy={86} r={3.2} fill="#FFB300" />
      <Circle cx={46} cy={218} r={3} fill="#0E4310" />
      <Path
        d="M40 222 H240"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
      />

      {/* 7 bars: 4 greens, 1 orange spike (centro), 2 greens */}
      <Rect
        x={50}
        y={180}
        width={20}
        height={42}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
      <Rect x={60} y={180} width={10} height={42} fill="#018A09" opacity={0.85} />
      <Rect x={50} y={180} width={20} height={5} fill="#A0F58C" />

      <Rect
        x={76}
        y={156}
        width={20}
        height={66}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
      <Rect x={86} y={156} width={10} height={66} fill="#018A09" opacity={0.85} />
      <Rect x={76} y={156} width={20} height={5} fill="#A0F58C" />

      <Rect
        x={102}
        y={170}
        width={20}
        height={52}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
      <Rect x={112} y={170} width={10} height={52} fill="#018A09" opacity={0.85} />
      <Rect x={102} y={170} width={20} height={5} fill="#A0F58C" />

      <Rect
        x={128}
        y={140}
        width={20}
        height={82}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
      <Rect x={138} y={140} width={10} height={82} fill="#018A09" opacity={0.85} />
      <Rect x={128} y={140} width={20} height={5} fill="#A0F58C" />

      <Rect
        x={154}
        y={76}
        width={20}
        height={146}
        fill="#FFB300"
        stroke="#0E4310"
        strokeWidth={2.6}
      />
      <Rect x={164} y={76} width={10} height={146} fill="#C77A00" opacity={0.85} />

      <Rect
        x={180}
        y={120}
        width={20}
        height={102}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
      <Rect x={190} y={120} width={10} height={102} fill="#018A09" opacity={0.85} />
      <Rect x={180} y={120} width={20} height={5} fill="#A0F58C" />

      <Rect
        x={206}
        y={158}
        width={20}
        height={64}
        fill="#5FE850"
        stroke="#0E4310"
        strokeWidth={2.4}
      />
      <Rect x={216} y={158} width={10} height={64} fill="#018A09" opacity={0.85} />
      <Rect x={206} y={158} width={20} height={5} fill="#A0F58C" />

      {/* Flechita arriba apuntando al spike */}
      <Path
        d="M164 56 V70 M158 64 L164 70 L170 64"
        stroke="#0E4310"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
