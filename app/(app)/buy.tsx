import { useState } from "react";
import {
  View, Text, Pressable, Modal, StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";

const AVAILABLE = 342180;

export default function BuyScreen() {
  const { ticker, mode } = useLocalSearchParams<{ ticker: string; mode?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isSell = mode === "sell";
  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset) return null;

  const heldValue = asset.held ? asset.price * (asset.qty || 1) : 0;
  const available = isSell ? heldValue : AVAILABLE;

  const [amount, setAmount] = useState("0");
  const [showFreq, setShowFreq] = useState(false);
  const [frequency, setFrequency] = useState("once");

  const numericAmount = parseFloat(amount) || 0;
  const hasAmount = numericAmount > 0;
  const exceedsAvailable = numericAmount > available;

  /* Quick amount suggestions */
  const quickAmounts = isSell
    ? [
        { label: formatARS(Math.round(available * 0.25)), value: Math.round(available * 0.25) },
        { label: formatARS(Math.round(available * 0.5)), value: Math.round(available * 0.5) },
        { label: "Vender todo", value: available },
      ]
    : [
        { label: formatARS(1000), value: 1000 },
        { label: formatARS(10000), value: 10000 },
        { label: formatARS(100000), value: 100000 },
      ];

  const freqLabels: Record<string, string> = {
    once: "Una vez",
    daily: "Diario",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
  };

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

  const handleQuick = (value: number) => {
    setAmount(String(value));
  };

  const handleReview = () => {
    router.push({
      pathname: "/(app)/confirm",
      params: {
        ticker: asset.ticker,
        amount: String(numericAmount),
        mode: isSell ? "sell" : "buy",
        frequency,
      },
    });
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <Pressable style={s.currencyBtn}>
          <Text style={s.currencyText}>ARS</Text>
          <Ionicons name="chevron-down" size={14} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* ── Amount display ── */}
      <View style={s.amountArea}>
        <View style={s.amountRow}>
          <Text style={s.amountSign}>$</Text>
          <Text style={s.amountValue}>{amount === "0" ? "0" : Number(amount).toLocaleString("es-AR")}</Text>
        </View>

        {/* Frequency picker */}
        {!isSell && (
          <Pressable style={s.freqPill} onPress={() => setShowFreq(true)}>
            <Text style={s.freqText}>{freqLabels[frequency]}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.text.primary} />
          </Pressable>
        )}
      </View>

      {/* ── Bottom section ── */}
      <View style={[s.bottomSection, { paddingBottom: insets.bottom + 8 }]}>
        {/* Available */}
        <View style={s.availableRow}>
          <Text style={s.availableText}>
            {isSell ? "Tenés" : "Disponible"}: {formatARS(available)}
          </Text>
          <Pressable>
            <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
          </Pressable>
        </View>

        {/* Quick amounts or Review button */}
        {hasAmount && !exceedsAvailable ? (
          <Pressable style={s.reviewBtn} onPress={handleReview}>
            <Text style={s.reviewBtnText}>Revisar</Text>
          </Pressable>
        ) : (
          <View style={s.quickRow}>
            {quickAmounts.map((q) => (
              <Pressable
                key={q.label}
                style={s.quickBtn}
                onPress={() => handleQuick(q.value)}
              >
                <Text style={s.quickBtnText}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {exceedsAvailable && (
          <Text style={s.errorText}>El monto supera tu saldo disponible</Text>
        )}

        {/* Number pad */}
        <View style={s.numpad}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            [".", "0", "back"],
          ].map((row, ri) => (
            <View key={ri} style={s.numpadRow}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  style={s.numpadKey}
                  onPress={() => handleKey(key)}
                >
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

      {/* ── Frequency modal ── */}
      <Modal
        visible={showFreq}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFreq(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowFreq(false)} />
        <View style={[s.freqSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.freqSheetHeader}>
            <Pressable onPress={() => setShowFreq(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </Pressable>
          </View>

          <Text style={s.freqSheetTitle}>Elegí la frecuencia</Text>
          <Text style={s.freqSheetSub}>Empieza el próximo día hábil</Text>

          {[
            { key: "once", label: "Una vez", desc: "" },
            { key: "daily", label: "Todos los días", desc: "Lunes a viernes" },
            { key: "weekly", label: "Cada semana", desc: "Los lunes" },
            { key: "biweekly", label: "Cada dos semanas", desc: "Los lunes" },
            { key: "monthly", label: "Cada mes", desc: "El día 1" },
          ].map((opt) => (
            <Pressable
              key={opt.key}
              style={s.freqOption}
              onPress={() => {
                setFrequency(opt.key);
                setShowFreq(false);
              }}
            >
              <View style={s.freqOptionInfo}>
                <Text style={s.freqOptionLabel}>{opt.label}</Text>
                {opt.desc ? <Text style={s.freqOptionDesc}>{opt.desc}</Text> : null}
              </View>
              <View style={[s.freqRadio, frequency === opt.key && s.freqRadioActive]}>
                {frequency === opt.key && <View style={s.freqRadioDot} />}
              </View>
            </Pressable>
          ))}

          <Pressable
            style={[s.freqContinueBtn, { opacity: 1 }]}
            onPress={() => setShowFreq(false)}
          >
            <Text style={s.freqContinueText}>Continuar</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  currencyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  currencyText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* Amount */
  amountArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
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
  freqPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface[200],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  freqText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Bottom */
  bottomSection: {
    paddingHorizontal: 20,
  },
  availableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 14,
  },
  availableText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorText: {
    fontSize: 13,
    color: colors.red,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },

  /* Quick amounts */
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Review button */
  reviewBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  reviewBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface[0],
  },

  /* Numpad */
  numpad: {
    gap: 4,
  },
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

  /* Overlay */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  /* Frequency sheet */
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
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  freqSheetSub: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 24,
  },
  freqOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  freqOptionInfo: {},
  freqOptionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
  freqOptionDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  freqRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.text.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  freqRadioActive: {
    borderColor: colors.text.primary,
  },
  freqRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.primary,
  },
  freqContinueBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  freqContinueText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
});
