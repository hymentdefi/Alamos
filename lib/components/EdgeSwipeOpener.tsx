import { useMemo } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

interface Props {
  /** Callback cuando se detecta un swipe hacia la derecha desde el borde. */
  onOpen: () => void;
  /** Ancho del área sensible al borde izquierdo. Default 22. */
  width?: number;
  /** Desplazamiento horizontal mínimo para disparar la apertura. Default 14. */
  threshold?: number;
}

/**
 * Área invisible en el borde izquierdo de la pantalla que detecta un
 * swipe horizontal hacia la derecha y dispara `onOpen`.
 *
 * Pensado para abrir un side menu con gesture, tipo drawer nativo.
 * No bloquea los taps — si el user toca sin deslizar, el tap pasa al
 * contenido de atrás (PanResponder no toma el gesto).
 */
export function EdgeSwipeOpener({
  onOpen,
  width = 22,
  threshold = 14,
}: Props) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          g.dx > threshold && Math.abs(g.dy) < Math.abs(g.dx),
        onPanResponderGrant: () => {
          onOpen();
        },
      }),
    [onOpen, threshold],
  );

  return (
    <View
      style={[s.area, { width }]}
      {...panResponder.panHandlers}
    />
  );
}

const s = StyleSheet.create({
  area: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 50,
  },
});
