import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, Modal, StyleSheet,
} from "react-native";
import { Link, useRouter } from "expo-router";
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
        <Pressable style={s.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={colors.brand[500]} />
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
            style={s.input}
            placeholder="Email"
            placeholderTextColor={colors.text.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
          />
        </View>

        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder="Contraseña"
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
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

        {/* Buttons */}
        <View style={s.buttons}>
          <Pressable
            onPress={handleLogin}
            disabled={!isValid || loading}
            style={[s.btnPrimary, !isValid && { opacity: 0.5 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnPrimaryText}>Iniciar sesión</Text>
            )}
          </Pressable>

          <Pressable
            style={s.btnSecondary}
            onPress={() => setHelpVisible(true)}
          >
            <Text style={s.btnSecondaryText}>Necesito ayuda</Text>
          </Pressable>
        </View>
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
    width: 40,
    height: 40,
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
    marginTop: 24,
    marginBottom: 40,
  },
  logo: {
    width: 56,
    height: 56,
  },

  /* Inputs */
  inputWrap: {
    position: "relative",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.surface[200],
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    color: colors.text.primary,
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
    marginTop: 8,
    marginBottom: 8,
  },

  /* Buttons */
  buttons: {
    marginTop: 20,
    gap: 12,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand[700],
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  btnSecondary: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    fontSize: 16,
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
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 24,
  },
  sheetItem: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetItemText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: "500",
  },
  sheetCancel: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
});
