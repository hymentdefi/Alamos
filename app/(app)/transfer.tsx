import { useState, useRef } from "react";
import {
  View, Text, Pressable, ScrollView, Modal, StyleSheet, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { formatARS } from "../../lib/data/assets";

/* ─── Types ─── */
type Screen =
  | "hub"
  | "amount"
  | "review"
  | "success"
  | "autoSetup"
  | "schedule"
  | "autoAmount"
  | "directDeposit"
  | "directOptions";

type TransferMode = "deposit" | "withdraw";

/* ─── Mock data ─── */
const BALANCE = 342180;
const BANK_NAME = "Banco Galicia";
const BANK_CBU = "····3847";

const FREQUENCIES = [
  { key: "once", label: "Una vez", desc: "" },
  { key: "weekly", label: "Semanal", desc: "Los lunes" },
  { key: "biweekly", label: "Quincenal", desc: "El 1 y 15 de cada mes" },
  { key: "monthly", label: "Mensual", desc: "El día 1 de cada mes" },
  { key: "quarterly", label: "Trimestral", desc: "El 1 de ene/abr/jul/oct" },
] as const;

type FreqKey = (typeof FREQUENCIES)[number]["key"];

export default function TransferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [screen, setScreen] = useState<Screen>("hub");
  const [mode, setMode] = useState<TransferMode>("deposit");
  const [amount, setAmount] = useState("0");
  const [frequency, setFrequency] = useState<FreqKey>("once");
  const [selectedFreq, setSelectedFreq] = useState<FreqKey>("monthly");
  const [showFreqModal, setShowFreqModal] = useState(false);
  const [autoFreq, setAutoFreq] = useState<FreqKey>("monthly");

  const numericAmount = parseFloat(amount) || 0;
  const hasAmount = numericAmount > 0;
  const maxAmount = mode === "withdraw" ? BALANCE : 999999999;
  const exceedsMax = numericAmount > maxAmount;

  /* Numpad handler */
  const handleKey = (key: string) => {
    if (key === "back") {
      setAmount((prev) => {
        const next = prev.slice(0, -1);
        return next.length === 0 ? "0" : next;
      });
      return;
    }
    if (key === ".") {
      if (amount.includes(".")) return;
      setAmount((prev) => prev + ".");
      return;
    }
    setAmount((prev) => {
      if (prev === "0") return key;
      if (prev.includes(".") && prev.split(".")[1].length >= 2) return prev;
      return prev + key;
    });
  };

  const resetFlow = () => {
    setAmount("0");
    setFrequency("once");
    setScreen("hub");
  };

  const handleBack = () => {
    switch (screen) {
      case "hub": return; // tab screen, no back
      case "amount": resetFlow(); break;
      case "review": setScreen("amount"); break;
      case "success": resetFlow(); break;
      case "autoSetup": setScreen("hub"); break;
      case "schedule": setScreen("autoSetup"); break;
      case "autoAmount": setScreen("schedule"); break;
      case "directDeposit": setScreen("hub"); break;
      case "directOptions": setScreen("directDeposit"); break;
    }
  };

  const freqLabel = FREQUENCIES.find((f) => f.key === frequency)?.label || "Una vez";

  /* ════════════════════════════════════════
     HUB — Transfer options list
     ════════════════════════════════════════ */
  const renderHub = () => (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.topNav, { paddingTop: insets.top + 12 }]}>
        <Text style={s.hubTitle}>Transferir</Text>
      </View>

      {/* Transfer money */}
      <Pressable
        style={s.hubCard}
        onPress={() => { setMode("deposit"); setScreen("amount"); }}
      >
        <View style={s.hubCardIcon}>
          <Ionicons name="arrow-down-outline" size={22} color={colors.brand[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hubCardLabel}>Depositar</Text>
          <Text style={s.hubCardDesc}>Transferí pesos desde tu banco a Álamos</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      <Pressable
        style={s.hubCard}
        onPress={() => { setMode("withdraw"); setScreen("amount"); }}
      >
        <View style={s.hubCardIcon}>
          <Ionicons name="arrow-up-outline" size={22} color={colors.brand[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hubCardLabel}>Retirar</Text>
          <Text style={s.hubCardDesc}>Enviá fondos a tu cuenta bancaria</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      <View style={s.thickDivider} />

      {/* Automatic deposits */}
      <Pressable style={s.hubCard} onPress={() => setScreen("autoSetup")}>
        <View style={s.hubCardIcon}>
          <Ionicons name="calendar-outline" size={22} color={colors.brand[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hubCardLabel}>Depósitos automáticos</Text>
          <Text style={s.hubCardDesc}>Programá depósitos regulares y automáticos</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      {/* Direct deposit */}
      <Pressable style={s.hubCard} onPress={() => setScreen("directDeposit")}>
        <View style={s.hubCardIcon}>
          <Ionicons name="wallet-outline" size={22} color={colors.brand[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hubCardLabel}>Depósito directo</Text>
          <Text style={s.hubCardDesc}>Configurá la acreditación de tu sueldo</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      <View style={s.thickDivider} />

      {/* Wire transfer */}
      <Pressable style={s.hubCard}>
        <View style={s.hubCardIcon}>
          <Ionicons name="globe-outline" size={22} color={colors.brand[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hubCardLabel}>Transferencia internacional</Text>
          <Text style={s.hubCardDesc}>Enviá o recibí fondos del exterior</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      {/* Convert */}
      <Pressable style={s.hubCard}>
        <View style={s.hubCardIcon}>
          <Ionicons name="swap-horizontal-outline" size={22} color={colors.brand[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.hubCardLabel}>Convertir moneda</Text>
          <Text style={s.hubCardDesc}>Cambiá entre ARS, USD MEP y dólar cable</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>
    </ScrollView>
  );

  /* ════════════════════════════════════════
     AMOUNT ENTRY
     ════════════════════════════════════════ */
  const renderAmount = () => (
    <View style={[s.fullScreen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.amountHeader}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={s.amountHeaderTitle}>Transferir dinero</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Amount display */}
      <View style={s.amountDisplay}>
        <View style={s.amountRow}>
          <Text style={s.amountSign}>$</Text>
          <Text style={s.amountValue}>
            {amount === "0" ? "0" : Number(amount).toLocaleString("es-AR")}
          </Text>
        </View>
      </View>

      {/* From / To */}
      <View style={s.accountSection}>
        <Pressable style={s.accountRow}>
          <Text style={s.accountLabel}>Desde</Text>
          <View style={s.accountRight}>
            <Text style={s.accountName}>
              {mode === "deposit" ? `${BANK_NAME} · CBU ${BANK_CBU}` : `Álamos · ${formatARS(BALANCE)}`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </View>
        </Pressable>
        <View style={s.accountDivider} />
        <Pressable style={s.accountRow}>
          <Text style={s.accountLabel}>Hacia</Text>
          <View style={s.accountRight}>
            <Text style={s.accountName}>
              {mode === "deposit" ? `Álamos · ${formatARS(BALANCE)}` : `${BANK_NAME} · CBU ${BANK_CBU}`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </View>
        </Pressable>
      </View>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Bottom area */}
      <View style={[s.bottomArea, { paddingBottom: insets.bottom + 8 }]}>
        {exceedsMax && (
          <Text style={s.errorText}>El monto supera tu saldo disponible</Text>
        )}

        {/* Review button */}
        <Pressable
          style={[s.reviewBtn, (!hasAmount || exceedsMax) && s.reviewBtnDisabled]}
          disabled={!hasAmount || exceedsMax}
          onPress={() => setScreen("review")}
        >
          <Text style={[s.reviewBtnText, (!hasAmount || exceedsMax) && s.reviewBtnTextDisabled]}>
            Revisar
          </Text>
        </Pressable>

        {/* Numpad */}
        <View style={s.numpad}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            [".", "0", "back"],
          ].map((row, ri) => (
            <View key={ri} style={s.numpadRow}>
              {row.map((key) => (
                <Pressable key={key} style={s.numpadKey} onPress={() => handleKey(key)}>
                  {key === "back" ? (
                    <Ionicons name="backspace-outline" size={26} color={colors.text.primary} />
                  ) : (
                    <Text style={s.numpadKeyText}>{key}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  /* ════════════════════════════════════════
     REVIEW
     ════════════════════════════════════════ */
  const renderReview = () => (
    <View style={[s.fullScreen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.amountHeader}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={s.amountHeaderTitle}>Transferir dinero</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Amount */}
      <View style={s.reviewAmountArea}>
        <View style={s.amountRow}>
          <Text style={s.reviewAmountSign}>$</Text>
          <Text style={s.reviewAmountValue}>
            {Number(amount).toLocaleString("es-AR")}
          </Text>
        </View>
        <Pressable onPress={() => setScreen("amount")}>
          <Text style={s.editLink}>Editar</Text>
        </Pressable>
      </View>

      {/* Details */}
      <View style={s.reviewDetails}>
        <Pressable style={s.reviewRow}>
          <Text style={s.reviewLabel}>Desde</Text>
          <View style={s.reviewRowRight}>
            <Text style={s.reviewValue}>
              {mode === "deposit" ? `${BANK_NAME} · CBU ${BANK_CBU}` : "Álamos"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </View>
        </Pressable>
        <View style={s.reviewDivider} />
        <Pressable style={s.reviewRow}>
          <Text style={s.reviewLabel}>Hacia</Text>
          <View style={s.reviewRowRight}>
            <Text style={s.reviewValue}>
              {mode === "deposit" ? "Álamos" : `${BANK_NAME} · CBU ${BANK_CBU}`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </View>
        </Pressable>
        <View style={s.reviewDivider} />
        <Pressable style={s.reviewRow} onPress={() => setShowFreqModal(true)}>
          <Text style={s.reviewLabel}>Frecuencia</Text>
          <View style={s.reviewRowRight}>
            <Text style={s.reviewValue}>{freqLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </View>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />

      {/* Disclaimer + Submit */}
      <View style={[s.reviewBottom, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={s.disclaimerText}>
          {mode === "deposit"
            ? `Se debitarán ${formatARS(numericAmount)} de tu cuenta bancaria en los próximos días hábiles. La acreditación puede demorar hasta 2 días hábiles.`
            : `Se transferirán ${formatARS(numericAmount)} a tu cuenta bancaria. La acreditación puede demorar hasta 2 días hábiles.`}
        </Text>

        <Pressable
          style={s.submitBtn}
          onPress={() => setScreen("success")}
        >
          <Text style={s.submitBtnText}>
            {mode === "deposit" ? "Depositar" : "Retirar"} {formatARS(numericAmount)}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  /* ════════════════════════════════════════
     SUCCESS TIMELINE
     ════════════════════════════════════════ */
  const renderSuccess = () => {
    const isDeposit = mode === "deposit";
    const today = new Date();
    const d2 = new Date(today); d2.setDate(d2.getDate() + 3);
    const d3 = new Date(today); d3.setDate(d3.getDate() + 3);

    const fmtDate = (d: Date) =>
      d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });

    const steps = [
      {
        label: isDeposit ? "Depósito iniciado" : "Retiro iniciado",
        date: `${fmtDate(today)} · Hoy`,
        done: true,
      },
      {
        label: isDeposit ? "Depósito completado" : "Retiro completado",
        date: `${fmtDate(d2)} · Disponible para operar`,
        done: false,
      },
      {
        label: "Comienza a generar intereses",
        date: `${fmtDate(d3)} · Efectivo barrido a bancos`,
        done: false,
      },
    ];

    return (
      <View style={[s.fullScreen, { paddingTop: insets.top + 20 }]}>
        <View style={s.successContent}>
          <Text style={s.successTitle}>
            {isDeposit ? "Depósito iniciado" : "Retiro iniciado"}
          </Text>
          <Text style={s.successAmount}>+{formatARS(numericAmount)}</Text>
          <Text style={s.successBank}>{BANK_NAME} {BANK_CBU}</Text>

          {/* Timeline */}
          <View style={s.timeline}>
            {steps.map((step, i) => (
              <View key={i} style={s.timelineRow}>
                {/* Dot + line */}
                <View style={s.timelineDotCol}>
                  <View style={[s.timelineDot, step.done && s.timelineDotDone]}>
                    {step.done && (
                      <Ionicons name="checkmark" size={12} color={colors.surface[0]} />
                    )}
                  </View>
                  {i < steps.length - 1 && <View style={s.timelineLine} />}
                </View>
                {/* Text */}
                <View style={s.timelineText}>
                  <Text style={[s.timelineLabel, step.done && s.timelineLabelDone]}>
                    {step.label}
                  </Text>
                  <Text style={s.timelineDate}>{step.date}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={[s.successBottom, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.disclaimerText}>
            Asegurate de mantener un saldo de {formatARS(numericAmount)} en tu cuenta bancaria hasta que se debiten los fondos.
          </Text>
          <Pressable style={s.submitBtn} onPress={resetFlow}>
            <Text style={s.submitBtnText}>Continuar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  /* ════════════════════════════════════════
     AUTO DEPOSITS SETUP
     ════════════════════════════════════════ */
  const renderAutoSetup = () => (
    <View style={[s.fullScreen, { paddingTop: insets.top }]}>
      <View style={s.amountHeader}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={{ width: 24 }} />
        <View style={{ width: 24 }} />
      </View>

      <View style={s.autoSetupContent}>
        {/* Calendar icon */}
        <View style={s.autoIconArea}>
          <View style={s.autoCalendar}>
            <View style={s.autoCalendarHeader}>
              <View style={s.autoCalendarDot} />
              <View style={s.autoCalendarDot} />
            </View>
            <View style={s.autoCalendarGrid}>
              {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={s.autoCalendarCell} />
              ))}
            </View>
          </View>
        </View>

        <Text style={s.autoTitle}>Depósitos automáticos</Text>
        <Text style={s.autoDesc}>
          Programá depósitos regulares y automáticos a tu cuenta de Álamos.
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={[s.autoBottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={s.greenBtn} onPress={() => setScreen("schedule")}>
          <Text style={s.greenBtnText}>Configurar depósito automático</Text>
        </Pressable>
      </View>
    </View>
  );

  /* ════════════════════════════════════════
     SCHEDULE PICKER
     ════════════════════════════════════════ */
  const renderSchedule = () => (
    <View style={[s.fullScreen, { paddingTop: insets.top }]}>
      <View style={s.amountHeader}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
        </Pressable>
        <Text style={s.amountHeaderTitle}>Frecuencia</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={s.scheduleQuestion}>¿Con qué frecuencia querés hacer este depósito?</Text>

      {/* Frequency options */}
      <View style={s.freqList}>
        {FREQUENCIES.filter(f => f.key !== "once").map((f) => (
          <Pressable
            key={f.key}
            style={[s.freqOption, selectedFreq === f.key && s.freqOptionActive]}
            onPress={() => setSelectedFreq(f.key)}
          >
            <Text style={[s.freqOptionLabel, selectedFreq === f.key && s.freqOptionLabelActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <View style={[s.scheduleBottom, { paddingBottom: insets.bottom + 16 }]}>
        {selectedFreq && (
          <Text style={s.scheduleInfo}>
            {FREQUENCIES.find(f => f.key === selectedFreq)?.desc || ""}
          </Text>
        )}
        <Pressable
          style={s.greenBtn}
          onPress={() => {
            setAutoFreq(selectedFreq);
            setScreen("autoAmount");
          }}
        >
          <Text style={s.greenBtnText}>Configurar frecuencia</Text>
        </Pressable>
      </View>
    </View>
  );

  /* ════════════════════════════════════════
     AUTO AMOUNT ENTRY
     ════════════════════════════════════════ */
  const renderAutoAmount = () => {
    const autoFreqLabel = FREQUENCIES.find(f => f.key === autoFreq)?.label?.toUpperCase() || "";
    return (
      <View style={[s.fullScreen, { paddingTop: insets.top }]}>
        <View style={s.amountHeader}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
          </Pressable>
          <Text style={s.amountHeaderTitle}>Transferir a Álamos</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={s.autoAmountArea}>
          {/* Bank info */}
          <View style={s.autoAmountBankRow}>
            <Text style={s.autoAmountBank}>{BANK_NAME}</Text>
            <Text style={s.autoAmountCBU}>CBU {BANK_CBU}</Text>
            <Pressable>
              <Text style={s.changeBankLink}>Cambiar banco</Text>
            </Pressable>
          </View>

          {/* Amount */}
          <Text style={s.autoAmountValue}>
            ${amount === "0" ? "0,00" : Number(amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </Text>

          {/* Frequency badge */}
          <View style={s.autoFreqBadge}>
            <Ionicons name="sync-outline" size={14} color={colors.text.secondary} />
            <Text style={s.autoFreqBadgeText}>AUTOMÁTICO ({autoFreqLabel})</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Numpad */}
        <View style={[s.bottomArea, { paddingBottom: insets.bottom + 8 }]}>
          {hasAmount && (
            <Pressable style={s.greenBtn} onPress={resetFlow}>
              <Text style={s.greenBtnText}>Confirmar depósito automático</Text>
            </Pressable>
          )}

          <View style={s.numpad}>
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
              [".", "0", "back"],
            ].map((row, ri) => (
              <View key={ri} style={s.numpadRow}>
                {row.map((key) => (
                  <Pressable key={key} style={s.numpadKey} onPress={() => handleKey(key)}>
                    {key === "back" ? (
                      <Ionicons name="backspace-outline" size={26} color={colors.brand[500]} />
                    ) : (
                      <Text style={s.numpadKeyGreen}>{key}</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  /* ════════════════════════════════════════
     DIRECT DEPOSIT
     ════════════════════════════════════════ */
  const renderDirectDeposit = () => (
    <View style={[s.fullScreen, { paddingTop: insets.top }]}>
      <View style={s.amountHeader}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={{ width: 24 }} />
        <View style={{ width: 24 }} />
      </View>

      {/* Hero illustration area */}
      <View style={s.directHero}>
        <View style={s.directHeroIcon}>
          <Ionicons name="lock-closed" size={32} color={colors.brand[500]} />
          <View style={[s.directHeroCoin, { top: -10, right: -20 }]}>
            <Ionicons name="card-outline" size={16} color="#FFD54F" />
          </View>
        </View>
      </View>

      <View style={s.directContent}>
        <Text style={s.directTitle}>Configurar depósito directo</Text>

        {/* Benefits */}
        <View style={s.directBenefit}>
          <Ionicons name="flash" size={18} color={colors.brand[500]} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.directBenefitTitle}>Tu dinero seguro</Text>
            <Text style={s.directBenefitDesc}>
              Protegido con seguridad y encriptación estándar de la industria.{" "}
              <Text style={{ color: colors.brand[500], fontWeight: "600" }}>Más información</Text>
            </Text>
          </View>
        </View>

        <View style={s.directBenefit}>
          <Ionicons name="flash" size={18} color={colors.brand[500]} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.directBenefitTitle}>Generá intereses</Text>
            <Text style={s.directBenefitDesc}>
              Tu efectivo no invertido genera hasta 65% TNA en bancos del programa.{" "}
              <Text style={{ color: colors.brand[500], fontWeight: "600" }}>Divulgación TNA</Text>
            </Text>
          </View>
        </View>

        <View style={s.directBenefit}>
          <Ionicons name="flash" size={18} color={colors.brand[500]} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.directBenefitTitle}>Dividí tu sueldo</Text>
            <Text style={s.directBenefitDesc}>
              Elegí qué porcentaje de tu sueldo querés depositar directamente.
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <View style={[s.directBottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={s.submitBtn} onPress={() => setScreen("directOptions")}>
          <Text style={s.submitBtnText}>Continuar</Text>
        </Pressable>
      </View>
    </View>
  );

  /* ════════════════════════════════════════
     DIRECT DEPOSIT OPTIONS
     ════════════════════════════════════════ */
  const renderDirectOptions = () => (
    <View style={[s.fullScreen, { paddingTop: insets.top }]}>
      <View style={s.amountHeader}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
        </Pressable>
        <View style={{ width: 26 }} />
        <View style={{ width: 26 }} />
      </View>

      <View style={s.directOptionsContent}>
        <Text style={s.directOptionsTitle}>
          ¿Cómo querés configurar tu depósito directo?
        </Text>

        <Pressable style={s.directOptionRow}>
          <View style={s.directOptionIcon}>
            <Ionicons name="business-outline" size={22} color={colors.text.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.directOptionLabel}>Usar CBU/CVU</Text>
            <Text style={s.directOptionDesc}>
              Encontrá los datos de tu cuenta para ingresar en tu empleador o sistema de nómina.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </Pressable>

        <Pressable style={s.directOptionRow}>
          <View style={s.directOptionIcon}>
            <Ionicons name="document-text-outline" size={22} color={colors.text.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.directOptionLabel}>Enviar formulario a RRHH</Text>
            <Text style={s.directOptionDesc}>
              Obtené un formulario prellenado con los datos de tu cuenta.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </Pressable>

        <Pressable style={s.directOptionRow}>
          <View style={s.directOptionIcon}>
            <Ionicons name="flash-outline" size={22} color={colors.text.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.directOptionLabel}>Configurar a través de Álamos</Text>
            <Text style={s.directOptionDesc}>
              Álamos puede configurar tu depósito directo automáticamente en minutos.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </Pressable>
      </View>
    </View>
  );

  /* ── Screen router ── */
  const renderScreen = () => {
    switch (screen) {
      case "hub": return renderHub();
      case "amount": return renderAmount();
      case "review": return renderReview();
      case "success": return renderSuccess();
      case "autoSetup": return renderAutoSetup();
      case "schedule": return renderSchedule();
      case "autoAmount": return renderAutoAmount();
      case "directDeposit": return renderDirectDeposit();
      case "directOptions": return renderDirectOptions();
    }
  };

  return (
    <View style={s.container}>
      {renderScreen()}

      {/* ═══ Frequency modal ═══ */}
      <Modal
        visible={showFreqModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFreqModal(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowFreqModal(false)} />
        <View style={[s.freqSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.freqSheetHeader}>
            <Pressable onPress={() => setShowFreqModal(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </Pressable>
          </View>

          <Text style={s.freqSheetTitle}>Elegí la frecuencia</Text>

          {FREQUENCIES.map((f) => (
            <Pressable
              key={f.key}
              style={s.freqSheetOption}
              onPress={() => {
                setFrequency(f.key);
                setShowFreqModal(false);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.freqSheetLabel}>{f.label}</Text>
                {f.desc ? <Text style={s.freqSheetDesc}>{f.desc}</Text> : null}
              </View>
              <View style={[s.radio, frequency === f.key && s.radioActive]}>
                {frequency === f.key && <View style={s.radioDot} />}
              </View>
            </Pressable>
          ))}

          <Pressable style={s.freqSheetBtn} onPress={() => setShowFreqModal(false)}>
            <Text style={s.freqSheetBtnText}>Continuar</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  fullScreen: { flex: 1, backgroundColor: colors.surface[0] },

  /* Hub */
  topNav: { paddingHorizontal: 20, paddingBottom: 16 },
  hubTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  hubCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hubCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  hubCardLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 3,
  },
  hubCardDesc: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  thickDivider: {
    height: 6,
    backgroundColor: colors.surface[100],
  },

  /* Amount entry */
  amountHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  amountHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  amountDisplay: {
    alignItems: "center",
    paddingVertical: 30,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  amountSign: {
    fontSize: 32,
    fontWeight: "300",
    color: colors.text.secondary,
    marginTop: 12,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 72,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -2,
  },

  /* Account rows */
  accountSection: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
  },
  accountLabel: {
    fontSize: 13,
    color: colors.text.muted,
    width: 50,
  },
  accountRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.primary,
  },
  accountDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  /* Bottom area */
  bottomArea: {
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 13,
    color: colors.red,
    textAlign: "center",
    marginBottom: 8,
  },
  reviewBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  reviewBtnDisabled: {
    backgroundColor: colors.surface[200],
  },
  reviewBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface[0],
  },
  reviewBtnTextDisabled: {
    color: colors.text.muted,
  },

  /* Numpad */
  numpad: { gap: 4 },
  numpadRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  numpadKey: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  numpadKeyText: {
    fontSize: 28,
    fontWeight: "400",
    color: colors.text.primary,
  },
  numpadKeyGreen: {
    fontSize: 28,
    fontWeight: "400",
    color: colors.brand[500],
  },

  /* Review */
  reviewAmountArea: {
    alignItems: "center",
    paddingVertical: 24,
  },
  reviewAmountSign: {
    fontSize: 28,
    fontWeight: "300",
    color: colors.text.secondary,
    marginTop: 10,
    marginRight: 4,
  },
  reviewAmountValue: {
    fontSize: 64,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -2,
  },
  editLink: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 8,
  },
  reviewDetails: {
    paddingHorizontal: 20,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
  },
  reviewRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewLabel: {
    fontSize: 14,
    color: colors.text.muted,
  },
  reviewValue: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.primary,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  reviewBottom: {
    paddingHorizontal: 20,
  },
  disclaimerText: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  submitBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.surface[0],
  },

  /* Success timeline */
  successContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  successTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  successAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 4,
  },
  successBank: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
    marginBottom: 32,
  },
  successBottom: {
    paddingHorizontal: 20,
  },

  /* Timeline */
  timeline: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineDotCol: {
    alignItems: "center",
    width: 28,
    marginRight: 14,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotDone: {
    backgroundColor: colors.brand[500],
  },
  timelineLine: {
    width: 2,
    height: 40,
    backgroundColor: colors.surface[200],
    marginVertical: 4,
  },
  timelineText: {
    paddingBottom: 24,
    flex: 1,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text.secondary,
    marginBottom: 3,
  },
  timelineLabelDone: {
    color: colors.text.primary,
    fontWeight: "600",
  },
  timelineDate: {
    fontSize: 13,
    color: colors.text.muted,
  },

  /* Auto setup */
  autoSetupContent: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  autoIconArea: {
    marginBottom: 30,
  },
  autoCalendar: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: colors.brand[500],
    padding: 16,
    justifyContent: "space-between",
  },
  autoCalendarHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  autoCalendarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  autoCalendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  autoCalendarCell: {
    width: 22,
    height: 18,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  autoTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 10,
  },
  autoDesc: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },
  autoBottom: {
    paddingHorizontal: 20,
  },
  greenBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
  },
  greenBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.surface[0],
  },

  /* Schedule */
  scheduleQuestion: {
    fontSize: 16,
    color: colors.text.secondary,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 30,
  },
  freqList: {
    alignItems: "center",
    gap: 6,
  },
  freqOption: {
    width: "80%",
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  freqOptionActive: {
    backgroundColor: colors.surface[200],
  },
  freqOptionLabel: {
    fontSize: 20,
    fontWeight: "500",
    color: colors.text.muted,
  },
  freqOptionLabelActive: {
    fontWeight: "700",
    color: colors.text.primary,
    fontSize: 22,
  },
  scheduleBottom: {
    paddingHorizontal: 20,
  },
  scheduleInfo: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 16,
  },

  /* Auto amount */
  autoAmountArea: {
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  autoAmountBankRow: {
    alignItems: "flex-end",
  },
  autoAmountBank: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  autoAmountCBU: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  changeBankLink: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand[500],
    marginTop: 4,
  },
  autoAmountValue: {
    fontSize: 36,
    fontWeight: "300",
    color: colors.text.secondary,
    marginTop: 20,
    marginBottom: 12,
  },
  autoFreqBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  autoFreqBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },

  /* Direct deposit */
  directHero: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  directHeroIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  directHeroCoin: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  directContent: {
    paddingHorizontal: 20,
  },
  directTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 24,
    textAlign: "center",
  },
  directBenefit: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  directBenefitTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 4,
  },
  directBenefitDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  directBottom: {
    paddingHorizontal: 20,
  },

  /* Direct options */
  directOptionsContent: {
    paddingHorizontal: 20,
  },
  directOptionsTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 24,
  },
  directOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  directOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
  },
  directOptionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 4,
  },
  directOptionDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  /* Overlay */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  /* Frequency modal sheet */
  freqSheet: {
    backgroundColor: colors.surface[0],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  freqSheetHeader: {
    marginBottom: 16,
  },
  freqSheetTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  freqSheetOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  freqSheetLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
  freqSheetDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  freqSheetBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  freqSheetBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* Radio */
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.text.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.text.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.primary,
  },
});
