import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme, fontFamily } from "../../lib/theme";
import { DepositFromAccount, LINKED_ACCOUNTS } from "./transfer";

/**
 * Sub-flow de Ingresar desde una cuenta vinculada — keypad form.
 * Es UNA ruta separada de transfer-deposit para que el swipe-back
 * vuelva al detalle (donde se eligió la cuenta vinculada) sin
 * necesidad de gesture-interception.
 *
 * Recibe `currency` (AccountId) y `account` (id de la LinkedAccount)
 * como params.
 */
export default function TransferDepositFromScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { account: accId } = useLocalSearchParams<{ account: string }>();
  const account = LINKED_ACCOUNTS.find((a) => a.id === accId);

  if (!account) {
    return (
      <View style={[s.fallback, { backgroundColor: c.bg }]}>
        <Text style={[s.fallbackText, { color: c.text }]}>
          Cuenta no encontrada
        </Text>
      </View>
    );
  }

  return (
    <DepositFromAccount account={account} onBack={() => router.back()} />
  );
}

const s = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontFamily: fontFamily[600],
    fontSize: 15,
  },
});
