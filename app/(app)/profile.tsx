import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";
export default function ProfileScreen() {
  const { user } = useAuth();
  return <View style={s.c}><Text style={s.name}>{user?.fullName}</Text><Text style={s.sub}>{user?.email}</Text><Text style={s.sub}>KYC: {user?.kycStatus}</Text></View>;
}
const s = StyleSheet.create({ c: { flex: 1, backgroundColor: colors.surface[0], justifyContent: "center", alignItems: "center" }, name: { color: colors.text.primary, fontSize: 18 }, sub: { color: colors.text.muted, fontSize: 14, marginTop: 4 } });