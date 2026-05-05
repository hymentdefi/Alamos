import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Tap } from "./Tap";
import { useWatchlist } from "../watchlist/context";
import { useAssetColorOptional } from "../asset-color/context";
import { useTheme } from "../theme";

interface Props {
  ticker: string;
  size?: number;
}

/**
 * Botón circular de watchlist para el header del detalle de activo.
 * Estados:
 *   - NO en watchlist: ícono "+" en círculo
 *   - En watchlist:    ícono "✓" en círculo
 *
 * Color: usa el estado cromático del activo (verde/naranja según
 * performance del rango actual). Si no hay AssetColorProvider en el
 * árbol, fallback al color de texto del theme.
 *
 * Animación sutil al cambiar de estado: scale-bounce 1 → 1.18 → 1
 * en ~280ms (la spec lo pide: "animación sutil del cambio de estado
 * del ícono"). NO se anima al primer mount — sólo cuando cruza
 * watched ↔ no-watched.
 */
export function WatchlistButton({ ticker, size = 30 }: Props) {
  const { c } = useTheme();
  const { isWatched, toggle } = useWatchlist();
  const chromatic = useAssetColorOptional();
  const watched = isWatched(ticker);
  const tint = chromatic ? chromatic.color : c.text;

  const scale = useRef(new Animated.Value(1)).current;
  const prevRef = useRef(watched);
  useEffect(() => {
    if (prevRef.current === watched) return;
    prevRef.current = watched;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.18,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [watched, scale]);

  return (
    <Tap
      style={[s.btn, { width: size, height: size, borderColor: tint }]}
      onPress={() => toggle(ticker)}
      hitSlop={10}
      haptic="none"
      accessibilityLabel={
        watched ? "Sacar de favoritos" : "Agregar a favoritos"
      }
      accessibilityRole="button"
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Feather
          name={watched ? "check" : "plus"}
          /* Ratio 0.55 (en vez de 0.5) — el "+" se sentía pesado a
           * 0.5 con borde 1.4. Con 0.55 + borde 1.2 el ícono respira
           * mejor y matchea visualmente al peso del bell de alerts. */
          size={Math.round(size * 0.55)}
          color={tint}
        />
      </Animated.View>
    </Tap>
  );
}

const s = StyleSheet.create({
  btn: {
    borderCurve: "continuous",
    borderRadius: 999,
    /* Borde 1.2 en vez de 1.4 — el feedback del usuario fue que el
     * círculo se veía "tosco" comparado al bell de alertas. Stroke
     * más fino + tamaño 30 (default antes 36) afina la estética. */
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
});
