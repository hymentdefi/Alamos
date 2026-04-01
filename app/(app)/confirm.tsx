import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";
import Button from "../../lib/components/Button";

export default function ConfirmScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset) return null;

  const qty = Math.ceil(Math.random() * 5) + 1;
  const total = asset.price * qty;

  const rows = [
    { label: "Activo", value: asset.ticker },
    { label: "Precio unitario", value: formatARS(asset.price) },
    { label: "Cantidad", value: String(qty) },
    { label: "Comisión", value: "$0", isAccent: true },
    { label: "Total", value: formatARS(total), isBold: true },
  ];

  return (
    <View style={s.container}>
      <View style={[s.topNav, { paddingTop: insets.top + 8 }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.text.primary} />
        </Pressable>
        <Text style={s.title}>Confirmar compra</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.content}>
        {/* Card */}
        <View style={s.card}>
          {rows.map((row) => (
            <View key={row.label} style={s.row}>
              <Text style={[s.rowLabel, row.isBold && s.rowLabelBold]}>{row.label}</Text>
              <Text
                style={[
                  s.rowValue,
                  row.isAccent && { color: colors.brand[500] },
                  row.isBold && { fontSize: 16 },
                ]}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {/* No commission badge */}
        <View style={s.badge}>
          <Text style={s.badgeText}>★ Sin comisiones · Álamos</Text>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Button
            title="Confirmar compra"
            onPress={() =>
              router.push({
                pathname: "/(app)/success",
                params: { ticker: asset.ticker, qty: String(qty), total: String(total) },
              })
            }
          />
          <Text style={s.disclaimer}>
            Al confirmar, aceptás los términos y condiciones de operación. La liquidación se realiza en T+2.
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text.primary },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 14, color: colors.text.secondary },
  rowLabelBold: { fontWeight: "700", color: colors.text.primary },
  rowValue: { fontSize: 14, fontWeight: "600", color: colors.text.primary },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.accentDim,
    marginBottom: 20,
  },
  badgeText: { fontSize: 13, fontWeight: "600", color: colors.brand[500] },
  footer: { marginTop: "auto", paddingBottom: 40 },
  disclaimer: {
    fontSize: 11,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
});
