import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Ellipse, G, Text as SvgText } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

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
 * top va en verde vivid (#00C805) con stroke ink — pop frontal.
 *
 * Animación de "salto":
 *   - La pila ($) hace un translateY hacia arriba con curva de
 *     gravedad (out cuadratic para subir, in cuadratic para caer)
 *     + un re-bote chico antes de settle.
 *   - La sombra del piso queda anclada en su Y, pero su scaleX
 *     varía inversamente con la altura del símbolo: cuanto más
 *     lejos está la pila del piso, más chica/transparente la
 *     sombra. Cuando la pila impacta (overshoot positivo en Y),
 *     la sombra se agranda. Da un feel "hay luz desde arriba".
 *
 * Implementación: dos SVGs apilados en absolute, cada uno
 * envuelto en Animated.View con su propio transform (translateY
 * para la pila, scaleX + opacity para la sombra). Esta separación
 * a nivel View evita los problemas de useAnimatedProps en
 * react-native-svg, que no propaga animaciones de transform/x/y
 * en <G> de manera consistente entre versiones.
 */
export function AlamosBalanceIllustration({ size = 220, play = false }: Props) {
  // Capas de profundidad — clavadas al SVG fuente.
  const layers = Array.from({ length: 18 }, (_, i) => ({
    x: 128 - i,
    y: 159.2 + i * 0.6,
  }));

  // jumpY = displacement vertical en pixels de pantalla (no en
  // unidades del viewBox — Animated.View transform usa px).
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
        // Salto principal hacia arriba (out cuadratic — siente
        // la fuerza inicial del salto).
        withTiming(-26, {
          duration: 220,
          easing: Easing.out(Easing.quad),
        }),
        // Caída con gravedad (in cuadratic) y overshoot leve
        // hacia abajo simulando el impacto.
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

  // La pila se traslada con jumpY en px de pantalla.
  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: jumpY.value }],
  }));

  // La sombra se mantiene anchored. Su scaleX y opacity varían
  // inversamente con la altura: jumpY=-26 (pila volando) →
  // scaleX≈0.71 + opacity≈0.07 (chica + transparente). jumpY=+8
  // (impacto) → scaleX≈1.09 + opacity≈0.16 (grande + más oscura).
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + jumpY.value * 0.011 }],
    opacity: 0.14 + jumpY.value * 0.0024,
  }));

  return (
    <View style={{ width: size, height: size }}>
      {/* Layer 1: sombra. Ellipse statica adentro de un SVG
          full-size para preservar la posición original (cy=205
          en viewBox 220). El Animated.View transforma scaleX +
          opacity. */}
      <Animated.View style={[StyleSheet.absoluteFill, shadowStyle]}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 220 220"
          preserveAspectRatio="xMidYMid meet"
        >
          <Ellipse
            cx={120}
            cy={205}
            rx={55}
            ry={6}
            fill="#0E0F0C"
          />
        </Svg>
      </Animated.View>

      {/* Layer 2: la pila $. Misma viewBox 220×220, posicionada
          en absoluteFill. El Animated.View transforma translateY. */}
      <Animated.View style={[StyleSheet.absoluteFill, stackStyle]}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 220 220"
          preserveAspectRatio="xMidYMid meet"
        >
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
              fill="#00C805"
              stroke="#0E0F0C"
              strokeWidth={2.5}
              paintOrder="stroke"
            >
              $
            </SvgText>
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
