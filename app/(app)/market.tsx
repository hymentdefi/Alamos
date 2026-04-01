import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";
export default function MarketScreen() {
  return <View style={s.c}><Text style={s.t}>Mercado - Proximamente</Text></View>;
}
const s = StyleSheet.create({ c: { flex: 1, backgroundColor: colors.surface[0], justifyContent: "center", alignItems: "center" }, t: { color: colors.text.secondary, fontSize: 18 } });