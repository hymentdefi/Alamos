import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, fontMono, radius } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import { AccountFlag } from "../../lib/components/AccountFlag";
import {
  accounts,
  convertAmount,
  formatAccountBalance,
  rateBetween,
  type AccountId,
} from "../../lib/data/accounts";

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

function symbolFor(currency: "ARS" | "USD" | "USDT"): string {
  if (currency === "ARS") return "$";
  if (currency === "USD") return "US$";
  return "USDT";
}

/** Formatea el monto con el símbolo de la moneda y separadores AR. */
function formatAmount(value: number, currency: "ARS" | "USD" | "USDT"): string {
  const sym = symbolFor(currency);
  const num = value.toLocaleString("es-AR", {
    minimumFractionDigits: currency === "ARS" ? 0 : 2,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  });
  return currency === "USDT" ? `${sym} ${num}` : `${sym}${num}`;
}

/** El rate suele ser un número con muchos decimales — lo redondeamos
 *  según la moneda destino para que la chip sea legible. */
function formatRate(rate: number, toCurrency: "ARS" | "USD" | "USDT"): string {
  if (toCurrency === "ARS") {
    return rate.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  // Para USD/USDT mostramos hasta 6 decimales para que un rate
  // micro tipo 0.000833 (1 ARS → USD) se vea legible.
  return rate.toLocaleString("es-AR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export default function ConvertScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode } = useTheme();
  const isDark = mode === "dark";
  const badgeBacking = isDark ? "#1F1F1E" : "#FFFFFF";

  // Default: ARS → USD-AR (caso típico para usuarios argentinos).
  const [fromId, setFromId] = useState<AccountId>("ars-ar");
  const [toId, setToId] = useState<AccountId>("usd-ar");
  const [amount, setAmount] = useState("0");
  const [pickerSlot, setPickerSlot] = useState<null | "from" | "to">(null);

  const from = accounts.find((a) => a.id === fromId)!;
  const to = accounts.find((a) => a.id === toId)!;
  const numericAmount = Number(amount.replace(",", ".")) || 0;
  const received = convertAmount(numericAmount, from.currency, to.currency);
  const rate = rateBetween(from.currency, to.currency);
  const insufficient = numericAmount > from.balance;
  const canConfirm = numericAmount > 0 && !insufficient && fromId !== toId;

  const swap = () => {
    Haptics.selectionAsync().catch(() => {});
    setFromId(toId);
    setToId(fromId);
  };

  const onPickAccount = (id: AccountId) => {
    Haptics.selectionAsync().catch(() => {});
    if (pickerSlot === "from") {
      setFromId(id);
      // Si quedó igual al destino, movemos el destino a otra cuenta.
      if (id === toId) {
        setToId(accounts.find((a) => a.id !== id)!.id);
      }
    } else if (pickerSlot === "to") {
      setToId(id);
      if (id === fromId) {
        setFromId(accounts.find((a) => a.id !== id)!.id);
      }
    }
    setPickerSlot(null);
  };

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

  const onConfirm = () => {
    if (!canConfirm) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    Alert.alert(
      "Conversión enviada",
      `Vas a recibir ${formatAmount(received, to.currency)} en ${to.location}.`,
      [{ text: "Listo", onPress: () => router.back() }],
    );
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Convertir</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.body}>
        {/* FROM */}
        <CurrencyRow
          mode="from"
          accountId={from.id}
          currency={from.currency}
          balance={formatAccountBalance(from)}
          amountLabel={`- ${formatAmount(numericAmount, from.currency)}`}
          insufficient={insufficient}
          badgeBacking={badgeBacking}
          onPress={() => setPickerSlot("from")}
        />

        {/* SWAP + RATE */}
        <View style={s.middleRow}>
          <Pressable
            style={[s.swapBtn, { backgroundColor: c.action }]}
            onPress={swap}
            hitSlop={8}
          >
            <Feather name="arrow-down" size={20} color="#FFFFFF" />
          </Pressable>
          <View
            style={[
              s.ratePill,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Feather name="trending-up" size={14} color={c.positive} />
            <Text
              style={[s.rateText, { color: c.positive }]}
              numberOfLines={1}
            >
              1 {from.currency} = {formatRate(rate, to.currency)}{" "}
              {to.currency}
            </Text>
          </View>
        </View>

        {/* TO */}
        <CurrencyRow
          mode="to"
          accountId={to.id}
          currency={to.currency}
          balance={formatAccountBalance(to)}
          amountLabel={`+ ${formatAmount(received, to.currency)}`}
          badgeBacking={badgeBacking}
          onPress={() => setPickerSlot("to")}
        />
      </View>

      {/* Spacer + keypad + CTA al fondo */}
      <View style={{ flex: 1 }} />

      <View style={s.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.map((k) => (
              <Tap
                key={k}
                onPress={() => handleKey(k)}
                haptic="selection"
                pressScale={0.92}
                style={s.keyBtn}
              >
                {k === "back" ? (
                  <Feather name="delete" size={22} color={c.text} />
                ) : (
                  <Text style={[s.keyText, { color: c.text }]}>{k}</Text>
                )}
              </Tap>
            ))}
          </View>
        ))}
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Pressable
          style={[
            s.cta,
            { backgroundColor: canConfirm ? c.ink : c.surfaceHover },
          ]}
          onPress={onConfirm}
          disabled={!canConfirm}
        >
          <Text
            style={[s.ctaText, { color: canConfirm ? c.bg : c.textMuted }]}
          >
            Revisar conversión
          </Text>
        </Pressable>
      </View>

      {/* Picker modal: lista de las 4 cuentas */}
      <Modal
        visible={pickerSlot !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerSlot(null)}
      >
        <Pressable
          style={s.pickerBackdrop}
          onPress={() => setPickerSlot(null)}
        >
          <Pressable
            style={[
              s.pickerCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[s.pickerTitle, { color: c.text }]}>
              {pickerSlot === "from" ? "Convertir desde" : "Convertir hacia"}
            </Text>
            {accounts.map((a, i) => {
              const selected =
                pickerSlot === "from" ? a.id === fromId : a.id === toId;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => onPickAccount(a.id)}
                  style={({ pressed }) => [
                    s.pickerRow,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <AccountFlag
                    accountId={a.id}
                    size={36}
                    badgeBackingColor={badgeBacking}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.pickerCurrency, { color: c.text }]}>
                      {a.currency}
                    </Text>
                    <Text
                      style={[s.pickerLocation, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {a.location}
                    </Text>
                  </View>
                  <Text style={[s.pickerBalance, { color: c.text }]}>
                    {formatAccountBalance(a)}
                  </Text>
                  {selected ? (
                    <Feather
                      name="check"
                      size={18}
                      color={c.positive}
                      style={{ marginLeft: 8 }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function CurrencyRow({
  accountId,
  currency,
  balance,
  amountLabel,
  insufficient,
  badgeBacking,
  onPress,
}: {
  mode: "from" | "to";
  accountId: AccountId;
  currency: "ARS" | "USD" | "USDT";
  balance: string;
  amountLabel: string;
  insufficient?: boolean;
  badgeBacking: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={s.rowBlock}>
      <Pressable style={s.row} onPress={onPress} hitSlop={4}>
        <View style={s.rowLeft}>
          <Text style={[s.rowCurrency, { color: c.text }]}>{currency}</Text>
          <Feather name="chevron-down" size={20} color={c.text} />
        </View>
        <Text
          style={[
            s.rowAmount,
            { color: insufficient ? c.red : c.text },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {amountLabel}
        </Text>
      </Pressable>
      <View style={s.rowBalance}>
        <AccountFlag
          accountId={accountId}
          size={16}
          badgeBackingColor={badgeBacking}
        />
        <Text style={[s.rowBalanceText, { color: c.textMuted }]}>
          Saldo: {balance}
        </Text>
        {insufficient ? (
          <Text style={[s.rowBalanceText, { color: c.red, marginLeft: 6 }]}>
            · Insuficiente
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.25,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  rowBlock: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowCurrency: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1.2,
  },
  rowAmount: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1,
    flexShrink: 1,
    textAlign: "right",
  },
  rowBalance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  rowBalanceText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  middleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  swapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ratePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rateText: {
    fontFamily: fontMono[700],
    fontSize: 12,
    letterSpacing: 0,
  },

  keypad: {
    paddingHorizontal: 20,
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
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },

  /* Picker modal */
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pickerCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  pickerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  pickerCurrency: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  pickerLocation: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  pickerBalance: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
  },
});
