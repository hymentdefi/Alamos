import Svg, { Ellipse, G, Text as SvgText } from "react-native-svg";

interface Props {
  /** Tamaño del cuadrado del SVG. Default 220. */
  size?: number;
}

/**
 * Ilustración "Balance unificado" — pila 3D de signos "$" basada
 * en assets/balance_unificado/portfolio-distribucion/exports-media-n2/
 * alamos-balance.svg del brand kit.
 *
 * Truco: 19 textos "$" superpuestos con offset progresivo en x/y
 * generan la sensación de profundidad. Los 18 capas inferiores
 * son verde medium con stroke verde oscuro (efecto "edge"). El "$"
 * top va en verde vivid (brand vivid #00E676) con stroke ink — pop
 * frontal.
 *
 * Mismo lenguaje que el ladrillo 3D del Portfolio.
 */
export function AlamosBalanceIllustration({ size = 220 }: Props) {
  // Capas de profundidad — clavadas al SVG fuente.
  const layers = Array.from({ length: 18 }, (_, i) => ({
    x: 128 - i,
    y: 159.2 + i * 0.6,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <Ellipse
        cx={120}
        cy={205}
        rx={55}
        ry={6}
        fill="rgba(14,15,12,0.14)"
      />
      <G
        fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
        fontWeight="900"
        fontSize={180}
        textAnchor="middle"
      >
        {layers.map((l, i) => (
          <SvgText
            key={i}
            x={l.x}
            y={l.y}
            fill="#00B864"
            stroke="#008F4E"
            strokeWidth={0.8}
          >
            $
          </SvgText>
        ))}
        <SvgText
          x={110}
          y={170}
          fill="#00E676"
          stroke="#0E0F0C"
          strokeWidth={2.5}
          paintOrder="stroke"
        >
          $
        </SvgText>
      </G>
    </Svg>
  );
}
