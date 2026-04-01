import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";

export default function PortfolioScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={s.container}>
      <Text style={s.brand}>Alamos Capital</Text>
      <Text style={s.welcome}>Bienvenido, {user?.fullName}</Text>
      <View style={s.card}>
        <Text style={s.label}>Portfolio total</Text>
        <Text style={s.amount}>$ 0.00</Text>
        <Text style={s.pct}>+0.00%</Text>
      </View>
      <Pressable onPress={logout} style={s.logoutBtn}>
        <Text style={s.logoutText}>Cerrar sesion</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0], justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  brand: { color: colors.brand[500], fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  welcome: { color: colors.text.secondary, fontSize: 16, marginBottom: 32 },
  card: { backgroundColor: colors.surface[50], borderRadius: 16, padding: 24, width: "100%", marginBottom: 24 },
  label: { color: colors.text.muted, fontSize: 14, marginBottom: 4 },
  amount: { color: colors.text.primary, fontSize: 36, fontWeight: "bold" },
  pct: { color: colors.accent.positive, fontSize: 14, marginTop: 4 },
  logoutBtn: { backgroundColor: colors.surface[100], borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  logoutText: { color: colors.text.secondary, fontSize: 14 },
});