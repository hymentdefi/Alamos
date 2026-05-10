import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 220. */
  size?: number;
}

/**
 * Ilustración "Indicator Chart" — un mini chart con líneas de
 * indicadores técnicos (línea de precio + media móvil punteada +
 * bandas de Bollinger sutiles). Mismo lenguaje visual que la
 * AlertBellIllustration: paleta brand, ink-green stroke, badano
 * dorado en una banda, sparkles flotantes.
 *
 * Pensada para el empty state de la tab "Indicadores" en /asset-alerts.
 */
export function IndicatorChartIllustration({ size = 220 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      {/* Sombra del piso */}
      <Ellipse cx={150} cy={266} rx={92} ry={6} fill="#000" opacity={0.1} />

      {/* Frame del chart — squircle estilo Robinhood card. */}
      <G transform="rotate(-3 150 150)">
        <Rect
          x={48}
          y={70}
          width={204}
          height={150}
          rx={20}
          ry={20}
          fill="#FFFFFF"
          stroke="#0E4310"
          strokeWidth={2.6}
        />

        {/* Banda dorada — eyebrow superior tipo "indicator" */}
        <Rect
          x={64}
          y={84}
          width={64}
          height={10}
          rx={5}
          ry={5}
          fill="#FFB300"
          stroke="#0E4310"
          strokeWidth={1.8}
        />

        {/* Bandas de Bollinger — sutil, área sombreada */}
        <Path
          d="M 60 165 C 100 145, 145 155, 195 130 C 215 120, 235 130, 248 122
             L 248 168 C 235 178, 215 168, 195 188 C 145 215, 100 200, 60 220 Z"
          fill="#00C805"
          opacity={0.10}
        />

        {/* Línea media móvil — dotted */}
        <Path
          d="M 60 175 C 100 162, 145 168, 195 158 C 215 153, 235 156, 248 150"
          fill="none"
          stroke="#0E4310"
          strokeWidth={1.8}
          strokeDasharray="4 4"
          opacity={0.55}
        />

        {/* Línea de precio principal — verde brand */}
        <Path
          d="M 60 195 L 80 175 L 96 188 L 116 158 L 138 172 L 158 138 L 184 152 L 208 122 L 228 138 L 248 110"
          fill="none"
          stroke="#00C805"
          strokeWidth={3.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Stroke del piso — linea baseline punteada */}
        <Path
          d="M 60 210 L 248 210"
          fill="none"
          stroke="#0E4310"
          strokeWidth={1.4}
          strokeDasharray="2 4"
          opacity={0.4}
        />

        {/* Dot del último valor — circulo blanco con borde green */}
        <Circle
          cx={248}
          cy={110}
          r={7}
          fill="#FFFFFF"
          stroke="#018A09"
          strokeWidth={2.4}
        />
        <Circle cx={248} cy={110} r={3.2} fill="#00C805" />
      </G>

      {/* Sparkles alrededor — flotando, mismo lenguaje que la
          campana. Reflejan que algo está "vivo". */}
      <G fill="#00C805" opacity={0.85}>
        <Circle cx={70} cy={50} r={3.2} />
        <Circle cx={250} cy={68} r={2.4} />
        <Circle cx={42} cy={150} r={2.6} />
        <Circle cx={262} cy={186} r={3} />
      </G>
      <G fill="#FFB300" opacity={0.85}>
        <Circle cx={86} cy={250} r={3} />
        <Circle cx={232} cy={244} r={2.4} />
      </G>
    </Svg>
  );
}
