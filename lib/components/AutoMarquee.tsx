import { useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

interface Props {
  /** Niños del marquee — se renderizan dos veces inline para que el
   *  loop sea visualmente continuo (sin "snap" al volver al inicio). */
  children: ReactNode;
  /** Velocidad en px/segundo. Default 35 (lento, lectura cómoda). */
  speed?: number;
  /** Style del wrapper. */
  style?: StyleProp<ViewStyle>;
  /** Style del contenedor de cada copia del contenido. Útil para
   *  agregar gap horizontal entre items. */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Marquee horizontal con auto-scroll continuo, smooth y sin tirones.
 *
 * Truco para el infinite loop sin saltos: renderizamos el contenido
 * dos veces seguidas (A B A B A B), animamos translateX de 0 a -W
 * donde W es el ancho de UNA copia, y al llegar reseteamos a 0. Como
 * el offset 0 es visualmente idéntico al -W (ambos muestran "B A B…"),
 * el wrap es invisible.
 *
 * Usa Reanimated para que la animación corra en el UI thread y no se
 * interrumpa con scroll vertical o re-renders del JS thread. Los taps
 * sobre los children siguen funcionando porque solo movemos via
 * transform.
 */
export function AutoMarquee({
  children,
  speed = 35,
  style,
  contentStyle,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w === trackWidth) return;
    setTrackWidth(w);
    cancelAnimation(translateX);
    translateX.value = 0;
    if (w > 0) {
      const duration = (w / speed) * 1000;
      translateX.value = withRepeat(
        withTiming(-w, {
          duration,
          easing: Easing.linear,
        }),
        -1,
        false,
      );
    }
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <Animated.View
        style={[{ flexDirection: "row" }, animStyle]}
        pointerEvents="box-none"
      >
        <View
          onLayout={onTrackLayout}
          style={[{ flexDirection: "row" }, contentStyle]}
        >
          {children}
        </View>
        {/* Segunda copia idéntica para loop infinito sin saltos. */}
        <View
          style={[{ flexDirection: "row" }, contentStyle]}
          pointerEvents="box-none"
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
