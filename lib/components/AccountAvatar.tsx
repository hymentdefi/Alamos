import { View, StyleSheet } from "react-native";
import { FlagIcon } from "./FlagIcon";
import { MoneyIcon } from "./MoneyIcon";
import type { Account } from "../data/accounts";

interface Props {
  account: Account;
  /** Tamaño del avatar principal en px. El pin se escala como 42%. */
  size?: number;
}

/**
 * Avatar de cuenta: bandera/Tether de la moneda como ícono principal,
 * con un pin chiquito abajo a la derecha que indica el país donde
 * reside la cuenta. Wallets crypto no tienen país → no se renderiza
 * el pin.
 */
export function AccountAvatar({ account, size = 40 }: Props) {
  const main =
    account.currency === "ARS" ? (
      <FlagIcon code="AR" size={size} />
    ) : account.currency === "USD" ? (
      <FlagIcon code="US" size={size} />
    ) : (
      <MoneyIcon variant="usdt" size={size} />
    );

  // Pin: ~42% del avatar, con anillo blanco para separarlo visualmente
  // del ícono principal.
  const pinOuter = Math.round(size * 0.42);
  const pinInner = pinOuter - 3;

  return (
    <View style={{ width: size, height: size }}>
      {main}
      {account.country ? (
        <View
          style={[
            s.pin,
            {
              width: pinOuter,
              height: pinOuter,
              borderRadius: pinOuter / 2,
            },
          ]}
        >
          <FlagIcon code={account.country} size={pinInner} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  pin: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
