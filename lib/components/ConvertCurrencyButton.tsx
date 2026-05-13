import { memo } from "react";
import { StyleSheet, Text } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { fontFamily, radius, useTheme } from "../theme";
import { Tap } from "./Tap";

/**
 * CTA "Convertir entre monedas" — pill outline brand de 56 px en el
 * home, abajo de la lista de divisas. Outline puro (sin tint bg):
 *   - bg: transparent
 *   - border: 1.5px c.brand
 *   - icono + texto: c.brand
 *
 * Sigue la regla "no medio fill" del sistema de jerarquía: solid
 * brand (CTA primario) o outline (importante pero secundario). Esto
 * último.
 */

interface Props {
  onPress: () => void;
}

export const ConvertCurrencyButton = memo(function ConvertCurrencyButton({
  onPress,
}: Props) {
  const { c } = useTheme();

  return (
    <Tap
      onPress={onPress}
      haptic="selection"
      pressScale={0.98}
      rippleContained
      style={[s.btn, { borderColor: c.brand }]}
      accessibilityRole="button"
      accessibilityLabel="Convertir entre monedas"
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <G
          fill="none"
          stroke={c.brand}
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
      <Text style={[s.text, { color: c.brand }]}>
        Convertir entre monedas
      </Text>
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
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  text: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.16,
  },
});
