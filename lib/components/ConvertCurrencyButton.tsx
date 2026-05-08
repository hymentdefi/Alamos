import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { fontFamily, radius, useTheme } from "../theme";
import { Tap } from "./Tap";

/**
 * CTA de "Convertir entre monedas" — pill verde de 56 px en el home,
 * abajo de la lista de divisas. Diseño del brand pack:
 *   - bg: tint del brand green (10% en light, 14% en dark)
 *   - icono: dos flechas convertibles + texto, ambos en brand green
 *
 * El verde usado es brand.green (#00C805) — el canónico de la marca.
 * El brand pack usa un verde más claro (#00C805) en los SVGs de
 * referencia, pero la regla del proyecto es no inventar otros verdes.
 */

const BRAND_GREEN = "#00C805";

const tintFor = (mode: "light" | "dark") =>
  mode === "dark" ? "rgba(0,200,5,0.14)" : "rgba(0,200,5,0.10)";

interface Props {
  onPress: () => void;
}

export const ConvertCurrencyButton = memo(function ConvertCurrencyButton({
  onPress,
}: Props) {
  const { mode } = useTheme();

  return (
    <Tap
      onPress={onPress}
      haptic="selection"
      pressScale={0.98}
      rippleContained
      rippleColor="rgba(0,200,5,0.12)"
      style={[s.btn, { backgroundColor: tintFor(mode) }]}
      accessibilityRole="button"
      accessibilityLabel="Convertir entre monedas"
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <G
          fill="none"
          stroke={BRAND_GREEN}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M5 8 L18 8" />
          <Path d="M14 4 L18 8 L14 12" />
          <Path d="M19 16 L6 16" />
          <Path d="M10 20 L6 16 L10 12" />
        </G>
      </Svg>
      <Text style={s.text}>Convertir entre monedas</Text>
    </Tap>
  );
});

const s = StyleSheet.create({
  btn: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radius.lg,
    borderCurve: "continuous",
  },
  text: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.16,
    color: BRAND_GREEN,
  },
});
