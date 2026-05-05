import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { fontFamily, useTheme } from "../../../lib/theme";

/**
 * Tab 'Portfolio' — placeholder en construcción.
 *
 * El contenido viejo (drilldown completo de tus inversiones, hero
 * con rendimiento del día, métricas, filtros, etc.) se reemplazó
 * por este cartel mientras rediseñamos la sección. La data layer
 * existente sigue funcionando en `lib/data/assets`; cuando volvamos
 * a abrir esta tab, partimos de cero.
 */
export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return (
    <View
      style={[
        s.root,
        {
          backgroundColor: c.bg,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: c.surfaceHover }]}>
        <Feather name="tool" size={42} color={c.brand} />
      </View>
      <Text style={[s.title, { color: c.text }]}>En construcción</Text>
      <Text style={[s.body, { color: c.textMuted }]}>
        Estamos trabajando en una nueva versión de tu portfolio.
        Volvé pronto.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 18,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 38,
    letterSpacing: -1.4,
    textAlign: "center",
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
