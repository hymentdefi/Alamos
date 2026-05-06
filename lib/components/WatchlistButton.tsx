import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Tap } from "./Tap";
import { useWatchlist } from "../watchlist/context";
import { useAssetColorOptional } from "../asset-color/context";
import { useTheme } from "../theme";
import { FavStar } from "./FavStar";

interface Props {
  ticker: string;
  size?: number;
}

/**
 * Botón de watchlist en el header del detalle de activo.
 *
 * Estados:
 *   - NO watched: círculo outline con "+"
 *   - WATCHED:    estrella llena (mismo look que FavStar de la tab
 *                 Mercado — verde brand con fill al 18%)
 *
 * Animación al activar (false → true), en 4 fases encadenadas:
 *   1. Pop up scale 1 → 1.18 (120ms) + crossfade "+" → "✓"
 *   2. Settle scale 1.18 → 1 (160ms)
 *   3. Hold breve (120ms) — el ojo registra el "✓"
 *   4. Morph "✓" + círculo → estrella llena (200ms): el border y el
 *      check fadean a 0, la estrella aparece desde scale 0.6 → 1.18
 *      → 1 con bounce
 *
 * Animación al desactivar (true → false), en 1 fase rápida:
 *   - La estrella sale con scale-down + el "+" en círculo aparece
 *     con un mini bounce. Sin pasar por el check.
 *
 * Color: usa el estado cromático del activo en el modo "outline"
 * (verde/naranja según performance del rango). Cuando está watched,
 * la estrella usa brand.green canónico — coincide 1:1 con la estrella
 * de favoritos del Mercado.
 */
export function WatchlistButton({ ticker, size = 30 }: Props) {
  const { c } = useTheme();
  const { isWatched, toggle } = useWatchlist();
  const chromatic = useAssetColorOptional();
  const watched = isWatched(ticker);
  const tint = chromatic ? chromatic.color : c.text;

  // Initial values setean el estado correcto sin animar — necesario
  // para que volver al detalle (con el activo ya en watchlist) no
  // dispare la animación desde +".
  const plusOpacity = useRef(new Animated.Value(watched ? 0 : 1)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const starOpacity = useRef(new Animated.Value(watched ? 1 : 0)).current;
  const borderOpacity = useRef(new Animated.Value(watched ? 0 : 1)).current;
  const starScale = useRef(new Animated.Value(1)).current;
  const containerScale = useRef(new Animated.Value(1)).current;

  const prevRef = useRef(watched);
  useEffect(() => {
    if (prevRef.current === watched) return;
    prevRef.current = watched;

    if (watched) {
      // OFF → ON: bounce con check, hold, morph a estrella.
      Animated.sequence([
        Animated.parallel([
          Animated.timing(containerScale, {
            toValue: 1.18,
            duration: 120,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(plusOpacity, {
            toValue: 0,
            duration: 90,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(checkOpacity, {
            toValue: 1,
            duration: 90,
            delay: 40,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(containerScale, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(checkOpacity, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(borderOpacity, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(starOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(starScale, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(starScale, {
              toValue: 1.18,
              duration: 140,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(starScale, {
              toValue: 1,
              duration: 130,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    } else {
      // ON → OFF: estrella sale, vuelve "+" en círculo.
      Animated.parallel([
        Animated.sequence([
          Animated.timing(containerScale, {
            toValue: 1.10,
            duration: 110,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(containerScale, {
            toValue: 1,
            duration: 140,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(starOpacity, {
          toValue: 0,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(borderOpacity, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(plusOpacity, {
          toValue: 1,
          duration: 150,
          delay: 60,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    watched,
    plusOpacity,
    checkOpacity,
    starOpacity,
    borderOpacity,
    starScale,
    containerScale,
  ]);

  const iconSize = Math.round(size * 0.55);
  // La estrella se ve más liviana que el "+", así que la dejamos
  // ligeramente más grande para llenar visualmente el slot del botón.
  const starSize = Math.round(size * 0.95);

  return (
    <Tap
      style={[s.btn, { width: size, height: size }]}
      onPress={() => toggle(ticker)}
      hitSlop={10}
      haptic="none"
      accessibilityLabel={
        watched ? "Sacar de favoritos" : "Agregar a favoritos"
      }
      accessibilityRole="button"
    >
      <Animated.View
        style={[s.fill, { transform: [{ scale: containerScale }] }]}
      >
        {/* Border circle — solo visible en estado outline. */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.circle,
            {
              borderColor: tint,
              opacity: borderOpacity,
            },
          ]}
        />
        {/* "+" — visible solo en estado outline. */}
        <Animated.View
          pointerEvents="none"
          style={[s.iconLayer, { opacity: plusOpacity }]}
        >
          <Feather name="plus" size={iconSize} color={tint} />
        </Animated.View>
        {/* "✓" — intermediate fase de la animación de activación. */}
        <Animated.View
          pointerEvents="none"
          style={[s.iconLayer, { opacity: checkOpacity }]}
        >
          <Feather name="check" size={iconSize} color={tint} />
        </Animated.View>
        {/* Estrella llena — final state, mismo look que FavStar de
            la tab Mercado. */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.iconLayer,
            {
              opacity: starOpacity,
              transform: [{ scale: starScale }],
            },
          ]}
        >
          <FavStar filled size={starSize} />
        </Animated.View>
      </Animated.View>
    </Tap>
  );
}

const s = StyleSheet.create({
  btn: {
    alignItems: "center",
    justifyContent: "center",
  },
  fill: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    ...StyleSheet.absoluteFillObject,
    borderCurve: "continuous",
    borderRadius: 999,
    borderWidth: 1.2,
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
