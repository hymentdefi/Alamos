import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import { formatARS } from "../../lib/data/assets";

const BALANCE = 342180;
const BANK = {
  name: "Banco Galicia",
  accountNumber: "Caja de ahorro en $ · ••••3847",
  alias: "alamos.martin.garcia",
  cbu: "0070•••••••••••••3847",
};

type Screen = "hub" | "deposit" | "withdraw";

export default function TransferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [screen, setScreen] = useState<Screen>("hub");

  if (screen !== "hub") {
    return (
      <AmountFlow
        mode={screen}
        onBack={() => setScreen("hub")}
      />
    );
  }

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Transferencias</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.balanceBlock}>
          <Text style={[s.balanceLabel, { color: c.textMuted }]}>
            Efectivo disponible
          </Text>
          <Text style={[s.balanceValue, { color: c.text }]}>
            {formatARS(BALANCE)}
          </Text>
        </View>

        <View style={s.actionsRow}>
          <ActionCard
            icon="arrow-down-left"
            label="Ingresar"
            hint="Desde tu banco"
            onPress={() => setScreen("deposit")}
          />
          <ActionCard
            icon="arrow-up-right"
            label="Extraer"
            hint="A tu banco"
            onPress={() => setScreen("withdraw")}
          />
        </View>

        <View style={s.bankBlock}>
          <Text style={[s.eyebrow, { color: c.textMuted }]}>
            Cuenta bancaria vinculada
          </Text>

          <View
            style={[
              s.bankCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={s.bankHead}>
              <View style={[s.bankIcon, { backgroundColor: c.surfaceHover }]}>
                <Feather name="home" size={16} color={c.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.bankName, { color: c.text }]}>{BANK.name}</Text>
                <Text style={[s.bankSub, { color: c.textMuted }]}>
                  {BANK.accountNumber}
                </Text>
              </View>
            </View>

            <View style={[s.bankDivider, { backgroundColor: c.border }]} />

            <View style={s.bankRow}>
              <Text style={[s.bankRowLabel, { color: c.textMuted }]}>Alias</Text>
              <Text style={[s.bankRowValue, { color: c.text }]}>
                {BANK.alias}
              </Text>
            </View>
            <View style={s.bankRow}>
              <Text style={[s.bankRowLabel, { color: c.textMuted }]}>CBU</Text>
              <Text style={[s.bankRowValue, { color: c.text }]}>{BANK.cbu}</Text>
            </View>
          </View>

          <Pressable style={s.manageBank}>
            <Feather name="plus" size={14} color={c.text} />
            <Text style={[s.manageBankText, { color: c.text }]}>
              Agregar otra cuenta
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            s.noteCard,
            { backgroundColor: c.surfaceHover, borderColor: c.border },
          ]}
        >
          <Feather name="clock" size={14} color={c.textSecondary} />
          <Text style={[s.noteText, { color: c.textSecondary }]}>
            Los ingresos acreditan de inmediato. Las extracciones demoran hasta 24hs
            hábiles.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ActionCard({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.actionCard,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={[s.actionIcon, { backgroundColor: c.greenDim }]}>
        <Feather name={icon} size={18} color={c.greenDark} />
      </View>
      <Text style={[s.actionLabel, { color: c.text }]}>{label}</Text>
      <Text style={[s.actionHint, { color: c.textMuted }]}>{hint}</Text>
    </Pressable>
  );
}

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

