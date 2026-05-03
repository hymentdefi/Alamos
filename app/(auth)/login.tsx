import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { AlamosLogo } from "../../lib/components/Logo";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const isValid = email.length > 0 && password.length > 0;

  const handleLogin = async () => {
    if (!isValid) return;
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
    } catch (e: any) {
      setError(e.message ?? "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[s.flex, { backgroundColor: c.bg }]}
    >
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <AlamosLogo variant="mark" tone="green" size={26} />
        <View style={{ width: 36 }} />
      </View>

      <View style={s.content}>
        <Text style={[s.title, { color: c.text }]}>Iniciá sesión</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          Ingresá con tu cuenta de Álamos.
        </Text>

        <View style={s.fields}>
          <View
            style={[
              s.field,
              {
                backgroundColor: c.surface,
                borderColor: emailFocused ? c.ink : c.border,
              },
            ]}
          >
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Email</Text>
            <TextInput
              style={[s.input, { color: c.text }]}
              placeholder="tu@email.com"
              placeholderTextColor={c.textFaint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View
            style={[
              s.field,
              {
                backgroundColor: c.surface,
                borderColor: passwordFocused ? c.ink : c.border,
              },
            ]}
          >
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>Contraseña</Text>
            <View style={s.pwRow}>
              <TextInput
                style={[s.input, { color: c.text, flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={c.textFaint}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onSubmitEditing={handleLogin}
                returnKeyType="go"
                autoComplete="current-password"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={12}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={c.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {error ? (
            <Text style={[s.error, { color: c.red }]}>{error}</Text>
          ) : null}

          <Pressable style={s.forgot}>
            <Text style={[s.forgotText, { color: c.textSecondary }]}>
              Olvidé mi contraseña
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleLogin}
          disabled={!isValid || loading}
          style={[
            s.cta,
            {
              backgroundColor: isValid ? c.ink : c.surfaceHover,
              opacity: loading ? 0.8 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={c.bg} />
          ) : (
            <>
              <Text
                style={[
                  s.ctaText,
                  { color: isValid ? c.bg : c.textMuted },
                ]}
              >
                Iniciar sesión
              </Text>
              <Feather
                name="arrow-right"
                size={16}
                color={isValid ? c.bg : c.textMuted}
              />
            </>
          )}
        </Pressable>

        <Pressable
          style={s.register}
          onPress={() => router.replace("/(auth)/register")}
        >
          <Text style={[s.registerText, { color: c.textMuted }]}>
            ¿Primera vez en Álamos?{" "}
            <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
              Crear cuenta
            </Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 16,
    letterSpacing: -0.2,
    marginBottom: 32,
  },
  fields: {
    gap: 12,
  },
  field: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  fieldLabel: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  input: {
    fontFamily: fontFamily[500],
    fontSize: 16,
    letterSpacing: -0.2,
    paddingVertical: 4,
  },
  pwRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  error: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 4,
  },
  forgot: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  forgotText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  bottom: {
    paddingHorizontal: 24,
    gap: 12,
  },
  cta: {
    height: 52,
    borderRadius: radius.btn,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  register: {
    alignItems: "center",
    paddingVertical: 10,
  },
  registerText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
  },
});
