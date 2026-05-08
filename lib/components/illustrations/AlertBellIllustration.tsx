import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 220. */
  size?: number;
}

/**
 * Ilustración "Bell" — campana de alertas Alamos-styled, basada
 * en el SVG B7 del brand pack. Tilt -6° + bandeo lateral con dots,
 * badano dorado abajo, sparkles flotantes alrededor.
 *
 * Paleta: brand (#00C805), brand dark (#018A09), ink-green
 * (#0E4310 stroke), gold (#FFB300) y blanco. Pensada para usarse
 * en el empty state de la pantalla de Custom alerts.
 */
export function AlertBellIllustration({ size = 220 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 300 300">
      {/* Sombra del piso */}
      <Ellipse cx={150} cy={266} rx={74} ry={6} fill="#000" opacity={0.1} />
      <G transform="rotate(-6 150 150)">
        {/* Mango: cap circular con highlight */}
        <Ellipse
          cx={150}
          cy={48}
          rx={14}
          ry={10}
          fill="#00C805"
          stroke="#0E4310"
          strokeWidth={2.4}
        />
        <Ellipse
          cx={150}
          cy={48}
          rx={6}
          ry={4}
          fill="#FFFFFF"
          stroke="#0E4310"
          strokeWidth={1.4}
        />
        {/* Cuello de la campana */}
        <Path
          d="M 138 62 L 162 62 L 166 82 L 134 82 Z"
          fill="#00C805"
          stroke="#0E4310"
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <Path
          d="M 138 62 L 150 62 L 152 82 L 134 82 Z"
          fill="#5FE850"
        />
        {/* Cuerpo de la campana — outline + sombra a la derecha */}
        <Path
          d="M 150 80 C 108 80 80 118 78 174 L 74 214 Q 72 230 90 230 L 210 230 Q 228 230 226 214 L 222 174 C 220 118 192 80 150 80 Z"
          fill="#00C805"
          stroke="#0E4310"
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
        <Path
          d="M 200 86 C 222 110 226 156 226 200 L 226 218 Q 224 230 210 230 L 158 230 C 184 200 198 142 200 86 Z"
          fill="#018A09"
          opacity={0.85}
        />
        {/* Banda dorada con dots */}
        <Path
          d="M 80 162 Q 80 168 90 170 Q 150 178 210 170 Q 220 168 220 162 L 220 152 Q 220 158 210 160 Q 150 168 90 160 Q 80 158 80 152 Z"
          fill="#FFB300"
          stroke="#0E4310"
          strokeWidth={2}
        />
        <Circle cx={100} cy={164} r={1.6} fill="#0E4310" />
        <Circle cx={130} cy={166} r={1.6} fill="#0E4310" />
        <Circle cx={160} cy={166} r={1.6} fill="#0E4310" />
        <Circle cx={190} cy={164} r={1.6} fill="#0E4310" />
        {/* Borde inferior de la campana */}
        <Path
          d="M 76 220 Q 74 230 90 230 L 210 230 Q 226 230 224 220 L 218 222 Q 218 226 210 226 L 90 226 Q 82 226 82 222 Z"
          fill="#0E4310"
        />
        {/* Badano dorado */}
        <Circle
          cx={150}
          cy={244}
          r={13}
          fill="#FFB300"
          stroke="#0E4310"
          strokeWidth={2.2}
        />
      </G>
      {/* Sparkles decorativos */}
      <Circle cx={50} cy={90} r={3} fill="#00C805" />
      <Circle cx={250} cy={110} r={2.4} fill="#FFB300" />
      <Path
        d="M 256 196 l 3 -8 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 z"
        fill="#0E4310"
        opacity={0.85}
      />
    </Svg>
  );
}
