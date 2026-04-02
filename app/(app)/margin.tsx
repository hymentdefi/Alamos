import { useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

/* ─── Steps ─── */
type Step = "promo1" | "promo2" | "profile" | "needs" | "confirm";

/* ─── Profile field data ─── */
interface ProfileField {
  label: string;
  value: string;
  addAnswer?: boolean;
}

const financialFields: ProfileField[] = [
  { label: "Situación laboral", value: "Empleado" },
  { label: "Ingreso anual", value: "$3.000.000 - $6.000.000" },
  { label: "Estado civil", value: "Soltero/a" },
  { label: "Personas a cargo", value: "0" },
  { label: "Efectivo e inversiones", value: "$0 - $2.000.000" },
  { label: "Otras inversiones", value: "Sin respuesta", addAnswer: true },
];

const needsFields: ProfileField[] = [
  { label: "Experiencia en inversiones", value: "Algo" },
  { label: "Experiencia en opciones", value: "Menos de 1 año" },
];

const brokerageFields: ProfileField[] = [
  { label: "Objetivo", value: "Preservar" },
  { label: "Horizonte temporal", value: "4-10 años" },
  { label: "Probabilidad de retirar", value: "Sin respuesta", addAnswer: true },
  { label: "Tolerancia al riesgo", value: "Alta" },
];

export default function MarginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("promo1");

  const handleBack = () => {
    switch (step) {
      case "promo1": router.back(); break;
      case "promo2": setStep("promo1"); break;
      case "profile": setStep("promo2"); break;
      case "needs": setStep("profile"); break;
      case "confirm": setStep("needs"); break;
    }
  };

  /* Progress bar */
  const stepIndex = ["promo1", "promo2", "profile", "needs", "confirm"].indexOf(step);
  const progress = (stepIndex + 1) / 5;

  /* ════════════════════════════════════════
     PROMO 1 — Amplify returns
     ════════════════════════════════════════ */
  const renderPromo1 = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={s.promoTitle}>
        Invertir con margen puede{"\n"}
        <Text style={s.promoTitleGreen}>amplificar tus retornos</Text>
      </Text>

      {/* Chart visualization */}
      <View style={s.chartBox}>
        <View style={s.chartBg}>
          {/* Grid lines */}
          <View style={[s.chartGridLine, { bottom: "25%" }]} />
          <View style={[s.chartGridLine, { bottom: "50%" }]} />
          <View style={[s.chartGridLine, { bottom: "75%" }]} />
          {/* Green curve (with margin) */}
          <View style={s.chartCurveGreen} />
          {/* White curve (without margin) */}
          <View style={s.chartCurveWhite} />
          {/* Label */}
          <Text style={s.chartLabel}>Con margen</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={s.badgeRow}>
        <View style={s.badgeGreen}>
          <Text style={s.badgeText}>Portafolio</Text>
          <Ionicons name="caret-up" size={12} color={colors.surface[0]} />
        </View>
        <View style={s.badgeGray}>
          <Text style={s.badgeTextGray}>Portafolio</Text>
          <Ionicons name="caret-down" size={12} color={colors.text.secondary} />
        </View>
      </View>

      <Text style={s.promoDesc}>
        Más poder de compra puede impulsar tu estrategia de inversión: ya sea aumentando tus posiciones o diversificando tu portafolio. Con el tiempo, podría significar retornos aún mayores.
      </Text>

      <Pressable>
        <View style={s.disclosureRow}>
          <Text style={s.disclosureText}>Declaración de Divulgación de Margen</Text>
          <Ionicons name="open-outline" size={14} color={colors.text.secondary} />
        </View>
      </Pressable>

      <Pressable style={s.primaryBtn} onPress={() => setStep("promo2")}>
        <Text style={s.primaryBtnText}>Continuar</Text>
      </Pressable>
    </ScrollView>
  );

  /* ════════════════════════════════════════
     PROMO 2 — Manage risk
     ════════════════════════════════════════ */
  const renderPromo2 = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={s.promoTitle}>
        Administrá tu riesgo al invertir con margen
      </Text>

      {/* Benefits */}
      <View style={s.benefitsList}>
        <View style={s.benefitRow}>
          <View style={[s.benefitIcon, { backgroundColor: "#2E7D32" }]}>
            <Ionicons name="options-outline" size={22} color={colors.text.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.benefitTitle}>Establecé un límite de endeudamiento</Text>
            <Text style={s.benefitDesc}>
              Controlá cuánto margen querés usar para mantener un nivel de endeudamiento con el que te sientas cómodo.
            </Text>
          </View>
        </View>

        <View style={s.benefitRow}>
          <View style={[s.benefitIcon, { backgroundColor: "#1565C0" }]}>
            <Ionicons name="bar-chart-outline" size={22} color={colors.text.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.benefitTitle}>Monitoreá tu margen de mantenimiento</Text>
            <Text style={s.benefitDesc}>
              Revisá tu margen de mantenimiento en Configuración para asegurar que tu portafolio esté por encima del requerimiento mínimo.
            </Text>
          </View>
        </View>

        <View style={s.benefitRow}>
          <View style={[s.benefitIcon, { backgroundColor: "#E65100" }]}>
            <Ionicons name="trending-down-outline" size={22} color={colors.text.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.benefitTitle}>Prepárate para las fluctuaciones</Text>
            <Text style={s.benefitDesc}>
              Invertir en activos menos volátiles y mantener un colchón de efectivo puede ayudarte a evitar margin calls y otras restricciones.{" "}
              <Text style={s.linkText}>Más información sobre margin calls</Text>
            </Text>
          </View>
        </View>
      </View>

      <Pressable style={s.primaryBtn} onPress={() => setStep("profile")}>
        <Text style={s.primaryBtnText}>Empezar</Text>
      </Pressable>
    </ScrollView>
  );

  /* ════════════════════════════════════════
     PROFILE — Financial situation
     ════════════════════════════════════════ */
  const renderProfile = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={s.formTitle}>Revisá tu perfil de inversor</Text>
      <Text style={s.formSubtitle}>Actualizá tus respuestas si algo cambió.</Text>

      <Text style={s.sectionLabel}>Situación financiera</Text>

      {financialFields.map((field, i) => (
        <Pressable key={i} style={s.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>{field.label}</Text>
            <Text style={s.fieldValue}>{field.value}</Text>
          </View>
          {field.addAnswer ? (
            <View style={s.addAnswerRow}>
              <Text style={s.addAnswerText}>Agregar</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brand[500]} />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          )}
        </Pressable>
      ))}

      <Pressable style={s.primaryBtn} onPress={() => setStep("needs")}>
        <Text style={s.primaryBtnText}>Revisar</Text>
      </Pressable>
    </ScrollView>
  );

  /* ════════════════════════════════════════
     NEEDS — Investing needs
     ════════════════════════════════════════ */
  const renderNeeds = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionLabel}>Necesidades de inversión</Text>

      {needsFields.map((field, i) => (
        <Pressable key={i} style={s.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>{field.label}</Text>
            <Text style={s.fieldValue}>{field.value}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </Pressable>
      ))}

      <Text style={[s.sectionLabel, { marginTop: 24 }]}>Cuenta comitente</Text>

      {brokerageFields.map((field, i) => (
        <Pressable key={i} style={s.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>{field.label}</Text>
            <Text style={s.fieldValue}>{field.value}</Text>
          </View>
          {field.addAnswer ? (
            <View style={s.addAnswerRow}>
              <Text style={s.addAnswerText}>Agregar</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brand[500]} />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          )}
        </Pressable>
      ))}

      <Pressable style={s.primaryBtn} onPress={() => setStep("confirm")}>
        <Text style={s.primaryBtnText}>Confirmar</Text>
      </Pressable>
    </ScrollView>
  );

  /* ════════════════════════════════════════
     CONFIRM — Enable margin
     ════════════════════════════════════════ */
  const renderConfirm = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={s.confirmTitle}>¿Activar inversión con margen?</Text>
      <Text style={s.confirmDesc}>
        El margen es dinero que tomás prestado de Álamos usando tus valores como garantía. El margen conlleva mayores riesgos.{" "}
        <Text style={s.linkText}>Más información</Text>
      </Text>

      {/* Rate info */}
      <View style={s.confirmFeature}>
        <View style={s.confirmFeatureIcon}>
          <Ionicons name="calculator-outline" size={22} color="#FFD54F" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.confirmFeatureTitle}>Tasa del 85% TNA</Text>
          <Text style={s.confirmFeatureDesc}>
            Al final de cada ciclo de facturación de 30 días, vas a pagar una tasa anual sobre el margen que uses. La tasa puede variar según las condiciones del mercado.
          </Text>
        </View>
      </View>

      <View style={s.confirmFeature}>
        <View style={s.confirmFeatureIcon}>
          <Ionicons name="cash-outline" size={22} color="#FFD54F" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.confirmFeatureTitle}>$500.000 incluidos</Text>
          <Text style={s.confirmFeatureDesc}>
            Si estás suscripto a Álamos Premium, tus primeros $500.000 de margen están incluidos. Solo pagás intereses sobre el monto que exceda esa cifra.
          </Text>
        </View>
      </View>

      {/* Disclaimer */}
      <Text style={s.confirmDisclaimer}>
        La inversión con margen es una función opcional para clientes elegibles. Las tasas de interés pueden variar. Las criptomonedas no son marginables.
      </Text>

      {/* Buttons */}
      <Pressable
        style={s.goldBtn}
        onPress={() => router.back()}
      >
        <Text style={s.goldBtnText}>Continuar sin margen</Text>
      </Pressable>

      <Pressable
        style={s.goldBtnOutline}
        onPress={() => router.back()}
      >
        <Text style={s.goldBtnOutlineText}>Activar inversión con margen</Text>
      </Pressable>
    </ScrollView>
  );

  /* ── Step router ── */
  const renderStep = () => {
    switch (step) {
      case "promo1": return renderPromo1();
      case "promo2": return renderPromo2();
      case "profile": return renderProfile();
      case "needs": return renderNeeds();
      case "confirm": return renderConfirm();
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
        </Pressable>
        <Text style={s.headerTitle}>Inversión con margen</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Progress bar (only on profile/needs steps) */}
      {(step === "profile" || step === "needs") && (
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      <View style={s.content}>
        {renderStep()}
      </View>
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  content: { flex: 1, paddingHorizontal: 20 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* Progress bar */
  progressBar: {
    height: 3,
    backgroundColor: colors.surface[200],
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.brand[500],
    borderRadius: 2,
  },

  /* Promo */
  promoTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginTop: 16,
    marginBottom: 20,
    lineHeight: 34,
  },
  promoTitleGreen: {
    color: colors.brand[500],
  },
  promoDesc: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 20,
  },

  /* Chart */
  chartBox: {
    height: 180,
    marginBottom: 16,
  },
  chartBg: {
    flex: 1,
    backgroundColor: colors.surface[100],
    borderRadius: 14,
    padding: 16,
    position: "relative",
    overflow: "hidden",
  },
  chartGridLine: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: colors.border,
  },
  chartCurveGreen: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    height: 80,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 20,
    borderWidth: 3,
    borderColor: colors.brand[500],
    borderBottomWidth: 0,
  },
  chartCurveWhite: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 40,
    height: 50,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderBottomWidth: 0,
  },
  chartLabel: {
    position: "absolute",
    top: 16,
    right: 16,
    fontSize: 12,
    color: colors.text.secondary,
  },

  /* Badges */
  badgeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  badgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand[500],
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.surface[0],
  },
  badgeGray: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface[200],
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeTextGray: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
  },

  /* Disclosure */
  disclosureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  disclosureText: {
    fontSize: 14,
    color: colors.text.secondary,
    textDecorationLine: "underline",
  },

  /* Benefits */
  benefitsList: {
    gap: 28,
    marginTop: 24,
    marginBottom: 32,
  },
  benefitRow: {
    flexDirection: "row",
    gap: 16,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 6,
  },
  benefitDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  linkText: {
    color: colors.text.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  /* Form */
  formTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.text.muted,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
  addAnswerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addAnswerText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand[500],
  },

  /* Confirm */
  confirmTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginTop: 12,
    marginBottom: 14,
  },
  confirmDesc: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  confirmFeature: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 24,
  },
  confirmFeatureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
  },
  confirmFeatureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFD54F",
    marginBottom: 6,
  },
  confirmFeatureDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  confirmDisclaimer: {
    fontSize: 13,
    color: colors.text.muted,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 28,
  },

  /* Buttons */
  primaryBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.surface[0],
  },
  goldBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFD54F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  goldBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.surface[0],
  },
  goldBtnOutline: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "#FFD54F",
    alignItems: "center",
    justifyContent: "center",
  },
  goldBtnOutlineText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFD54F",
  },
});
