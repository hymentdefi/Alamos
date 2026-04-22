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
 *
 * Nota: expo-router re-monta los tabBarIcon cada vez que cambia el focused,
 * así que no podemos confiar en useRef para detectar "ya animé antes". En
 * su lugar, animamos SIEMPRE que focused=true (incluyendo el primer mount
 * de la tab activa al abrir la app, lo cual es aceptable como welcome).
 */
export function AnimatedTabIcon({
  outline,
  filled,
  focused,
  color,
  size = 22,
}: Props) {
  const scale = useRef(new Animated.Value(focused ? 1 : 1)).current;

  useEffect(() => {
    if (!focused) return;
    Haptics.selectionAsync().catch(() => {});
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.32,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 220,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
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
