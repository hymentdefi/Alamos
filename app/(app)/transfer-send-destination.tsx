import { useLocalSearchParams, useRouter } from "expo-router";
import { DestinationStep, type DepositCurrency } from "./transfer";

/**
 * Paso 2 del flow de Send: elegir destino (cuenta vinculada).
 * Recibe cur + amount como params. Pushea a /transfer-send-success
 * con cur + amount + destination.id cuando el usuario elige.
 */
export default function TransferSendDestinationScreen() {
  const router = useRouter();
  const { cur: curParam, amount: amountParam } = useLocalSearchParams<{
    cur?: string;
    amount?: string;
  }>();
  const cur = (curParam === "usd" ? "usd" : "ars") as DepositCurrency;
  const amount = Number.parseFloat(amountParam ?? "0") || 0;

  return (
    <DestinationStep
      cur={cur}
      amount={amount}
      onBack={() => router.back()}
      onPick={(d) =>
        router.push({
          pathname: "/(app)/transfer-send-success",
          params: { cur, amount: String(amount), destinationId: d.id },
        })
      }
    />
  );
}
