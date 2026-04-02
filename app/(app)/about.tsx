import {
  View, Text, Pressable, ScrollView, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

/* ─── Feature sections ─── */
interface Feature {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  description: string;
  learnMore: string;
  disclosureTitle: string;
  disclosureText: string;
}

const features: Feature[] = [
  {
    title: "Opciones",
    icon: "trending-up",
    iconBg: colors.brand[500],
    description:
      "Apostá a la suba de acciones en las que creés y a la baja de las que no. Vos decidís.",
    learnMore: "Más información",
    disclosureTitle: "Divulgación de riesgo de opciones",
    disclosureText:
      "La operatoria de opciones se ofrece a través de Álamos Capital S.A. La operatoria de opciones conlleva un riesgo significativo y no es apropiada para todos los inversores. Ciertas estrategias complejas de opciones conllevan riesgo adicional. Para conocer más sobre los riesgos asociados con la operatoria de opciones, por favor revisá el documento de divulgación de opciones titulado Características y Riesgos de las Opciones Estandarizadas. Los inversores deben considerar cuidadosamente sus objetivos de inversión y riesgos antes de operar opciones. La documentación de respaldo para cualquier reclamo, si corresponde, será proporcionada a pedido.",
  },
  {
    title: "Premium",
    icon: "diamond",
    iconBg: "#FFD54F",
    description:
      "Generá 65% TNA de interés sobre tu efectivo no invertido*, obtené depósitos instantáneos más grandes, operá con margen a tasa competitiva**, y accedé a datos de mercado de nivel II y reportes de research — todo por $4.999/mes.",
    learnMore: "Más información",
    disclosureTitle: "Divulgación del programa de intereses",
    disclosureText:
      "*Se necesita un saldo de efectivo para generar intereses a través del programa de barrido de efectivo. Los clientes que mantengan un saldo de margen no generarán intereses. Las tasas de interés para el programa de barrido de efectivo y la inversión con margen pueden cambiar en cualquier momento.\n\n**No todos los inversores serán elegibles para invertir con margen. Álamos Premium se ofrece a través de Álamos Capital S.A. La tasa de interés de margen cobrada por Álamos Capital puede variar. Las tarifas pueden cambiar sin previo aviso.",
  },
  {
    title: "Crypto",
    icon: "logo-bitcoin",
    iconBg: "#7C4DFF",
    description:
      "Accedé al mercado de criptomonedas para comprar, mantener y vender Bitcoin, Ethereum, USDT y más, las 24 horas del día, los 7 días de la semana con Álamos Crypto.",
    learnMore: "Más información",
    disclosureTitle: "Divulgación de riesgo de crypto",
    disclosureText:
      "La operatoria de criptomonedas se ofrece a través de Álamos Capital S.A. La operatoria de criptomonedas conlleva riesgos significativos, incluyendo volatilidad de precios, flash crashes, manipulación del mercado y riesgos de ciberseguridad. Además, los mercados y exchanges de criptomonedas no están regulados con los mismos controles o protecciones al consumidor disponibles en la operatoria de acciones, opciones, futuros o divisas. La operatoria de criptomonedas puede generar pérdidas financieras grandes e inmediatas y es apropiada solo para inversores que puedan soportar dichas pérdidas.",
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* Tab indicator */}
      <View style={s.tabIndicator}>
        <Text style={s.tabText}>Sobre nosotros</Text>
        <View style={s.tabUnderline} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Feature sections */}
        {features.map((feature, i) => (
          <View key={i} style={s.featureSection}>
            {/* Title */}
            <Text style={s.featureTitle}>{feature.title}</Text>

            {/* Illustration placeholder */}
            <View style={s.illustrationArea}>
              <View style={[s.illustrationIcon, { backgroundColor: feature.iconBg }]}>
                <Ionicons name={feature.icon} size={32} color={colors.surface[0]} />
              </View>
              {/* Decorative phone */}
              <View style={s.illustrationPhone}>
                <View style={s.phoneLine} />
                <View style={s.phoneLine} />
                <View style={[s.phoneLine, { width: "60%" }]} />
              </View>
            </View>

            {/* Description */}
            <Text style={s.featureDesc}>
              {feature.description}{" "}
              <Text style={s.learnMore}>{feature.learnMore}</Text>
            </Text>

            {/* Disclosure */}
            <Text style={s.disclosureTitle}>{feature.disclosureTitle}</Text>
            <Text style={s.disclosureText}>{feature.disclosureText}</Text>
          </View>
        ))}

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Disclosures ── */}
        <View style={s.disclosuresSection}>
          <Text style={s.disclosuresTitle}>Divulgaciones</Text>

          <Text style={s.disclosuresBody}>
            Álamos Capital S.A. (miembro del{" "}
            <Text style={s.disclosuresLink}>Fondo de Garantía CNV</Text>
            ), es un agente de liquidación y compensación registrado. Álamos Capital S.A. ofrece servicios de clearing y custodia de valores. Álamos Crypto S.A. ofrece servicios de operatoria de criptomonedas. Todas son subsidiarias de Álamos Group S.A. ("Álamos").
          </Text>

          <Text style={s.copyright}>
            © 2026 Álamos Group S.A. Álamos® es una marca registrada de Álamos Group S.A. Todos los derechos reservados.
          </Text>

          <Text style={s.refNumber}>Referencia N° 2440042</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  /* Tab indicator */
  tabIndicator: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
  },
  tabUnderline: {
    height: 2,
    width: 100,
    backgroundColor: colors.brand[500],
    borderRadius: 1,
  },

  /* Feature sections */
  featureSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  featureTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 20,
  },

  /* Illustration */
  illustrationArea: {
    height: 160,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  illustrationIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  illustrationPhone: {
    width: 70,
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    backgroundColor: colors.surface[100],
    padding: 12,
    justifyContent: "center",
    gap: 8,
  },
  phoneLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surface[200],
    width: "80%",
  },

  /* Description */
  featureDesc: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  learnMore: {
    color: colors.text.secondary,
    textDecorationLine: "underline",
  },

  /* Disclosure */
  disclosureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 10,
  },
  disclosureText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  /* Divider */
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    marginVertical: 24,
  },

  /* Disclosures section */
  disclosuresSection: {
    paddingHorizontal: 20,
  },
  disclosuresTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  disclosuresBody: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 21,
    marginBottom: 20,
  },
  disclosuresLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  copyright: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  refNumber: {
    fontSize: 13,
    color: colors.text.muted,
  },
});
