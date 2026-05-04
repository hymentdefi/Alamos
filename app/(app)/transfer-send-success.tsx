import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTheme, fontFamily } from "../../lib/theme";
import {
  SendSuccess,
  LINKED_ACCOUNTS,
  type DepositCurrency,
} from "./transfer";

/**
 * Paso 3 del flow de Send: success screen. Recibe cur + amount +
 * destinationId como params. Si el destinationId no resuelve a
 * ninguna cuenta vinculada, mostramos un fallback (no debería
 * pasar — la ruta sólo se alcanza después del DestinationStep).
 */
export default function TransferSendSuccessScreen() {
  const { c } = useTheme();
  const {
    cur: curParam,
    amount: amountParam,
    destinationId,
  } = useLocalSearchParams<{
    cur?: string;
    amount?: string;
    destinationId?: string;
  }>();
  const cur = (curParam === "usd" ? "usd" : "ars") as DepositCurrency;
  const amount = Number.parseFloat(amountParam ?? "0") || 0;
  const destination = LINKED_ACCOUNTS.find((a) => a.id === destinationId);

  if (!destination) {
    return (
      <View style={[s.fallback, { backgroundColor: c.bg }]}>
        <Text style={[s.fallbackText, { color: c.text }]}>
          Destino no encontrado
        </Text>
      </View>
    );
  }

  return <SendSuccess cur={cur} amount={amount} destination={destination} />;
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
