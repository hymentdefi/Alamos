import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, Modal, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
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
      style={s.flex}
    >
      {/* Header — green X */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={s.closeBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={28} color={colors.brand[500]} />
        </Pressable>
      </View>

      <View style={s.content}>
        {/* Logo mark */}
        <View style={s.logoWrap}>
          <Image
            source={require("../../assets/logo-mark.png")}
            style={s.logo}
            resizeMode="contain"
          />
        </View>

        {/* Inputs */}
        <View style={s.inputWrap}>
          <TextInput
            style={[s.input, emailFocused && s.inputFocused]}
            placeholder="Email"
            placeholderTextColor={colors.text.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />
        </View>

        <View style={s.inputWrap}>
          <TextInput
            style={[s.input, passwordFocused && s.inputFocused]}
            placeholder="Contraseña"
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
          <Pressable
            style={s.inputIconRight}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.text.muted}
            />
          </Pressable>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>

      {/* Bottom buttons */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleLogin}
          disabled={!isValid || loading}
          style={[s.btnPrimary, !isValid && s.btnPrimaryDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[s.btnPrimaryText, !isValid && s.btnPrimaryTextDisabled]}>
              Iniciar sesión
            </Text>
          )}
        </Pressable>

        <Pressable
          style={s.btnSecondary}
          onPress={() => setHelpVisible(true)}
        >
          <Text style={s.btnSecondaryText}>Necesito ayuda</Text>
        </Pressable>
      </View>

      {/* Help bottom sheet */}
      <Modal
        visible={helpVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpVisible(false)}
      >
        <Pressable style={s.overlay} onPress={() => setHelpVisible(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.sheetTitle}>Necesito ayuda</Text>

          <Pressable style={s.sheetItem}>
            <Text style={s.sheetItemText}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
          <Pressable style={s.sheetItem}>
            <Text style={s.sheetItemText}>¿Olvidaste tu email?</Text>
          </Pressable>
          <Pressable style={s.sheetItem}>
            <Text style={s.sheetItemText}>Otra consulta</Text>
          </Pressable>

          <Pressable
            style={s.sheetCancel}
            onPress={() => setHelpVisible(false)}
          >
            <Text style={s.sheetCancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface[0] },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Content */
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  logoWrap: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 48,
  },
  logo: {
    width: 60,
    height: 60,
  },

  /* Inputs */
  inputWrap: {
    position: "relative",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 17,
    color: colors.text.primary,
  },
  inputFocused: {
    borderColor: colors.text.primary,
  },
  inputIconRight: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  error: {
    color: colors.red,
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },

  /* Bottom */
  bottom: {
    paddingHorizontal: 24,
    gap: 12,
  },
  btnPrimary: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryDisabled: {
    backgroundColor: colors.surface[200],
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
  },
  btnPrimaryTextDisabled: {
    color: colors.text.muted,
  },
  btnSecondary: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Help sheet */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: colors.surface[100],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 24,
  },
  sheetItem: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetItemText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: "500",
  },
  sheetCancel: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  sheetCancelText: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text.primary,
  },
});
