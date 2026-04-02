import { useState, useRef } from "react";
import {
  View, Text, Pressable, ScrollView, TextInput, Modal,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";

/* ─── Types ─── */
type SubView = "main" | "wizard" | "verifyPhone" | "enterCode" | "phoneSuccess" | "allDone" | "activateCrypto";

interface Step {
  num: number;
  label: string;
  subtitle?: string;
  done: boolean;
  locked?: boolean;
}

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  const [view, setView] = useState<SubView>("main");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /* ── Wizard state ── */
  const [step1Done, setStep1Done] = useState(true);  // identity verified
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);

  /* ── Phone verification ── */
  const [phoneNumber] = useState("+54 11 ****-4523");
  const [code, setCode] = useState("");
  const [codeSending, setCodeSending] = useState(false);
  const codeRef = useRef<TextInput>(null);

  /* ── Animations ── */
  const successScale = useRef(new Animated.Value(0)).current;

  const handleBack = () => {
    if (view === "main") {
      router.back();
    } else if (view === "verifyPhone" || view === "enterCode") {
      setView("wizard");
    } else if (view === "phoneSuccess") {
      setStep2Done(true);
      setView("wizard");
    } else if (view === "allDone" || view === "activateCrypto") {
      setView("wizard");
    } else {
      setView("main");
    }
  };

  const handleSendCode = () => {
    setCodeSending(true);
    setTimeout(() => {
      setCodeSending(false);
      setView("enterCode");
    }, 800);
  };

  const handleVerifyCode = () => {
    if (code.length < 6) return;
    // Animate success
    setView("phoneSuccess");
    Animated.spring(successScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handlePhoneSuccessDone = () => {
    setStep2Done(true);
    successScale.setValue(0);
    setCode("");
    setView("wizard");
  };

  /* ════════════════════════════════════════
     MAIN SECURITY PAGE
     ════════════════════════════════════════ */
  const renderMain = () => (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Green hero */}
      <View style={s.hero}>
        <View style={s.heroIconCircle}>
          <Ionicons name="shield-checkmark" size={48} color={colors.brand[500]} />
        </View>
      </View>

      {/* Title */}
      <View style={s.titleSection}>
        <Text style={s.title}>Seguridad</Text>
        <Text style={s.titleDesc}>
          Protegé tu cuenta de Álamos con capas adicionales de seguridad.
        </Text>
      </View>

      {/* ── Security options ── */}
      <SecurityRow
        icon="key-outline"
        label="Crear passkey"
        onPress={() => {}}
      />
      <SecurityRow
        icon="lock-closed-outline"
        label="Cambiar contraseña"
        onPress={() => {}}
      />
      <SecurityRow
        icon="shield-outline"
        label="Autenticación en dos pasos"
        subtitle={step2Done ? "Activada" : "Desactivada"}
        subtitleColor={step2Done ? colors.brand[500] : colors.red}
        onPress={() => setView("wizard")}
      />
      <SecurityRow
        icon="finger-print-outline"
        label="Seguridad del dispositivo"
        subtitle="Face ID"
        subtitleColor={colors.brand[500]}
        onPress={() => {}}
      />
      <SecurityRow
        icon="mic-outline"
        label="Verificación de voz"
        subtitle="Crear Voice ID"
        subtitleColor={colors.brand[500]}
        onPress={() => {}}
      />
      <SecurityRow
        icon="phone-portrait-outline"
        label="Dispositivos"
        onPress={() => {}}
      />

      {/* ── Privacy section ── */}
      <View style={s.privacyHeader}>
        <Text style={s.privacyTitle}>Privacidad</Text>
        <Text style={s.privacyDesc}>Administrá cómo se usan tus datos.</Text>
      </View>

      <SecurityRow
        icon="download-outline"
        label="Solicitar datos personales"
        onPress={() => {}}
      />
      <SecurityRow
        icon="trash-outline"
        label="Solicitar eliminación de datos"
        onPress={() => {}}
      />
      <SecurityRow
        icon="share-social-outline"
        label="Permisos de datos compartidos"
        onPress={() => {}}
      />
      <SecurityRow
        icon="document-text-outline"
        label="Política de privacidad"
        onPress={() => {}}
      />

      {/* ── Logout ── */}
      <Pressable style={s.logoutBtn} onPress={() => setShowLogoutModal(true)}>
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );

  /* ════════════════════════════════════════
     WIZARD: Get Started (2FA setup)
     ════════════════════════════════════════ */
  const renderWizard = () => {
    const steps: Step[] = [
      { num: 1, label: "Verificar tu identidad", done: step1Done },
      {
        num: 2,
        label: "Configurar autenticación en dos pasos",
        subtitle: step2Done ? undefined : "5 minutos",
        done: step2Done,
      },
      {
        num: 3,
        label: "Activar transferencias crypto",
        subtitle: step3Done ? undefined : "1 minuto",
        done: step3Done,
        locked: !step2Done,
      },
    ];

    return (
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Purple gradient hero */}
        <View style={s.wizardHero}>
          <View style={s.wizardHeroInner}>
            <View style={s.wizardOrbLarge}>
              <Ionicons name="eye" size={40} color={colors.text.primary} />
            </View>
            {/* Decorative dots */}
            <View style={[s.wizardDot, { top: 30, left: 40, backgroundColor: colors.brand[500] }]} />
            <View style={[s.wizardDot, { top: 50, right: 50, backgroundColor: colors.brand[500], width: 16, height: 16 }]} />
            <View style={[s.wizardDot, { bottom: 40, left: 60, backgroundColor: "#FFD54F", width: 10, height: 10 }]} />
            <View style={[s.wizardDot, { bottom: 30, right: 40, backgroundColor: colors.brand[500] }]} />
          </View>
        </View>

        <Text style={s.wizardTitle}>Empezar</Text>

        {/* Steps */}
        {steps.map((step) => (
          <Pressable
            key={step.num}
            style={s.stepRow}
            disabled={step.locked}
            onPress={() => {
              if (step.done) return;
              if (step.num === 2) setView("verifyPhone");
              if (step.num === 3 && !step.locked) setView("activateCrypto");
            }}
          >
            <View style={[s.stepBadge, step.done && s.stepBadgeDone, step.locked && s.stepBadgeLocked]}>
              {step.done ? (
                <Ionicons name="checkmark" size={16} color={colors.surface[0]} />
              ) : (
                <Text style={[s.stepBadgeNum, step.locked && s.stepBadgeNumLocked]}>
                  {step.num}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.stepLabel, step.locked && s.stepLabelLocked]}>
                {step.label}
              </Text>
              {step.subtitle && (
                <Text style={s.stepSub}>{step.subtitle}</Text>
              )}
            </View>
            {step.done ? (
              <Ionicons name="checkmark" size={22} color={colors.text.primary} />
            ) : step.locked ? (
              <Ionicons name="lock-closed" size={18} color={colors.text.muted} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  /* ════════════════════════════════════════
     VERIFY PHONE NUMBER
     ════════════════════════════════════════ */
  const renderVerifyPhone = () => (
    <View style={s.flowContainer}>
      <Text style={s.flowTitle}>Verificá tu número de teléfono</Text>
      <Text style={s.flowDesc}>
        Te vamos a enviar un código de 6 dígitos. Expira 5 minutos después de solicitarlo.{" "}
        <Text style={s.linkText}>Más información</Text>
      </Text>

      <View style={s.phoneDisplay}>
        <Text style={s.phoneText}>{phoneNumber}</Text>
      </View>

      <Pressable>
        <Text style={s.changePhoneLink}>Cambiar número de teléfono</Text>
      </Pressable>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Consent */}
      <Text style={s.consentText}>
        Estás aceptando que te contactemos a este número para enviarte un código de verificación. Pueden aplicar cargos por SMS de tu operador. Tu número solo será usado de acuerdo a nuestra{" "}
        <Text style={s.linkTextUnderline}>Política de Privacidad</Text>.
      </Text>

      <Pressable
        style={s.primaryBtn}
        onPress={handleSendCode}
        disabled={codeSending}
      >
        <Text style={s.primaryBtnText}>
          {codeSending ? "Enviando..." : "Enviar por SMS"}
        </Text>
      </Pressable>

      <Pressable style={s.secondaryBtn}>
        <Text style={s.secondaryBtnText}>Enviar por llamada</Text>
      </Pressable>
    </View>
  );

  /* ════════════════════════════════════════
     ENTER VERIFICATION CODE
     ════════════════════════════════════════ */
  const renderEnterCode = () => (
    <KeyboardAvoidingView
      style={s.flowContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={s.flowTitle}>Ingresá tu código de verificación</Text>
      <Text style={s.flowDesc}>
        Se envió un mensaje de texto con un código de verificación al{"\n"}
        <Text style={{ fontWeight: "700", color: colors.text.primary }}>{phoneNumber}</Text>
      </Text>

      {/* Code input */}
      <View style={s.codeInputContainer}>
        <TextInput
          ref={codeRef}
          style={s.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          placeholder="------"
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.text.primary}
        />
      </View>

      <Pressable>
        <Text style={s.resendLink}>¿No lo recibiste? <Text style={s.linkTextUnderline}>Reenviar código</Text></Text>
      </Pressable>

      <View style={{ flex: 1 }} />

      <Pressable
        style={[s.primaryBtn, code.length < 6 && s.primaryBtnDisabled]}
        onPress={handleVerifyCode}
        disabled={code.length < 6}
      >
        <Text style={s.primaryBtnText}>Continuar</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );

  /* ════════════════════════════════════════
     PHONE VERIFIED SUCCESS
     ════════════════════════════════════════ */
  const renderPhoneSuccess = () => (
    <View style={s.successContainer}>
      {/* Green check animation */}
      <Animated.View style={[s.successIcon, { transform: [{ scale: successScale }] }]}>
        <View style={s.successCircle}>
          <Ionicons name="checkmark" size={48} color={colors.surface[0]} />
        </View>
        {/* Small decorative dots */}
        <View style={[s.successDot, { top: -10, right: -5, backgroundColor: "#FFB74D" }]} />
        <View style={[s.successDot, { top: 20, left: -15, backgroundColor: "#FFB74D", width: 10, height: 10 }]} />
        <View style={[s.successDot, { bottom: -5, right: -10, backgroundColor: "#FFB74D" }]} />
      </Animated.View>

      <Text style={s.successTitle}>¡Número verificado!</Text>
      <Text style={s.successDesc}>
        Si cambiás tu número de teléfono en el futuro, vas a necesitar verificarlo de nuevo.
      </Text>

      <View style={{ flex: 1 }} />

      <Pressable style={s.primaryBtn} onPress={handlePhoneSuccessDone}>
        <Text style={s.primaryBtnText}>Listo</Text>
      </Pressable>
    </View>
  );

  /* ════════════════════════════════════════
     ALL STEPS DONE
     ════════════════════════════════════════ */
  // (rendered via wizard with all checks)

  /* ════════════════════════════════════════
     ACTIVATE CRYPTO TRANSFERS
     ════════════════════════════════════════ */
  const renderActivateCrypto = () => (
    <View style={s.flowContainer}>
      {/* Hero */}
      <View style={s.cryptoHero}>
        <View style={s.cryptoWalletIcon}>
          <Ionicons name="wallet-outline" size={44} color={colors.text.primary} />
        </View>
        {/* Decorative coin icons */}
        <View style={[s.cryptoCoin, { top: 10, right: 30 }]}>
          <Ionicons name="logo-bitcoin" size={22} color="#FFB74D" />
        </View>
        <View style={[s.cryptoCoin, { top: 30, left: 20 }]}>
          <Ionicons name="logo-usd" size={18} color="#90CAF9" />
        </View>
        <View style={[s.cryptoCoin, { bottom: 10, right: 50 }]}>
          <Ionicons name="diamond-outline" size={18} color={colors.brand[500]} />
        </View>
      </View>

      <Text style={s.flowTitle}>Activar transferencias crypto</Text>

      <Text style={s.flowDesc}>
        Al activar esta función, estás aceptando los términos y condiciones de transferencias crypto según lo establecido en el{" "}
        <Text style={s.linkTextUnderline}>Acuerdo de Usuario Crypto de Álamos</Text>.
      </Text>

      <View style={{ flex: 1 }} />

      <Pressable
        style={s.primaryBtn}
        onPress={() => {
          setStep3Done(true);
          setView("wizard");
        }}
      >
        <Text style={s.primaryBtnText}>Activar transferencias crypto</Text>
      </Pressable>

      <Pressable style={s.secondaryBtn} onPress={() => setView("wizard")}>
        <Text style={s.secondaryBtnText}>Ahora no</Text>
      </Pressable>
    </View>
  );

  /* ── View router ── */
  const renderContent = () => {
    switch (view) {
      case "main": return renderMain();
      case "wizard": return renderWizard();
      case "verifyPhone": return renderVerifyPhone();
      case "enterCode": return renderEnterCode();
      case "phoneSuccess": return renderPhoneSuccess();
      case "activateCrypto": return renderActivateCrypto();
      default: return renderMain();
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      {view !== "phoneSuccess" && (
        <View style={s.header}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
          </Pressable>
          <Text style={s.headerTitle}>
            {view === "main" ? "" : view === "wizard" ? "" : ""}
          </Text>
          <View style={{ width: 26 }} />
        </View>
      )}

      <View style={[s.contentArea, { paddingBottom: insets.bottom + 16 }]}>
        {renderContent()}
      </View>

      {/* ═══ Logout modal ═══ */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowLogoutModal(false)} />
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>¿Cerrar sesión?</Text>
          <Text style={s.modalDesc}>
            Vas a necesitar tu contraseña para volver a ingresar a tu cuenta.
          </Text>
          <Pressable
            style={s.modalPrimaryBtn}
            onPress={() => {
              setShowLogoutModal(false);
              logout();
            }}
          >
            <Text style={s.modalPrimaryText}>Sí, cerrar sesión</Text>
          </Pressable>
          <Pressable style={s.modalSecondaryBtn} onPress={() => setShowLogoutModal(false)}>
            <Text style={s.modalSecondaryText}>Cancelar</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* ─── SecurityRow subcomponent ─── */
interface SecurityRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  subtitleColor?: string;
  onPress: () => void;
}

function SecurityRow({ icon, label, subtitle, subtitleColor, onPress }: SecurityRowProps) {
  return (
    <Pressable style={s.secRow} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={s.secRowLabel}>{label}</Text>
        {subtitle ? (
          <Text style={[s.secRowSub, subtitleColor ? { color: subtitleColor } : undefined]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
    </Pressable>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  contentArea: { flex: 1 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* ═══ MAIN PAGE ═══ */
  hero: {
    height: 200,
    backgroundColor: colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  titleDesc: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  /* Security rows */
  secRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  secRowLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text.primary,
    marginBottom: 2,
  },
  secRowSub: {
    fontSize: 13,
    color: colors.brand[500],
    fontWeight: "600",
  },

  /* Privacy */
  privacyHeader: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 12,
  },
  privacyTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  privacyDesc: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  /* Logout */
  logoutBtn: {
    alignItems: "center",
    paddingVertical: 20,
    marginTop: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.red,
  },

  /* ═══ WIZARD ═══ */
  wizardHero: {
    height: 240,
    backgroundColor: "#2D1B69",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  wizardHeroInner: {
    width: 200,
    height: 200,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  wizardOrbLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#3D2B7A",
    borderWidth: 3,
    borderColor: "#5A3FA0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C4DFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  wizardDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  wizardTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 16,
  },

  /* Steps */
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeDone: {
    backgroundColor: colors.text.primary,
  },
  stepBadgeLocked: {
    backgroundColor: colors.surface[200],
  },
  stepBadgeNum: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.surface[0],
  },
  stepBadgeNumLocked: {
    color: colors.text.muted,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text.primary,
  },
  stepLabelLocked: {
    color: colors.text.muted,
  },
  stepSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },

  /* ═══ FLOW SCREENS ═══ */
  flowContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  flowTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  flowDesc: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  linkText: {
    color: colors.brand[500],
    fontWeight: "600",
  },
  linkTextUnderline: {
    color: colors.text.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  /* Phone display */
  phoneDisplay: {
    alignItems: "center",
    paddingVertical: 40,
  },
  phoneText: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.text.primary,
    letterSpacing: 1,
  },
  changePhoneLink: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    textDecorationLine: "underline",
    textAlign: "center",
  },

  /* Consent */
  consentText: {
    fontSize: 13,
    color: colors.text.muted,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 20,
  },

  /* Code input */
  codeInputContainer: {
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    borderRadius: 12,
    marginVertical: 24,
    paddingHorizontal: 16,
    height: 60,
    justifyContent: "center",
  },
  codeInput: {
    fontSize: 28,
    fontWeight: "600",
    color: colors.text.primary,
    letterSpacing: 8,
    textAlign: "center",
  },
  resendLink: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
  },

  /* ═══ SUCCESS ═══ */
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  successIcon: {
    marginBottom: 30,
    position: "relative",
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
  },
  successDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  successTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 12,
    textAlign: "center",
  },
  successDesc: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    textAlign: "center",
  },

  /* ═══ CRYPTO ACTIVATION ═══ */
  cryptoHero: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2D1B69",
    borderRadius: 20,
    marginBottom: 24,
    position: "relative",
    overflow: "hidden",
  },
  cryptoWalletIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#3D2B7A",
    alignItems: "center",
    justifyContent: "center",
  },
  cryptoCoin: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ═══ BUTTONS ═══ */
  primaryBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.surface[0],
  },
  secondaryBtn: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* ═══ MODAL ═══ */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalCard: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "32%",
    backgroundColor: colors.surface[100],
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 10,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  modalPrimaryBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand[700],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  modalPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  modalSecondaryBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.brand[500],
  },
});
