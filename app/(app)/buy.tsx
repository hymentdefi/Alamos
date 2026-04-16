import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { assets, formatARS } from "../../lib/data/assets";
import { useTheme } from "../../lib/theme";

const AVAILABLE_CASH = 342180;

const recurringOptions = [
  { key: "once", label: "Una vez", hint: "Compra unica" },
  { key: "weekly", label: "Semanal", hint: "Todos los lunes" },
  { key: "monthly", label: "Mensual", hint: "El dia 1" },
] as const;

export default function BuyScreen() {
  const { ticker, mode } = useLocalSearchParams<{ ticker: string; mode?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const asset = assets.find((item) => item.ticker === ticker);
  const isSell = mode === "sell";

  const [amount, setAmount] = useState("0");
  const [frequency, setFrequency] = useState<(typeof recurringOptions)[number]["key"]>("once");
  const [showFrequency, setShowFrequency] = useState(false);

  if (!asset) return null;

  const available = isSell ? asset.price * (asset.qty || 0) : AVAILABLE_CASH;
  const parsedAmount = Number.parseFloat(amount) || 0;
  const hasAmount = parsedAmount > 0;
  const exceedsAvailable = parsedAmount > available;
  const estimatedUnits = parsedAmount > 0 ? parsedAmount / asset.price : 0;

  const quickAmounts = isSell
    ? [
        { label: "25%", value: Math.round(available * 0.25) },
        { label: "50%", value: Math.round(available * 0.5) },
        { label: "Todo", value: Math.round(available) },
      ]
    : [
        { label: formatARS(5000), value: 5000 },
        { label: formatARS(20000), value: 20000 },
        { label: formatARS(100000), value: 100000 },
      ];

  const selectedFrequency = recurringOptions.find((option) => option.key === frequency);
  const primaryColor = isSell ? c.red : c.green;

  const handleKey = (key: string) => {
    if (key === "back") {
      setAmount((previous) => {
        const next = previous.slice(0, -1);
        return next.length === 0 ? "0" : next;
      });
      return;
    }

    if (key === ".") {
      if (amount.includes(".")) return;
      setAmount((previous) => previous + ".");
      return;
    }

    setAmount((previous) => {
      if (previous === "0") return key;
      if (previous.includes(".") && previous.split(".")[1].length >= 2) return previous;
      return previous + key;
    });
  };

  const handleContinue = () => {
    if (!hasAmount || exceedsAvailable) return;

    router.push({
      pathname: "/(app)/confirm",
      params: {
        ticker: asset.ticker,
        amount: String(parsedAmount),
        mode: isSell ? "sell" : "buy",
        frequency,
      },
    });
  };

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <View
        style={[
          s.fixedTop,
          {
            backgroundColor: c.bg,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <View style={s.header}>
          <Pressable
            style={[s.headerIcon, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={20} color={c.text} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={[s.headerTitle, { color: c.text }]}>
              {isSell ? "Vender" : "Comprar"} {asset.ticker}
            </Text>
            <Text style={[s.headerSubtitle, { color: c.textSecondary }]}>{asset.name}</Text>
          </View>
          <View style={s.headerGhost} />
        </View>
      </View>

      <View style={[s.content, { paddingTop: insets.top + 88, paddingBottom: insets.bottom + 12 }]}>
        <View style={s.hero}>
          <Text style={[s.heroLabel, { color: c.textSecondary }]}>
            {isSell ? "Cuanto queres vender" : "Cuanto queres invertir"}
          </Text>
          <View style={s.amountRow}>
            <Text style={[s.amountSign, { color: c.textMuted }]}>$</Text>
            <Text style={[s.amountValue, { color: c.text }]}>
              {amount === "0" ? "0" : Number(amount).toLocaleString("es-AR")}
            </Text>
          </View>
          <Text style={[s.estimate, { color: c.textSecondary }]}>
            {hasAmount ? `≈ ${estimatedUnits.toFixed(4)} unidades` : "Elegi un monto en pesos"}
          </Text>
        </View>

        <View style={s.chipsRow}>
          {quickAmounts.map((option) => (
            <Pressable
              key={option.label}
              style={[s.quickChip, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}
              onPress={() => setAmount(String(option.value))}
            >
              <Text style={[s.quickChipText, { color: c.text }]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {!isSell ? (
          <Pressable
            style={[s.frequencyRow, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}
            onPress={() => setShowFrequency(true)}
          >
            <View>
              <Text style={[s.frequencyLabel, { color: c.textSecondary }]}>Frecuencia</Text>
              <Text style={[s.frequencyValue, { color: c.text }]}>{selectedFrequency?.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>
        ) : null}

        <View style={[s.summaryCard, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
          <View style={[s.summaryRow, { borderBottomColor: c.border }]}>
            <Text style={[s.summaryLabel, { color: c.textSecondary }]}>
              {isSell ? "Tenes disponible" : "Disponible para invertir"}
            </Text>
            <Text style={[s.summaryValue, { color: c.text }]}>{formatARS(available)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={[s.summaryLabel, { color: c.textSecondary }]}>Precio estimado</Text>
            <Text style={[s.summaryValue, { color: c.text }]}>{formatARS(asset.price)}</Text>
          </View>
        </View>

        {exceedsAvailable ? (
          <Text style={[s.errorText, { color: c.red }]}>
            El monto supera lo que tenes disponible.
          </Text>
        ) : null}

        <View style={s.keypad}>
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            [".", "0", "back"],
          ].map((row, rowIndex) => (
            <View key={rowIndex} style={s.keypadRow}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  style={s.keypadKey}
                  onPress={() => handleKey(key)}
                >
                  {key === "back" ? (
                    <Ionicons name="backspace-outline" size={24} color={c.text} />
                  ) : (
                    <Text style={[s.keypadKeyText, { color: c.text }]}>{key}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        <View style={s.footer}>
          <Pressable
            style={[
              s.continueButton,
              {
                backgroundColor: hasAmount && !exceedsAvailable ? primaryColor : c.surfaceHover,
              },
            ]}
            onPress={handleContinue}
            disabled={!hasAmount || exceedsAvailable}
          >
            <Text
              style={[
                s.continueButtonText,
                { color: hasAmount && !exceedsAvailable ? "#000000" : c.textMuted },
              ]}
            >
              Revisar
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showFrequency}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFrequency(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowFrequency(false)} />
        <View
          style={[
            s.sheet,
            {
              backgroundColor: c.surfaceRaised,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <Text style={[s.sheetTitle, { color: c.text }]}>Elegi la frecuencia</Text>
          {recurringOptions.map((option) => {
            const isActive = option.key === frequency;
            return (
              <Pressable
                key={option.key}
                style={[s.sheetOption, { borderBottomColor: c.border }]}
                onPress={() => {
                  setFrequency(option.key);
                  setShowFrequency(false);
                }}
              >
                <View>
                  <Text style={[s.sheetOptionTitle, { color: c.text }]}>{option.label}</Text>
                  <Text style={[s.sheetOptionHint, { color: c.textSecondary }]}>{option.hint}</Text>
                </View>
                <View
                  style={[
                    s.radio,
                    { borderColor: isActive ? c.green : c.border, backgroundColor: isActive ? c.green : "transparent" },
                  ]}
                />
              </Pressable>
            );
          })}
          <Pressable style={s.sheetClose} onPress={() => setShowFrequency(false)}>
            <Ionicons name="close" size={22} color={c.text} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerGhost: {
    width: 38,
    height: 38,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  hero: {
    alignItems: "center",
    marginTop: 16,
  },
  heroLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  amountSign: {
    fontSize: 34,
    marginTop: 12,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 68,
    fontWeight: "800",
    letterSpacing: -2.2,
  },
  estimate: {
    fontSize: 14,
    marginTop: 8,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
    marginBottom: 14,
  },
  quickChip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  frequencyRow: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  frequencyLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  frequencyValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
  keypad: {
    marginTop: 18,
    gap: 6,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  keypadKey: {
    width: "33%",
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  keypadKeyText: {
    fontSize: 30,
    fontWeight: "500",
  },
  footer: {
    marginTop: "auto",
    paddingTop: 8,
  },
  continueButton: {
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sheetOptionHint: {
    fontSize: 13,
    marginTop: 4,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  sheetClose: {
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    marginTop: 6,
  },
});
