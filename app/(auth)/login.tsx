import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try { await login({ email, password }); }
    catch (e: any) { setError(e.message ?? "Error al iniciar sesion"); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.flex}>
      <View style={s.container}>
        <Text style={s.brand}>Alamos</Text>
        <Text style={s.subtitle}>Capital</Text>
        <View style={s.form}>
          <TextInput placeholder="Email" placeholderTextColor={colors.text.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={s.input} />
          <TextInput placeholder="Contrasena" placeholderTextColor={colors.text.muted} value={password} onChangeText={setPassword} secureTextEntry style={s.input} />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable onPress={handleLogin} disabled={loading} style={s.btn}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Iniciar sesion</Text>}
          </Pressable>
        </View>
        <View style={s.row}>
          <Text style={s.muted}>No tenes cuenta? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable><Text style={s.link}>Registrate</Text></Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface[0] },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  brand: { color: colors.brand[500], fontSize: 36, fontWeight: "bold" },
  subtitle: { color: colors.text.muted, fontSize: 16, marginBottom: 48 },
  form: { gap: 16 },
  input: { backgroundColor: colors.surface[100], color: colors.text.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, borderWidth: 1, borderColor: colors.surface[200] },
  error: { color: colors.accent.negative, fontSize: 14 },
  btn: { backgroundColor: colors.brand[500], borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  muted: { color: colors.text.muted },
  link: { color: colors.brand[500], fontWeight: "600" },
});