function AmountFlow({
  mode,
  onBack,
}: {
  mode: "deposit" | "withdraw";
  onBack: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [amount, setAmount] = useState("0");
  const [sent, setSent] = useState(false);

  const isDeposit = mode === "deposit";
  const max = isDeposit ? Infinity : BALANCE;
  const parsed = Number.parseFloat(amount) || 0;
  const hasAmount = parsed > 0;
  const exceeds = parsed > max;

  const handleKey = (k: string) => {
    if (k === "back") {
      setAmount((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
      return;
    }
    if (k === ".") {
      if (amount.includes(".")) return;
      setAmount((p) => p + ".");
      return;
    }
    setAmount((p) => {
      if (p === "0") return k;
      if (p.includes(".") && p.split(".")[1].length >= 2) return p;
      return p + k;
    });
  };

  if (sent) {
    return (
      <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top + 24 }]}>
        <View style={s.successBlock}>
          <View style={[s.checkCircle, { backgroundColor: c.green }]}>
            <Feather name="check" size={32} color={c.ink} />
          </View>
          <Text style={[s.successTitle, { color: c.text }]}>
            {isDeposit ? "Ingreso en proceso" : "Extracción enviada"}
          </Text>
          <Text style={[s.successBody, { color: c.textMuted }]}>
            {isDeposit
              ? `Esperamos ${formatARS(parsed)} desde ${BANK.name}. Cuando el banco confirme, vas a ver el saldo acreditado.`
              : `Vamos a acreditar ${formatARS(parsed)} en ${BANK.name} dentro de las próximas 24hs hábiles.`}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={[{ paddingBottom: insets.bottom + 14, paddingHorizontal: 20 }]}>
          <Pressable
            style={[s.cta, { backgroundColor: c.ink }]}
            onPress={() => router.replace("/(app)")}
          >
            <Text style={[s.ctaText, { color: c.bg }]}>Volver al inicio</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={onBack}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.text }]}>
            {isDeposit ? "Ingresar dinero" : "Extraer dinero"}
          </Text>
          <Text style={[s.headerSub, { color: c.textMuted }]}>
            {isDeposit ? `Desde ${BANK.name}` : `Disponible ${formatARS(BALANCE)}`}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.amountSection}>
        <Text style={[s.amountLabel, { color: c.textMuted }]}>Monto</Text>
        <View style={s.amountRow}>
          <Text style={[s.amountSign, { color: c.textMuted }]}>$</Text>
          <Text
            style={[s.amountValue, { color: exceeds ? c.red : c.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {Number.parseFloat(amount || "0").toLocaleString("es-AR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
            {amount.endsWith(".") ? "," : ""}
          </Text>
        </View>
        <Text
          style={[s.amountHint, { color: exceeds ? c.red : c.textMuted }]}
        >
          {exceeds
            ? `Supera el disponible (${formatARS(max)})`
            : " "}
        </Text>
      </View>

      <View style={s.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.map((k) => (
              <Pressable
                key={k}
                onPress={() => handleKey(k)}
                style={s.keyBtn}
              >
                {k === "back" ? (
                  <Feather name="delete" size={22} color={c.text} />
                ) : (
                  <Text style={[s.keyText, { color: c.text }]}>{k}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={[{ paddingBottom: insets.bottom + 14, paddingHorizontal: 20 }]}>
        <Pressable
          style={[
            s.cta,
            {
              backgroundColor: hasAmount && !exceeds ? c.ink : c.surfaceHover,
            },
          ]}
          onPress={() => hasAmount && !exceeds && setSent(true)}
          disabled={!hasAmount || exceeds}
        >
          <Text
            style={[
              s.ctaText,
              { color: hasAmount && !exceeds ? c.bg : c.textMuted },
            ]}
          >
            {isDeposit ? "Confirmar ingreso" : "Confirmar extracción"}
          </Text>
        </Pressable>
      </View>
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
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 1,
  },
  balanceBlock: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  balanceLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  balanceValue: {
    fontFamily: fontFamily[700],
    fontSize: 42,
    letterSpacing: -1.8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
  },
  actionCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  actionHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  bankBlock: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  bankCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  bankHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  bankIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bankName: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  bankSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  bankDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  bankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  bankRowLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
  },
  bankRowValue: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  manageBank: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  manageBankText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.1,
  },

  /* Amount flow */
  amountSection: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 12,
  },
  amountLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 24,
  },
  amountSign: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    marginRight: 6,
  },
  amountValue: {
    fontFamily: fontFamily[700],
    fontSize: 58,
    letterSpacing: -2.4,
  },
  amountHint: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 8,
  },
  keypad: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  keyBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontFamily: fontFamily[600],
    fontSize: 26,
    letterSpacing: -0.5,
  },
  cta: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },

  /* Success */
  successBlock: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: fontFamily[700],
    fontSize: 26,
    letterSpacing: -1,
    textAlign: "center",
    marginBottom: 10,
  },
  successBody: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
  },
});
