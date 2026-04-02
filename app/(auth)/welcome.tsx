import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import Button from "../../lib/components/Button";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      {/* Top bar: X close + Log in */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 44 }} />
        <Pressable onPress={() => router.push("/(auth)/login")}>
          <Text style={s.loginLink}>Iniciar sesión</Text>
        </Pressable>
      </View>

      {/* Center content */}
      <View style={s.center}>
        <Image
          source={require("../../assets/logo-mark.png")}
          style={s.logo}
          resizeMode="contain"
        />
        <Text style={s.title}>Invertí sin comisiones</Text>
        <Text style={s.subtitle}>
          Acciones, CEDEARs y bonos argentinos.{"\n"}Empezá con lo que quieras.
        </Text>
      </View>

      {/* Bottom CTA */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title="Crear cuenta gratis"
          onPress={() => router.push("/(auth)/register")}
        />
        <Text style={s.disclaimer}>
          Todas las inversiones implican riesgo.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface[0],
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  loginLink: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.brand[500],
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 23,
  },
  bottom: {
    paddingHorizontal: 24,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 12,
  },
});
