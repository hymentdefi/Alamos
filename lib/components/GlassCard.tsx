import { type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { radius, useTheme } from "../theme";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Padding interno — default `lg` (16). Se mantiene como número para
   *  permitir tunning en call sites con dimensiones específicas. */
  padding?: number;
  /** Variante "raised" agrega un poco más de surface + shadow más
   *  marcado, para cards que queremos que floten más. */
  raised?: boolean;
}

/**
 * Card con lenguaje "vidrio levemente esmerilado" estilo Revolut.
 * Tres capas combinadas:
 *
 *   1. Surface translúcida — no es `#FFF` puro sino blanco al ~85%
 *      (light) / white-ish al 4% (dark) sobre el bg. Permite que el
 *      gradient backdrop del root se vea por debajo.
 *   2. Border 1px en negro/blanco a 6-10% — visible pero nunca duro.
 *   3. Highlight superior — gradient blanco al 10-12% en el top que
 *      se desvanece a transparente al ~35% de altura, simulando luz
 *      pegando desde arriba. Es lo que da la sensación de "vidrio"
 *      vs placa pintada.
 *
 * Sumado: shadow vertical sutil para elevar la card del bg sin
 * gritar.
 */
export function GlassCard({ children, style, padding = 16, raised }: Props) {
  const { mode } = useTheme();
  const isDark = mode === "dark";

  // Surface — translúcida sobre el bg para que se sienta vidrio.
  const surface = isDark
    ? raised
      ? "rgba(255,255,255,0.06)"
      : "rgba(255,255,255,0.04)"
    : raised
      ? "rgba(255,255,255,0.92)"
      : "rgba(255,255,255,0.78)";

  // Border — más visible en dark (whites a 8-10%) que en light
  // (blacks a 6%).
  const borderColor = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(14,15,12,0.06)";

  // Highlight — luz desde arriba. Light: white más intenso pero más
  // breve. Dark: white más sutil pero llega un poco más abajo para
  // separar la card del bg negro.
  const highlightColors: readonly [string, string] = isDark
    ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0)"]
    : ["rgba(255,255,255,0.85)", "rgba(255,255,255,0)"];

  // Shadow — vertical, blur amplio, opacity baja. raised duplica.
  const shadowOpacity = isDark
    ? raised
      ? 0.32
      : 0.22
    : raised
      ? 0.06
      : 0.035;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: surface,
          borderColor,
          padding,
          shadowOpacity,
          shadowColor: isDark ? "#000" : "#0E0F0C",
        },
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={highlightColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.35 }}
        style={styles.highlight}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 2,
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
  },
});
