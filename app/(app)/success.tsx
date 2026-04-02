import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";

export default function SuccessScreen() {
  const { ticker, amount, qty, mode } = useLocalSearchParams<{
    ticker: string;
    amount: string;
    qty: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isSell = mode === "sell";
  const asset = assets.find((a) => a.ticker === ticker);
  const numAmount = Number(amount) || 0;
  const numQty = Number(qty) || 0;

  const rows = [
    {
      label: "Monto en ARS",
      value: formatARS(numAmount),
      underline: true,
    },
    {
      label: "Precio de ejecución",
      value: asset ? formatARS(asset.price) : "—",
    },
    {
      label: isSell ? `${ticker} vendidos` : `${ticker} comprados`,
      value: `${numQty.toFixed(6)} ${ticker}`,
    },
    {
      label: `Nueva posición ${ticker}`,
      value: `${numQty.toFixed(6)} ${ticker}`,
    },
  ];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Top gradient area */}
      <View style={s.gradientArea} />

      {/* Card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>
          Orden de {ticker} completada
        </Text>
        <Text style={s.cardDesc}>
          Tu orden de mercado para {isSell ? "vender" : "comprar"} {formatARS(numAmount)} de {ticker} fue ejecutada.
        </Text>

        {rows.map((row, i) => (
          <View key={i}>
            <View style={s.cardRow}>
              <Text style={[s.cardRowLabel, row.underline && s.cardRowLabelUnderline]}>
                {row.label}
              </Text>
              <Text style={s.cardRowValue}>{row.value}</Text>
            </View>
            {i < rows.length - 1 && <View style={s.cardDivider} />}
          </View>
        ))}
      </View>

      {/* Buttons */}
      <View style={[s.buttons, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable
          style={s.doneBtn}
          onPress={() => router.replace("/(app)")}
        >
          <Text style={s.doneBtnText}>Listo</Text>
        </Pressable>

        <Pressable
          style={s.viewOrderBtn}
          onPress={() => router.replace("/(app)")}
        >
          <Text style={s.viewOrderBtnText}>Ver orden</Text>
        </Pressable>
      </View>

      {/* Bottom gradient decoration */}
      <View style={s.bottomGradient} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface[0],
    justifyContent: "flex-end",
  },

  /* Top gradient */
  gradientArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "#1a0a1a",
    opacity: 0.3,
  },

  /* Card */
  card: {
    backgroundColor: colors.surface[100],
    borderRadius: 20,
    marginHorizontal: 20,
    padding: 24,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  cardRowLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  cardRowLabelUnderline: {
    textDecorationLine: "underline",
    fontWeight: "600",
    color: colors.text.primary,
  },
  cardRowValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  /* Buttons */
  buttons: {
    paddingHorizontal: 20,
    gap: 10,
  },
  doneBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface[0],
  },
  viewOrderBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  viewOrderBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Bottom gradient */
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "#0a0a1a",
    opacity: 0.15,
  },
});
