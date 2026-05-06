import { useEffect } from "react";
import Svg, { Ellipse, G, Text as SvgText } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface Props {
  /** Tamaño del cuadrado del SVG. Default 220. */
  size?: number;
  /** Cuando flipa a true, dispara el salto. Reset a 0 cuando
   *  vuelve a false. */
  play?: boolean;
}

/**
 * Ilustración "Balance unificado" — pila 3D de signos "$" basada
 * en assets/balance_unificado/portfolio-distribucion/exports-media-n2/
 * alamos-balance.svg del brand kit.
 *
 * Truco: 19 textos "$" superpuestos con offset progresivo en x/y
 * generan la sensación de profundidad. Las 18 capas inferiores
 * son verde medium con stroke verde oscuro (efecto "edge"). El "$"
 * top va en verde vivid (#00E676) con stroke ink — pop frontal.
 *
 * Animación de "salto":
 *   - La pila ($) hace un translateY hacia arriba con curva de
 *     gravedad (out cuadratic para subir, in cuadratic para caer)
 *     + un re-bote chico antes de settle.
 *   - La sombra del piso queda anclada en su Y, pero su `rx`
 *     varía inversamente con la altura del símbolo: cuanto más
 *     lejos está la pila del piso, más chica/transparente la
 *     sombra. Cuando la pila impacta (overshoot positivo en Y),
 *     la sombra se agranda. Da un feel "hay luz desde arriba".
 */
export function AlamosBalanceIllustration({ size = 220, play = false }: Props) {
  // Capas de profundidad — clavadas al SVG fuente.
  const layers = Array.from({ length: 18 }, (_, i) => ({
    x: 128 - i,
    y: 159.2 + i * 0.6,
  }));

  // jumpY = displacement en unidades del viewBox (0 = piso normal,
  // negativo = pila en el aire, positivo = "compresión" sobre el
  // piso).
  const jumpY = useSharedValue(0);

  useEffect(() => {
    if (!play) {
      jumpY.value = 0;
      return;
    }
    jumpY.value = 0;
    jumpY.value = withDelay(
      220,
      withSequence(
        // Salto principal hacia arriba (out cuadratic — siente la
        // fuerza inicial del salto).
        withTiming(-26, {
          duration: 220,
          easing: Easing.out(Easing.quad),
        }),
        // Caída con gravedad (in cuadratic) y overshoot leve hacia
        // abajo simulando el impacto.
        withTiming(8, {
          duration: 280,
          easing: Easing.in(Easing.quad),
        }),
        // Re-bote chiquito.
        withTiming(-6, {
          duration: 160,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(2, {
          duration: 140,
          easing: Easing.in(Easing.quad),
        }),
        // Settle final.
        withTiming(0, {
          duration: 130,
          easing: Easing.out(Easing.cubic),
        }),
      ),
    );
  }, [play, jumpY]);

  // La pila se traslada con jumpY en unidades del viewBox.
  const stackProps = useAnimatedProps(() => ({
    transform: `translate(0 ${jumpY.value})`,
  }));

  // La sombra: su `rx` varía de ~38 (pila en el aire, jumpY=-26)
  // a ~60 (pila impactando, jumpY=+8). Mapeo lineal:
  //   rx = 55 + jumpY * 0.6
  // Y la opacidad amplifica el contraste — más oscura cuando la
  // pila impacta, más transparente cuando vuela.
  const shadowProps = useAnimatedProps(() => ({
    rx: 55 + jumpY.value * 0.6,
    opacity: 0.14 + jumpY.value * 0.0024,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <AnimatedEllipse
        cx={120}
        cy={205}
        ry={6}
        fill="#0E0F0C"
        animatedProps={shadowProps}
      />
      <AnimatedG animatedProps={stackProps}>
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
      </AnimatedG>
    </Svg>
  );
}
