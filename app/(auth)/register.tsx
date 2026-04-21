import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  type TextInputProps,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { AlamosLogo } from "../../lib/components/Logo";

interface Step {
  key: string;
  title: string;
  subtitle: string;
  placeholder: string;
  label: string;
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
    label: "Email",
    placeholder: "tu@email.com",
    keyboard: "email-address",
    autoCapitalize: "none",
    validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  {
    key: "password",
    title: "Elegí una contraseña",
    subtitle: "Mínimo 8 caracteres, con una mayúscula y un número.",
    label: "Contraseña",
    placeholder: "••••••••",
    keyboard: "default",
    secureTextEntry: true,
    validate: (v) => v.length >= 8,
  },
  {
    key: "fullName",
    title: "¿Cómo te llamás?",
    subtitle: "Usá tu nombre como aparece en el DNI.",
    label: "Nombre completo",
    placeholder: "Martín García",
    keyboard: "default",
    autoCapitalize: "words",
    validate: (v) => v.trim().split(" ").length >= 2,
  },
  {
    key: "cuilCuit",
    title: "¿Cuál es tu CUIL?",
    subtitle: "Lo pide la CNV por regulación.",
    label: "CUIL / CUIT",
    placeholder: "20-12345678-9",
    keyboard: "number-pad",
    validate: (v) => v.replace(/\D/g, "").length >= 10,
  },
];

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

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
  const [focused, setFocused] = useState(true);

  const inputRef = useRef<TextInput>(null);
  const fade = useRef(new Animated.Value(1)).current;

  const step = steps[currentStep];
  const value = values[step.key];
  const isValid = step.validate(value);
  const isLast = currentStep === steps.length - 1;

  const animate = (cb: () => void) => {
    Animated.timing(fade, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      cb();
      Animated.timing(fade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => inputRef.current?.focus(), 80);
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
    animate(() => setCurrentStep((s) => s + 1));
  };

  const goBack = () => {
    if (currentStep === 0) {
      router.back();
      return;
    }
    setError("");
    animate(() => setCurrentStep((s) => s - 1));
  };

  const progress = (currentStep + 1) / steps.length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[s.flex, { backgroundColor: c.bg }]}
    >
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.backBtn, { backgroundColor: c.surfaceHover }]}
          onPress={goBack}
          hitSlop={12}
        >
          <Feather
            name={currentStep === 0 ? "x" : "arrow-left"}
            size={18}
            color={c.text}
          />
        </Pressable>
        <AlamosLogo variant="mark" tone="light" size={26} />
        <View style={{ width: 36 }} />
      </View>

      <View style={s.progressWrap}>
        <View style={[s.progressBg, { backgroundColor: c.surfaceHover }]} />
        <View
          style={[
            s.progressFg,
            {
              backgroundColor: c.ink,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>

      <Animated.View style={[s.content, { opacity: fade }]}>
        <Text style={[s.stepCounter, { color: c.textMuted }]}>
          Paso {currentStep + 1} de {steps.length}
        </Text>
        <Text style={[s.title, { color: c.text }]}>{step.title}</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>{step.subtitle}</Text>

        <View
          style={[
            s.field,
            {
              backgroundColor: c.surface,
              borderColor: focused ? c.ink : c.border,
            },
          ]}
        >
          <Text style={[s.fieldLabel, { color: c.textMuted }]}>{step.label}</Text>
          <View style={s.fieldRow}>
            <TextInput
              ref={inputRef}
              style={[s.input, { color: c.text, flex: 1 }]}
              placeholder={step.placeholder}
              placeholderTextColor={c.textFaint}
              value={value}
              onChangeText={(t) => setValues((p) => ({ ...p, [step.key]: t }))}
              keyboardType={step.keyboard}
              autoCapitalize={step.autoCapitalize ?? "sentences"}
              secureTextEntry={step.secureTextEntry && !showPassword}
              autoFocus
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={goNext}
              returnKeyType={isLast ? "done" : "next"}
            />
            {step.secureTextEntry ? (
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
            ) : null}
          </View>
        </View>

        {error ? (
          <Text style={[s.error, { color: c.red }]}>{error}</Text>
        ) : null}

        {currentStep === 0 ? (
          <Text style={[s.legal, { color: c.textMuted }]}>
            Al continuar aceptás los{" "}
            <Text style={[s.legalLink, { color: c.text }]}>Términos</Text> y la{" "}
            <Text style={[s.legalLink, { color: c.text }]}>Política de Privacidad</Text>{" "}
            de Alamos Capital.
          </Text>
        ) : null}
      </Animated.View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={goNext}
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
                {isLast ? "Crear cuenta" : "Continuar"}
              </Text>
              <Feather
                name="arrow-right"
                size={16}
                color={isValid ? c.bg : c.textMuted}
              />
            </>
          )}
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
  progressWrap: {
    marginHorizontal: 24,
    marginTop: 4,
    height: 3,
  },
  progressBg: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  progressFg: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  stepCounter: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    marginBottom: 28,
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
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    fontFamily: fontFamily[500],
    fontSize: 16,
    letterSpacing: -0.2,
    paddingVertical: 4,
  },
  error: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 12,
  },
  legal: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    marginTop: 20,
    letterSpacing: -0.1,
  },
  legalLink: {
    fontFamily: fontFamily[700],
  },
  bottom: {
    paddingHorizontal: 24,
  },
  cta: {
    height: 52,
    borderRadius: radius.pill,
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
});
