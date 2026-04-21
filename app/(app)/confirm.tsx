import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import {
  assets,
  assetIconCode,
  formatARS,
} from "../../lib/data/assets";

export default function ConfirmScreen() {
  const { ticker, amount, mode } = useLocalSearchParams<{
    ticker: string;
    amount?: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [sending, setSending] = useState(false);

  const isSell = mode === "sell";
  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset) return null;

  const numAmount = Number(amount) || asset.price;
  const estQty = numAmount / asset.price;
  const fee = Math.round(numAmount * 0.005);
  const net = isSell ? numAmount - fee : numAmount + fee;

  const submit = () => {
    setSending(true);
    setTimeout(() => {
      router.replace({
        pathname: "/(app)/success",
        params: {
          ticker: asset.ticker,
          amount: String(numAmount),
          qty: estQty.toFixed(4),
          mode: isSell ? "sell" : "buy",
        },
      });
    }, 1400);
  };

  if (sending) {
    return (
      <View style={[s.sendingRoot, { backgroundColor: c.bg }]}>
        <ActivityIndicator color={c.ink} />
        <Text style={[s.sendingText, { color: c.text }]}>Enviando orden…</Text>
      </View>
    );
  }

  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: "Activo", value: asset.name },
    { label: "Precio estimado", value: formatARS(asset.price) },
    { label: "Cantidad", value: `${estQty.toFixed(4)} unidades` },
    { label: "Comisión (0,5%)", value: formatARS(fee) },
    {
      label: isSell ? "Total a recibir" : "Total a pagar",
      value: formatARS(net),
      strong: true,
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top + 12 }]}>
      <View style={s.header}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Revisar orden</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.amountBlock}>
        <Text style={[s.amountLabel, { color: c.textMuted }]}>
          {isSell ? "Vendés" : "Comprás"}
        </Text>
        <Text style={[s.amountValue, { color: c.text }]}>
          {formatARS(numAmount)}
        </Text>
        <View style={s.assetStrip}>
          <View
            style={[
              s.stripIcon,
              {
                backgroundColor:
                  asset.iconTone === "dark" ? c.ink : c.surfaceSunken,
              },
            ]}
          >
            <Text
              style={[
                s.stripIconText,
                { color: asset.iconTone === "dark" ? c.bg : c.textSecondary },
              ]}
            >
              {assetIconCode(asset)}
            </Text>
          </View>
          <View>
            <Text style={[s.stripTicker, { color: c.text }]}>{asset.ticker}</Text>
            <Text style={[s.stripSub, { color: c.textMuted }]}>
              {asset.subLabel}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          s.summary,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        {rows.map((row, i) => (
          <View
            key={row.label}
            style={[
              s.summaryRow,
              i < rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: c.border,
              },
            ]}
          >
            <Text style={[s.summaryLabel, { color: c.textMuted }]}>
              {row.label}
            </Text>
            <Text
              style={[
                s.summaryValue,
                row.strong && s.summaryValueStrong,
                { color: c.text },
              ]}
            >
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[s.disclaimer, { color: c.textMuted }]}>
        Orden a precio de mercado. El precio final puede variar levemente al
        ejecutarse.
      </Text>

      <View style={{ flex: 1 }} />

      <View style={[s.bottom, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          style={[s.cta, { backgroundColor: c.ink }]}
          onPress={submit}
        >
          <Text style={[s.ctaText, { color: c.bg }]}>
            Confirmar {isSell ? "venta" : "compra"}
          </Text>
        </Pressable>
        <Pressable style={s.cancel} onPress={() => router.back()}>
          <Text style={[s.cancelText, { color: c.textMuted }]}>Editar monto</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  sendingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  sendingText: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  iconBtn: {
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
  amountBlock: {
    paddingHorizontal: 24,
    alignItems: "center",
    paddingVertical: 28,
  },
  amountLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  amountValue: {
    fontFamily: fontFamily[700],
    fontSize: 42,
    letterSpacing: -1.8,
    marginBottom: 20,
  },
  assetStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stripIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stripIconText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
  },
  stripTicker: {
    fontFamily: fontFamily[700],
    fontSize: 14,
  },
  stripSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 1,
  },
  summary: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  summaryLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
  },
  summaryValue: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  summaryValueStrong: {
    fontFamily: fontFamily[700],
    fontSize: 16,
  },
  disclaimer: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.1,
    textAlign: "center",
    marginHorizontal: 28,
    marginTop: 16,
  },
  bottom: {
    paddingHorizontal: 20,
    gap: 4,
  },
  cta: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  cancel: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
  },
});
