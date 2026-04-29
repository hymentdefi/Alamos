import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";
import { AlamosIcon } from "../../lib/components/AlamosIcon";
import { AlamosLogo } from "../../lib/components/Logo";

export default function SuccessScreen() {
  const { ticker, amount, qty, mode } = useLocalSearchParams<{
    ticker: string;
    amount: string;
    qty: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const isSell = mode === "sell";
  const asset = assets.find((a) => a.ticker === ticker);
  const numAmount = Number(amount) || 0;
  const numQty = Number(qty) || 0;

  const rows = [
    { label: "Activo", value: asset?.name ?? "—" },
    { label: "Monto", value: formatARS(numAmount) },
    {
      label: "Precio de ejecución",
      value: asset ? formatARS(asset.price) : "—",
    },
    {
      label: isSell ? "Unidades vendidas" : "Unidades compradas",
      value: `${numQty.toFixed(4)} ${ticker}`,
    },
  ];

  return (
    <View
      style={[
        s.root,
        { backgroundColor: c.bg, paddingTop: insets.top + 24 },
      ]}
    >
      <View style={s.heroBlock}>
        <View
          style={[s.checkCircle, { backgroundColor: c.green }]}
        >
          <AlamosIcon name="check" size={44} color={c.ink} strokeWidth={2.4} />
        </View>
        <Text style={[s.title, { color: c.text }]}>
          Orden ejecutada
        </Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          Tu orden de mercado por {formatARS(numAmount)} de{" "}
          <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
            {ticker}
          </Text>{" "}
          fue ejecutada correctamente.
        </Text>
      </View>

      <View
        style={[
          s.card,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        {rows.map((row, i) => (
          <View
            key={row.label}
            style={[
              s.row,
              i < rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: c.border,
              },
            ]}
          >
            <Text style={[s.rowLabel, { color: c.textMuted }]}>{row.label}</Text>
            <Text style={[s.rowValue, { color: c.text }]}>{row.value}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <View style={[s.bottom, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          style={[s.cta, { backgroundColor: c.ink }]}
          onPress={() => router.replace("/(app)")}
        >
          <Text style={[s.ctaText, { color: c.bg }]}>Volver al inicio</Text>
        </Pressable>
        {/* Sello de marca al pie — lockup verde Alamos.
            Confirmación de que la operación se ejecutó dentro del
            ecosistema Alamos. */}
        <View style={s.brandStamp}>
          <AlamosLogo variant="lockup" tone="green" size={14} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  heroBlock: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: 32,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1.1,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
  },
  card: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  rowLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
  },
  rowValue: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  bottom: {
    paddingHorizontal: 20,
    gap: 14,
  },
  brandStamp: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    opacity: 0.85,
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
  secondary: {
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
  },
});
