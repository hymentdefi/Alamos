import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { formatARS } from "../../lib/data/assets";
import Button from "../../lib/components/Button";

export default function SuccessScreen() {
  const { ticker, qty, total } = useLocalSearchParams<{
    ticker: string;
    qty: string;
    total: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const summaryRows = [
    { label: "Activo", value: ticker },
    { label: "Cantidad", value: qty },
    { label: "Total invertido", value: formatARS(Number(total)) },
  ];

  return (
    <View style={[s.container, { paddingTop: insets.top + 40 }]}>
      {/* Check icon */}
      <View style={s.checkCircle}>
        <Ionicons name="checkmark" size={40} color={colors.brand[500]} />
      </View>

      <Text style={s.title}>¡Ya sos inversor!</Text>
      <Text style={s.subtitle}>Tu compra fue ejecutada con éxito.</Text>

      {/* Summary */}
      <View style={s.summary}>
        {summaryRows.map((row) => (
          <View key={row.label} style={s.summaryRow}>
            <Text style={s.summaryLabel}>{row.label}</Text>
            <Text style={s.summaryValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {/* Buttons */}
      <View style={s.footer}>
        <Button
          title="Volver al inicio"
          onPress={() => router.replace("/(app)")}
          style={{ marginBottom: 10 }}
        />
        <Button
          title="Seguir explorando"
          variant="secondary"
          onPress={() => router.replace("/(app)/explore")}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: 32,
    lineHeight: 22,
  },
  summary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: "100%",
    marginBottom: 32,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 13, color: colors.text.secondary },
  summaryValue: { fontSize: 13, fontWeight: "600", color: colors.text.primary },
  footer: { marginTop: "auto", width: "100%", paddingBottom: 20 },
});
