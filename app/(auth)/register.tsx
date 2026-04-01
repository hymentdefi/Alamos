import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cuilCuit, setCuilCuit] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");
    setLoading(true);
    try { await register({ email, password, fullName, cuilCuit }); }
    catch (e: any) { setError(e.message ?? "Error al registrarse"); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.flex}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Crear cuenta</Text>
        <Text style={s.subtitle}>Inverti en Argentina desde tu celular</Text>
        <View style={s.form}>
          <TextInput placeholder="Nombre completo" placeholderTextColor={colors.text.muted} value={fullName} onChangeText={setFullName} style={s.input} />
          <TextInput placeholder="Email" placeholderTextColor={colors.text.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={s.input} />
          <TextInput placeholder="CUIL / CUIT" placeholderTextColor={colors.text.muted} value={cuilCuit} onChangeText={setCuilCuit} keyboardType="number-pad" style={s.input} />
          <TextInput placeholder="Contrasena" placeholderTextColor={colors.text.muted} value={password} onChangeText={setPassword} secureTextEntry style={s.input} />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable onPress={handleRegister} disabled={loading} style={s.btn}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Crear cuenta</Text>}
          </Pressable>
        </View>
        <View style={s.row}>
          <Text style={s.muted}>Ya tenes cuenta? </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable><Text style={s.link}>Inicia sesion</Text></Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface[0] },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 32 },
  title: { color: colors.text.primary, fontSize: 24, fontWeight: "bold" },
  subtitle: { color: colors.text.muted, fontSize: 16, marginBottom: 40 },
  form: { gap: 16 },
  input: { backgroundColor: colors.surface[100], color: colors.text.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, borderWidth: 1, borderColor: colors.surface[200] },
  error: { color: colors.accent.negative, fontSize: 14 },
  btn: { backgroundColor: colors.brand[500], borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 32, marginBottom: 32 },
  muted: { color: colors.text.muted },
  link: { color: colors.brand[500], fontWeight: "600" },
});