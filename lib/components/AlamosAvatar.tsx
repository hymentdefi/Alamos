import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { fontFamily } from "../theme";

/**
 * Scheme de color para el avatar. Cada uno tiene esencia — referencia
 * a un paisaje/momento argentino. Incluye una pareja de colores para
 * hacer un gradient diagonal + un color de specular highlight arriba
 * a la izquierda, para que se sienta una 'esfera pulida' y no un
 * tint plano genérico.
 */
export interface AvatarScheme {
  id: string;
  name: string;
  /** Color dominante (punto medio del gradient). */
  bg: string;
  /** Color brillante que cae en la esquina superior izq. */
  bgLight: string;
  /** Color profundo que cae en la esquina inferior der. */
  bgDeep: string;
  /** Glow specular que da sensación de luz arriba-izq. */
  glow: string;
  /** Color del triángulo 'verde' (el adelante, accent). */
  accent: string;
  /** Color del triángulo de atrás (contraste). */
  ink: string;
}

export const AVATAR_SCHEMES: AvatarScheme[] = [
  {
    id: "bosque",
    name: "Bosque",
    bg: "#DFF7E1",
    bgLight: "#F3FCF0",
    bgDeep: "#B8E8BA",
    glow: "rgba(255,255,255,0.75)",
    accent: "#00C805",
    ink: "#0E0F0C",
  },
  {
    id: "pampa",
    name: "Pampa",
    bg: "#FBF1D8",
    bgLight: "#FFFBEA",
    bgDeep: "#F1DAA1",
    glow: "rgba(255,255,255,0.82)",
    accent: "#E3B03E",
    ink: "#7A4E1D",
  },
  {
    id: "cielo",
    name: "Cielo",
    bg: "#E2EEFB",
    bgLight: "#F5FAFF",
    bgDeep: "#B8D6F0",
    glow: "rgba(255,255,255,0.85)",
    accent: "#74ACDF",
    ink: "#F6B40E",
  },
  {
    id: "patagonia",
    name: "Patagonia",
    bg: "#D6EEEA",
    bgLight: "#EDF9F7",
    bgDeep: "#A9D6CE",
    glow: "rgba(255,255,255,0.70)",
    accent: "#00897B",
    ink: "#263238",
  },
  {
    id: "andes",
    name: "Andes",
    bg: "#E6EDF5",
    bgLight: "#F7FAFD",
    bgDeep: "#B9CBE0",
    glow: "rgba(255,255,255,0.88)",
    accent: "#A8C5E2",
    ink: "#1D3557",
  },
  {
    id: "crepusculo",
    name: "Crepúsculo",
    bg: "#F4E3F0",
    bgLight: "#FBF1F7",
    bgDeep: "#D8A3C4",
    glow: "rgba(255,230,255,0.70)",
    accent: "#D6336C",
    ink: "#5E1B7E",
  },
  {
    id: "ocaso",
    name: "Ocaso",
    bg: "#FBE5D4",
    bgLight: "#FFF4E8",
    bgDeep: "#F2B278",
    glow: "rgba(255,255,255,0.75)",
    accent: "#FF6F00",
    ink: "#8F2B09",
  },
  {
    id: "mate",
    name: "Mate",
    bg: "#DFEAE0",
    bgLight: "#F1F6F1",
    bgDeep: "#AFC8B2",
    glow: "rgba(255,255,255,0.65)",
    accent: "#2E7D32",
    ink: "#6D4C41",
  },
  {
    id: "noche",
    name: "Noche",
    bg: "#1A1F25",
    bgLight: "#2C333D",
    bgDeep: "#0A0D12",
    glow: "rgba(120,220,150,0.28)",
    accent: "#00E676",
    ink: "#E8EAED",
  },
  {
    id: "coral",
    name: "Coral",
    bg: "#FCE3DC",
    bgLight: "#FFF1ED",
    bgDeep: "#F2B2A3",
    glow: "rgba(255,255,255,0.75)",
    accent: "#FF5A5F",
    ink: "#5D2E46",
  },
  {
    id: "grafito",
    name: "Grafito",
    bg: "#EDEDEB",
    bgLight: "#F9F9F7",
    bgDeep: "#C9C9C6",
    glow: "rgba(255,255,255,0.80)",
    accent: "#616161",
    ink: "#0E0F0C",
  },
  {
    id: "tormenta",
    name: "Tormenta",
    bg: "#DDE3EA",
    bgLight: "#EEF2F7",
    bgDeep: "#A7B2C1",
    glow: "rgba(200,220,255,0.55)",
    accent: "#455A64",
    ink: "#1A237E",
  },
];

const STORAGE_KEY = "profile:avatar_scheme";

interface Props {
  /** Tamaño total del círculo en px. */
  size?: number;
  /** Si la imagen es tap-to-cycle o no. */
  interactive?: boolean;
  /** Inicial del usuario para mostrar al centro. Default "A". */
  initial?: string;
}

export function AlamosAvatar({
  size = 48,
  interactive = true,
  initial = "A",
}: Props) {
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

  // Texto contrast-aware: usa scheme.ink (que está pensado para
  // contrastar con el bg de cada scheme). Para bgs oscuros como noche,
  // ink es claro; para bgs claros, ink es oscuro.
  const bg = scheme.bg;

  const inner = (
    <Animated.View
      style={[
        s.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          transform: [{ scale }, { rotate: rot }],
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fontFamily[800],
          fontSize: size * 0.5,
          lineHeight: size * 0.55,
          letterSpacing: -size * 0.02,
          color: scheme.ink,
        }}
      >
        {(initial || "A").charAt(0).toUpperCase()}
      </Text>
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
