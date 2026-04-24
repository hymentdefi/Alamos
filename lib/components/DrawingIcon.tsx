import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../theme";

interface Props {
  path: string;
  focused: boolean;
  color: string;
  size?: number;
  viewBox?: string;
  /** Duración del reveal en ms. */
  duration?: number;
}

/** Color del marcador arriba del icono cuando está activa la tab. */
const MARKER_COLOR = "#5ac43e";

/**
 * Ícono de tab con animación de "dibujo" al activarse:
 *
 *   1. Marker pill verde arriba aparece (fade + scaleX spring)
 *   2. El icono SVG entero se revela de IZQUIERDA A DERECHA con un
 *      overlay que matchea el color del island y se desliza fuera
 *      (translateX native driver — 100% confiable, no depende del
 *      strokeDashoffset de SVG que en algunos setups no re-renderiza).
 *   3. Scale pop sutil del container para que se sienta alive.
 *
 * Todas las animaciones usan native driver, garantizando que corran
 * suave sin importar el estado del JS thread.
 */
export function DrawingIcon({
  path,
  focused,
  color,
  size = 24,
  viewBox = "0 0 24 24",
  duration = 620,
}: Props) {
  const { mode } = useTheme();
  // El overlay que tapa el icono tiene que matchear el color del
  // island para que la revelación se sienta transparente. Estos son
  // los mismos valores que usa (tabs)/_layout.tsx para el island.
  const coverColor =
    mode === "dark" ? "rgba(28, 33, 40, 0.98)" : "rgba(255, 255, 255, 0.98)";

  // Reveal: translateX del overlay. Arranca en 0 (cubriendo todo el
  // icono) y termina en `size` (off-screen a la derecha), revelando
  // el icono left-to-right. Si el tab está focused al montar, arranca
  // cubierto (0) y el useEffect lo anima a revelado; si no, arranca
  // revelado (size) y el icono inactivo se muestra sin animación.
  const reveal = useRef(new Animated.Value(focused ? 0 : size)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const markerScale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const markerOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (!focused) {
      scale.stopAnimation(() => scale.setValue(1));
      reveal.setValue(size);
      Animated.parallel([
        Animated.timing(markerOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(markerScale, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    // Scale pop del icono.
    scale.setValue(0.4);
    const iconSpring = Animated.spring(scale, {
      toValue: 1,
      tension: 120,
      friction: 6,
      useNativeDriver: true,
    });

    // Marker fade + scaleX.
    markerOpacity.setValue(0);
    markerScale.setValue(0);
    const markerAnim = Animated.parallel([
      Animated.timing(markerOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(markerScale, {
        toValue: 1,
        tension: 90,
        friction: 7,
        useNativeDriver: true,
      }),
    ]);

    // Reveal del icono: overlay pasa de translateX:0 (cubriendo) a
    // translateX:size (fuera de la derecha). Easing lineal-ish para
    // que se sienta como un lápiz trazando de izquierda a derecha.
    reveal.setValue(0);
    const revealAnim = Animated.timing(reveal, {
      toValue: size,
      duration,
      easing: Easing.bezier(0.45, 0.05, 0.55, 0.95),
      useNativeDriver: true,
    });

    iconSpring.start();
    markerAnim.start();
    revealAnim.start();

    return () => {
      iconSpring.stop();
      markerAnim.stop();
      revealAnim.stop();
    };
  }, [focused, duration, size, scale, markerScale, markerOpacity, reveal]);

  return (
    <View style={s.wrap}>
      <Animated.View
        style={[
          s.marker,
          {
            backgroundColor: MARKER_COLOR,
            opacity: markerOpacity,
            transform: [{ scaleX: markerScale }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={{ width: size, height: size, overflow: "hidden" }}>
          <Svg width={size} height={size} viewBox={viewBox}>
            <Path
              d={path}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          {/* Overlay que 'borra' el icono de derecha a izquierda —
              arrancando lo cubre entero, al animar se corre a la
              derecha revelándolo left-to-right. */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size,
              height: size,
              backgroundColor: coverColor,
              transform: [{ translateX: reveal }],
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: 52,
    height: 42,
    alignItems: "center",
    // Sin padding top: el marker toca el borde del island.
    paddingTop: 0,
    gap: 7,
  },
  marker: {
    width: 26,
    height: 3.5,
    borderRadius: 2,
  },
});

/* ─── Paths SVG para las tabs ─── */
export const tabPaths = {
  home: "M4 21 V10 L12 3 L20 10 V21 H15 V14 H9 V21 Z",
  markets: "M3 21 V4 M3 21 H21 M7 17 V13 M12 17 V9 M17 17 V11 M21 17 V7",
  news: "M5 4 H18 V20 H5 Z M5 4 V20 A2 2 0 0 1 3 18 V11 H5 M8 8 H15 M8 12 H15 M8 16 H12",
  profile:
    "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 Z M4 21 V20 A6 6 0 0 1 10 14 H14 A6 6 0 0 1 20 20 V21",
  /** Chat bubble with a tail pointing to bottom-left + three dots inside */
  support:
    "M5 4 H19 A2 2 0 0 1 21 6 V15 A2 2 0 0 1 19 17 H12 L7 21 V17 H5 A2 2 0 0 1 3 15 V6 A2 2 0 0 1 5 4 Z M8 10 H9 M12 10 H13 M16 10 H17",
  /** Álamo stylized: tall triangular canopy + small trunk at bottom. */
  alamo: "M12 2 L6 20 L11 20 L11 22 L13 22 L13 20 L18 20 Z",
} as const;
