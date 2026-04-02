import { useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { formatARS } from "../../lib/data/assets";

type Step = "promo" | "calculator" | "agreements";

export default function LendingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("promo");

  const handleBack = () => {
    switch (step) {
      case "promo": router.back(); break;
      case "calculator": setStep("promo"); break;
      case "agreements": setStep("calculator"); break;
    }
  };

  /* ════════════════════════════════════════
     STEP 1 — Promo
     ════════════════════════════════════════ */
  const renderPromo = () => (
    <View style={s.flex}>
      {/* Yellow-green hero */}
      <View style={s.hero}>
        <Pressable style={s.closeBtn} onPress={handleBack} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.surface[0]} />
        </Pressable>
        {/* Illustration placeholder */}
        <View style={s.heroIllustration}>
          <View style={s.heroPhone}>
            <Ionicons name="cash-outline" size={40} color={colors.brand[500]} />
          </View>
          {/* Floating elements */}
          <View style={[s.heroCoin, { top: 10, left: 20 }]}>
            <Text style={s.heroCoinText}>$</Text>
          </View>
          <View style={[s.heroCoin, { top: 0, right: 30 }]}>
            <Text style={s.heroCoinText}>$</Text>
          </View>
          <View style={[s.heroCoin, { bottom: 20, right: 10, backgroundColor: "#FFB74D" }]}>
            <Text style={s.heroCoinText}>$</Text>
          </View>
          <View style={[s.heroSparkle, { top: 5, right: 60 }]} />
          <View style={[s.heroSparkle, { bottom: 30, left: 40, width: 6, height: 6 }]} />
        </View>
      </View>

      <ScrollView
        style={s.promoContent}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.promoTitle}>
          Generá intereses con tus acciones
        </Text>

        {/* Benefits */}
        <View style={s.benefit}>
          <Ionicons name="flash" size={18} color={colors.brand[500]} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.benefitTitle}>Generá intereses sobre tus acciones</Text>
            <Text style={s.benefitDesc}>
              Solo activalo y vas a empezar a generar ingresos cuando tus acciones sean prestadas.
            </Text>
          </View>
        </View>

        <View style={s.benefit}>
          <Ionicons name="flash" size={18} color={colors.brand[500]} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.benefitTitle}>Cobrá mensualmente</Text>
            <Text style={s.benefitDesc}>
              Los intereses generados se depositan automáticamente en tu cuenta cada mes.
            </Text>
          </View>
        </View>

        <View style={s.benefit}>
          <Ionicons name="flash" size={18} color={colors.brand[500]} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.benefitTitle}>Mantenés la propiedad de tus acciones</Text>
            <Text style={s.benefitDesc}>
              Vendé las acciones prestadas en cualquier momento y cobrá los retornos como siempre.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[s.bottomBtnArea, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={s.darkBtn} onPress={() => setStep("calculator")}>
          <Text style={s.darkBtnText}>Continuar</Text>
        </Pressable>
      </View>
    </View>
  );

  /* ════════════════════════════════════════
     STEP 2 — Calculator
     ════════════════════════════════════════ */
  const renderCalculator = () => (
    <View style={s.flex}>
      {/* Light background */}
      <View style={s.calcContainer}>
        <View style={s.calcHeader}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.surface[0]} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.calcTitle}>¿Cuánto podría ganar?</Text>

          {/* Example pill */}
          <View style={s.examplePill}>
            <Text style={s.examplePillText}>Ganancia anual estimada</Text>
          </View>

          {/* Big amount */}
          <Text style={s.calcAmount}>{formatARS(22500)}</Text>

          {/* Detail rows */}
          <View style={s.calcDivider} />
          <View style={s.calcRow}>
            <Text style={s.calcRowLabel}>Valor hipotético de acciones en préstamo</Text>
            <Text style={s.calcRowValue}>{formatARS(1500000)}</Text>
          </View>
          <View style={s.calcDivider} />
          <View style={s.calcRow}>
            <Text style={s.calcRowLabel}>Tasa de interés anual hipotética</Text>
            <Text style={s.calcRowValue}>1,50%</Text>
          </View>
          <View style={s.calcDivider} />

          {/* FAQ */}
          <Pressable style={s.faqRow}>
            <Text style={s.faqText}>Preguntas frecuentes</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.surface[0]} />
          </Pressable>

          {/* Disclaimer */}
          <Text style={s.calcDisclaimer}>
            Este ejemplo presenta retornos hipotéticos y no garantiza resultados futuros. Es solo para fines ilustrativos y no debe considerarse una recomendación personalizada o consejo de inversión.
          </Text>
        </ScrollView>

        <View style={[s.bottomBtnArea, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={s.darkBtn} onPress={() => setStep("agreements")}>
            <Text style={s.darkBtnText}>Continuar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  /* ════════════════════════════════════════
     STEP 3 — Agreements
     ════════════════════════════════════════ */
  const renderAgreements = () => (
    <View style={[s.flex, { paddingTop: insets.top }]}>
      <View style={s.agreementHeader}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
        </Pressable>
      </View>

      <ScrollView
        style={s.agreementContent}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.agreementTitle}>Acuerdos de préstamo de títulos</Text>
        <Text style={s.agreementSubtitle}>
          Revisá los dos acuerdos a continuación antes de activar el préstamo de títulos.
        </Text>

        {/* Document links */}
        <View style={s.docList}>
          <View style={s.docRow}>
            <View style={s.docBullet} />
            <Text style={s.docLink}>Divulgación y acuerdo de préstamo</Text>
          </View>
          <View style={s.docRow}>
            <View style={s.docBullet} />
            <Text style={s.docLink}>Acuerdo de designación de custodio</Text>
          </View>
        </View>

        {/* Important points */}
        <Text style={s.withLendingTitle}>Con el préstamo de títulos:</Text>

        <View style={s.bulletList}>
          <BulletItem text="Las acciones en préstamo no están cubiertas por la garantía de la CNV, pero están protegidas con 100% de colateral en un banco tercero." />
          <BulletItem text="No vas a poder votar en asambleas de la empresa si tus acciones están en préstamo." />
          <BulletItem text="Los dividendos generados por acciones en préstamo se pagan como efectivo y pueden tributar de forma diferente." />
          <BulletItem text="No hay garantía de que tus acciones sean prestadas." />
        </View>
      </ScrollView>

      <View style={[s.agreementBottom, { paddingBottom: insets.bottom + 16 }]}>
        {/* Acceptance text */}
        <Text style={s.acceptanceText}>
          He leído los términos de la Divulgación y acuerdo de préstamo, incluyendo la cláusula de arbitraje de la sección 24, y el Acuerdo de designación de custodio.{" "}
          <Text style={s.acceptanceLink}>Resumen de relación con el cliente</Text>
        </Text>

        <Pressable
          style={s.darkBtn}
          onPress={() => router.back()}
        >
          <Text style={s.darkBtnText}>Aceptar</Text>
        </Pressable>
      </View>
    </View>
  );

  /* ── Step router ── */
  const renderStep = () => {
    switch (step) {
      case "promo": return renderPromo();
      case "calculator": return renderCalculator();
      case "agreements": return renderAgreements();
    }
  };

  return (
    <View style={s.container}>
      {renderStep()}
    </View>
  );
}

