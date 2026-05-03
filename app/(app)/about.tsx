import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import { AlamosLogo } from "../../lib/components/Logo";

const legalLinks: { id: string; label: string; hint: string }[] = [
  { id: "terms", label: "Términos y condiciones", hint: "Uso del servicio" },
  { id: "privacy", label: "Política de privacidad", hint: "Tratamiento de datos" },
  { id: "risk", label: "Advertencia de riesgos", hint: "Inversiones y variaciones" },
  { id: "licenses", label: "Licencias open source", hint: "Librerías de terceros" },
];

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Acerca de</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <AlamosLogo variant="mark" tone="green" size={64} />
          <Text style={[s.heroTitle, { color: c.text }]}>Álamos Capital</Text>
          <Text style={[s.heroSub, { color: c.textMuted }]}>
            Inversiones simples y transparentes para el mercado argentino.
          </Text>
        </View>

        <View
          style={[
            s.factsCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <FactRow label="Razón social" value="Álamos Capital ALyC S.A." />
          <FactRow label="CUIT" value="30-•••••••••-•" />
          <FactRow label="Matrícula CNV" value="N° 000" />
          <FactRow label="Domicilio" value="Av. Corrientes ···, CABA" />
          <FactRow label="Versión de la app" value="1.0.0 (build 1)" last />
        </View>

        <View style={s.linksBlock}>
          <Text style={[s.eyebrow, { color: c.textMuted }]}>Legal</Text>
          <View
            style={[
              s.linksCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {legalLinks.map((link, i) => (
              <Pressable
                key={link.id}
                style={[
                  s.linkRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.linkLabel, { color: c.text }]}>
                    {link.label}
                  </Text>
                  <Text style={[s.linkHint, { color: c.textMuted }]}>
                    {link.hint}
                  </Text>
                </View>
                <Feather name="arrow-up-right" size={16} color={c.textFaint} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.footer}>
          <Text style={[s.footerText, { color: c.textMuted }]}>
            Los valores expresados en la app tienen carácter informativo. Las
            inversiones están sujetas a riesgo de mercado. Rendimientos pasados
            no garantizan rendimientos futuros.
          </Text>
          <AlamosLogo
            variant="lockup"
            tone="green"
            size={22}
            style={{ marginTop: 20 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function FactRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        s.factRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
      ]}
    >
      <Text style={[s.factLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.factValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  hero: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  heroTitle: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    maxWidth: 300,
  },
  factsCard: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  factRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md + 2,
  },
  factLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  factValue: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  linksBlock: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  linksCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: spacing.md + 4,
  },
  linkLabel: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  linkHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 20,
  },
  footerText: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    letterSpacing: -0.05,
  },
});
