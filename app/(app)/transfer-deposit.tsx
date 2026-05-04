import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { type AccountId } from "../../lib/data/accounts";
import {
  BankDepositCard,
  WireDepositCard,
  depositTitleFor,
} from "./transfer";

/**
 * Detalle de Ingresar [moneda]. Es UNA ruta separada del hub
 * (/transfer?mode=deposit) — eso permite que el swipe-back nativo
 * de iOS pop-eé directo al hub sin trucos. Antes vivía como
 * sub-step interno de /transfer y necesitaba `usePreventRemove`,
 * que daba un visual feo (la pantalla popeaba a home y volvía).
 *
 * Recibe `currency` como search param: AccountId. Si es usd-us
 * mostramos wire transfer; si es ARS o USD-AR, alias+CBU + tabs.
 *
 * Para el sub-flow de ingresar desde una cuenta vinculada, la
 * `BankDepositCard` recibe un onPickLinked que navega a
 * /transfer-deposit-from?currency=…&account=… (otra ruta separada).
 */
export default function TransferDepositScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currency } = useLocalSearchParams<{ currency: string }>();
  const id = currency as AccountId;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>
          Ingresar {depositTitleFor(id)}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {id === "usd-us" ? (
          <WireDepositCard />
        ) : (
          <BankDepositCard
            kind={id as "ars-ar" | "usd-ar"}
            onPickLinked={(acc) =>
              router.push({
                pathname: "/(app)/transfer-deposit-from",
                params: { currency: id, account: acc.id },
              })
            }
          />
        )}
      </ScrollView>
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
