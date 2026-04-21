import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import Button from "../../lib/components/Button";
import { AlamosLogo } from "../../lib/components/Logo";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <AlamosLogo variant="lockup" tone="light" size={26} />
        <Pressable
          style={[s.loginPill, { borderColor: c.border }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={[s.loginText, { color: c.text }]}>Iniciar sesión</Text>
        </Pressable>
      </View>

      <View style={s.center}>
        <View style={[s.eyebrow, { backgroundColor: c.surfaceHover, borderColor: c.border }]}>
          <View style={[s.eyebrowDot, { backgroundColor: c.green }]} />
          <Text style={[s.eyebrowText, { color: c.textSecondary }]}>Lanzamiento 2026</Text>
        </View>

        <Text style={[s.display, { color: c.text }]}>
          Inversiones,{" "}
          <Text style={[s.displayAccent, { backgroundColor: c.green }]}>simples</Text>
          {"\n"}y transparentes.
        </Text>

        <Text style={[s.lede, { color: c.textMuted }]}>
          CEDEARs, bonos soberanos y fondos comunes de inversión. Diseñados para el mercado argentino.
        </Text>
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title="Solicitar acceso"
          onPress={() => router.push("/(auth)/register")}
          right={<Feather name="arrow-right" size={16} color={c.bg} />}
        />
        <Text style={[s.disclaimer, { color: c.textMuted }]}>
          Alamos Capital · Todas las inversiones implican riesgo.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  loginPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  loginText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  center: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 8,
    marginBottom: 24,
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eyebrowText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  display: {
    fontFamily: fontFamily[700],
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -2.2,
    marginBottom: 20,
  },
  displayAccent: {
    fontFamily: fontFamily[700],
    paddingHorizontal: 2,
  },
  lede: {
    fontFamily: fontFamily[500],
    fontSize: 17,
    lineHeight: 25,
    letterSpacing: -0.2,
    maxWidth: 380,
  },
  bottom: {
    paddingHorizontal: 24,
  },
  disclaimer: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    letterSpacing: -0.1,
  },
});