/* ─── BulletItem ─── */
function BulletItem({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <View style={s.bulletDot} />
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  flex: { flex: 1 },

  /* ═══ PROMO ═══ */
  hero: {
    height: 260,
    backgroundColor: "#C6FF00",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 56,
    left: 16,
    zIndex: 10,
  },
  heroIllustration: {
    width: 180,
    height: 140,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPhone: {
    width: 100,
    height: 80,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  heroCoin: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
  },
  heroCoinText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.surface[0],
  },
  heroSparkle: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.7)",
  },

  promoContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    backgroundColor: colors.surface[0],
  },
  promoTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 28,
  },

  benefit: {
    flexDirection: "row",
    marginBottom: 24,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  /* ═══ CALCULATOR ═══ */
  calcContainer: {
    flex: 1,
    backgroundColor: "#C6FF00",
  },
  calcHeader: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  calcTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.surface[0],
    letterSpacing: -0.5,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  examplePill: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: colors.surface[0],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 20,
    marginBottom: 12,
  },
  examplePillText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.surface[0],
  },
  calcAmount: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.surface[0],
    letterSpacing: -2,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  calcDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    marginHorizontal: 20,
  },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  calcRowLabel: {
    fontSize: 14,
    color: "rgba(0,0,0,0.6)",
    flex: 1,
    marginRight: 10,
  },
  calcRowValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface[0],
  },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  faqText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.surface[0],
    textDecorationLine: "underline",
  },
  calcDisclaimer: {
    fontSize: 12,
    color: "rgba(0,0,0,0.5)",
    lineHeight: 18,
    paddingHorizontal: 20,
    marginTop: 8,
  },

  /* ═══ AGREEMENTS ═══ */
  agreementHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  agreementContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  agreementTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  agreementSubtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 24,
  },

  /* Document links */
  docList: {
    marginBottom: 24,
    gap: 14,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.primary,
  },
  docLink: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    textDecorationLine: "underline",
  },

  /* With lending */
  withLendingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 16,
  },

  /* Bullet list */
  bulletList: {
    gap: 16,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.primary,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  /* Agreement bottom */
  agreementBottom: {
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  acceptanceText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  acceptanceLink: {
    color: colors.text.primary,
    textDecorationLine: "underline",
    fontWeight: "600",
  },

  /* ═══ BUTTONS ═══ */
  bottomBtnArea: {
    paddingHorizontal: 20,
  },
  darkBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
  },
  darkBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
  },
});
