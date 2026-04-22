import { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface Props {
  /** Nombre del ícono outline (ej: "home-outline"). */
  outline: keyof typeof Ionicons.glyphMap;
  /** Nombre del ícono filled (ej: "home"). */
  filled: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size?: number;
}

/**
 * Ícono de tab con animación "pop" cuando se activa — como Binance.
 * Cambia de outline a filled + bounce + haptic.
 */
export function AnimatedTabIcon({
  outline,
  filled,
  focused,
  color,
  size = 22,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (focused) {
      Haptics.selectionAsync().catch(() => {});
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.28,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 240,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused, scale]);

  return (
    <View style={s.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={focused ? filled : outline}
          size={size}
          color={color}
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: 44,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
