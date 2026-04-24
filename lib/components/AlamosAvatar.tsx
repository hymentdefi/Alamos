import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";

/**
 * Scheme de color para el avatar. Cada uno tiene esencia — referencia
 * a un paisaje/momento argentino.
 */
export interface AvatarScheme {
  id: string;
  name: string;
  bg: string;
  /** Color del triángulo 'verde' (el adelante, accent). */
  accent: string;
  /** Color del triángulo de atrás (contraste). */
  ink: string;
}

export const AVATAR_SCHEMES: AvatarScheme[] = [
  // 1. Bosque — el brand clásico.
  { id: "bosque", name: "Bosque", bg: "#DFF7E1", accent: "#00C805", ink: "#0E0F0C" },
  // 2. Pampa — campo dorado al sol.
  { id: "pampa", name: "Pampa", bg: "#FBF1D8", accent: "#E3B03E", ink: "#7A4E1D" },
  // 3. Cielo — celeste y sol de la bandera.
  { id: "cielo", name: "Cielo", bg: "#E2EEFB", accent: "#74ACDF", ink: "#F6B40E" },
  // 4. Patagonia — turquesa glaciar + gris piedra.
  { id: "patagonia", name: "Patagonia", bg: "#D6EEEA", accent: "#00897B", ink: "#263238" },
  // 5. Andes — hielo y cordillera.
  { id: "andes", name: "Andes", bg: "#E6EDF5", accent: "#A8C5E2", ink: "#1D3557" },
  // 6. Crepúsculo — atardecer violeta.
  { id: "crepusculo", name: "Crepúsculo", bg: "#F4E3F0", accent: "#D6336C", ink: "#5E1B7E" },
  // 7. Ocaso — naranja final del día.
  { id: "ocaso", name: "Ocaso", bg: "#FBE5D4", accent: "#FF6F00", ink: "#8F2B09" },
  // 8. Mate — verde yerba + marrón poro.
  { id: "mate", name: "Mate", bg: "#DFEAE0", accent: "#2E7D32", ink: "#6D4C41" },
  // 9. Noche — negro cielo con verde neón.
  { id: "noche", name: "Noche", bg: "#1A1F25", accent: "#00E676", ink: "#E8EAED" },
  // 10. Coral — rosado cálido.
  { id: "coral", name: "Coral", bg: "#FCE3DC", accent: "#FF5A5F", ink: "#5D2E46" },
  // 11. Grafito — monocromo elegante.
  { id: "grafito", name: "Grafito", bg: "#EDEDEB", accent: "#616161", ink: "#0E0F0C" },
  // 12. Tormenta — gris eléctrico + azul.
  { id: "tormenta", name: "Tormenta", bg: "#DDE3EA", accent: "#455A64", ink: "#1A237E" },
];

const STORAGE_KEY = "profile:avatar_scheme";

interface Props {
  /** Tamaño total del círculo en px. */
  size?: number;
  /** Si la imagen es tap-to-cycle o no. */
  interactive?: boolean;
}

export function AlamosAvatar({ size = 48, interactive = true }: Props) {
  const [idx, setIdx] = useState(0);
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // Cargar preferencia persistida.
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((v) => {
        if (!v) return;
        const i = AVATAR_SCHEMES.findIndex((s) => s.id === v);
        if (i >= 0) setIdx(i);
      })
      .catch(() => {});
  }, []);

  const cycle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = (idx + 1) % AVATAR_SCHEMES.length;
    setIdx(next);
    SecureStore.setItemAsync(STORAGE_KEY, AVATAR_SCHEMES[next].id).catch(
      () => {},
    );
    // Pop animation: scale down + quick rotation para dar sensación
    // de cambio satisfactoria.
    scale.setValue(0.82);
    rotate.setValue(-0.12);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 180,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(rotate, {
        toValue: 0,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const scheme = AVATAR_SCHEMES[idx];
  const rot = rotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-90deg", "90deg"],
  });

  const inner = (
    <Animated.View
      style={[
        s.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: scheme.bg,
          transform: [{ scale }, { rotate: rot }],
        },
      ]}
    >
      <Svg
        width={size * 0.68}
        height={size * 0.68}
        viewBox="0 0 100 100"
      >
        {/* Mismos polygons del brand-isotipo.svg, con colores del scheme. */}
        <Polygon
          points="38,26 16,86 60,86"
          stroke={scheme.accent}
          strokeWidth={7}
          strokeLinejoin="round"
          fill="none"
        />
        <Polygon
          points="56,12 29,86 83,86"
          stroke={scheme.ink}
          strokeWidth={7}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );

  if (!interactive) return inner;

  return (
    <Pressable onPress={cycle} hitSlop={8}>
      {inner}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
