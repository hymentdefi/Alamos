import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AmountStep, type DepositCurrency } from "./transfer";

/**
 * Paso 1 del flow de Send: monto. Es UNA ruta separada del hub
 * (/transfer?mode=send) — el swipe-back nativo popea naturalmente
 * al hub donde se eligió la moneda.
 *
 * Recibe `cur` ('ars' | 'usd') como search param.
 * Pushea a /transfer-send-destination con cur + amount.
 */
export default function TransferSendAmountScreen() {
  const router = useRouter();
  const { cur: curParam } = useLocalSearchParams<{ cur?: string }>();
  const cur = (curParam === "usd" ? "usd" : "ars") as DepositCurrency;
  const [amount, setAmount] = useState("0");

  return (
    <AmountStep
      cur={cur}
      amount={amount}
      onChangeAmount={setAmount}
      onBack={() => router.back()}
      onNext={() =>
        router.push({
          pathname: "/(app)/transfer-send-destination",
          params: { cur, amount },
        })
      }
    />
  );
}
