import { useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet, Animated,
  type TextInputProps,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";

/* ─── step definitions ─── */
interface Step {
  key: string;
  title: string;
  subtitle: string;
  placeholder: string;
  keyboard: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  secureTextEntry?: boolean;
  validate: (v: string) => boolean;
}

const steps: Step[] = [
  {
    key: "email",
    title: "¿Cuál es tu email?",
    subtitle: "Lo vas a usar para iniciar sesión.",
    placeholder: "tu@email.com",
    keyboard: "email-address",
    autoCapitalize: "none",
    validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  {
    key: "password",
    title: "Elegí una contraseña",
    subtitle: "Mínimo 8 caracteres.",
    placeholder: "Contraseña",
    keyboard: "default",
    secureTextEntry: true,
    validate: (v) => v.length >= 8,
  },
  {
    key: "fullName",
    title: "¿Cómo te llamás?",
    subtitle: "Usá tu nombre como aparece en tu DNI.",
    placeholder: "Nombre completo",
    keyboard: "default",
    validate: (v) => v.trim().split(" ").length >= 2,
  },
  {
    key: "cuilCuit",
    title: "¿Cuál es tu CUIL?",
    subtitle: "Lo necesitamos por regulación de la CNV.",
    placeholder: "20-12345678-9",
    keyboard: "number-pad",
    validate: (v) => v.replace(/\D/g, "").length >= 10,
  },
];

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({
    email: "",
    password: "",
    fullName: "",
    cuilCuit: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const step = steps[currentStep];
  const value = values[step.key];
  const isValid = step.validate(value);
  const isLast = currentStep === steps.length - 1;

  const animateTransition = (cb: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      cb();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
      });
    });
  };

  const goNext = async () => {
    if (!isValid) return;
    setError("");

    if (isLast) {
      setLoading(true);
      try {
        await register({
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          cuilCuit: values.cuilCuit,
        });
      } catch (e: any) {
        setError(e.message ?? "Error al registrarse");
        setLoading(false);
      }
      return;
    }

    animateTransition(() => setCurrentStep((s) => s + 1));
  };

  const goBack = () => {
    if (currentStep === 0) {
      router.back();
      return;
    }
    setError("");
    animateTransition(() => setCurrentStep((s) => s - 1));
  };

  const updateValue = (text: string) => {
    setValues((prev) => ({ ...prev, [step.key]: text }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.flex}
    >
      {/* Header: back + progress */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.backBtn} onPress={goBack}>
          {currentStep === 0 ? (
            <Ionicons name="close" size={24} color={colors.text.primary} />
          ) : (
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          )}
        </Pressable>

        {/* Progress bar */}
        <View style={s.progressBar}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[
                s.progressSegment,
                i <= currentStep && s.progressSegmentActive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        <Text style={s.title}>{step.title}</Text>
        <Text style={s.subtitle}>{step.subtitle}</Text>

        {/* Input */}
        <View style={s.inputWrap}>
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder={step.placeholder}
            placeholderTextColor={colors.text.muted}
            value={value}
            onChangeText={updateValue}
            keyboardType={step.keyboard}
            autoCapitalize={step.autoCapitalize ?? "sentences"}
            secureTextEntry={step.secureTextEntry && !showPassword}
            autoFocus
            onSubmitEditing={goNext}
            returnKeyType={isLast ? "done" : "next"}
          />
          {step.secureTextEntry && (
            <Pressable
              style={s.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.text.muted}
              />
            </Pressable>
          )}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Legal text on first step */}
        {currentStep === 0 && (
          <Text style={s.legal}>
            Al continuar, aceptás los Términos y Condiciones y la Política de Privacidad de Álamos Capital.
          </Text>
        )}
      </Animated.View>

      {/* Continue button */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={goNext}
          disabled={!isValid || loading}
          style={[s.btn, isValid ? s.btnActive : s.btnDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[s.btnText, !isValid && s.btnTextDisabled]}>
              {isLast ? "Crear cuenta" : "Continuar"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface[0] },
  header: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 4,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.surface[200],
  },
  progressSegmentActive: {
    backgroundColor: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.surface[200],
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 17,
    color: colors.text.primary,
    textAlign: "center",
  },
  eyeBtn: {
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
    marginTop: 16,
  },
  legal: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  bottom: {
    paddingHorizontal: 24,
  },
  btn: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    backgroundColor: "#FFFFFF",
  },
  btnDisabled: {
    backgroundColor: colors.surface[200],
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  btnTextDisabled: {
    color: colors.text.muted,
  },
});
