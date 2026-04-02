import { useState } from "react";
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";

export default function ConfirmScreen() {
  const { ticker, amount, mode, frequency } = useLocalSearchParams<{
    ticker: string;
    amount?: string;
    mode?: string;
    frequency?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState(false);

  const isSell = mode === "sell";
  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset) return null;

  const numAmount = Number(amount) || asset.price;
  const estQty = numAmount / asset.price;

  const handleSubmit = () => {
    setSending(true);
    setTimeout(() => {
      router.replace({
        pathname: "/(app)/success",
        params: {
          ticker: asset.ticker,
          amount: String(numAmount),
          qty: estQty.toFixed(6),
          mode: isSell ? "sell" : "buy",
        },
      });
    }, 1500);
  };

  if (sending) {
    return (
      <View style={s.sendingContainer}>
        <View style={s.sendingGradient} />
        <Text style={s.sendingText}>Enviando orden...</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={s.editText}>Editar</Text>
        </Pressable>
        <View style={{ width: 48 }} />
      </View>

      {/* ── Amount display ── */}
      <View style={s.amountArea}>
        <View style={s.amountRow}>
          <Text style={s.amountSign}>$</Text>
          <Text style={s.amountValue}>
            {numAmount.toLocaleString("es-AR")}
          </Text>
        </View>
      </View>

      {/* ── Details ── */}
      <View style={s.detailsSection}>
        <View style={s.detailRow}>
          <View style={s.detailLabelRow}>
            <Text style={s.detailLabel}>Precio estimado</Text>
            <Pressable>
              <Ionicons name="help-circle-outline" size={16} color={colors.text.muted} />
            </Pressable>
          </View>
          <Text style={s.detailValue}>{formatARS(asset.price)}</Text>
        </View>

        <View style={s.detailDivider} />

        <View style={s.detailRow}>
          <Text style={s.detailLabel}>
            {asset.ticker} estimados
          </Text>
          <Text style={s.detailValue}>
            {estQty.toFixed(6)} {asset.ticker.length <= 4 ? "unid." : ""}
          </Text>
        </View>
      </View>

      {/* ── Order summary ── */}
      <View style={s.summarySection}>
        <Text style={s.summaryTitle}>Resumen de orden</Text>
        <Text style={s.summaryText}>
          Estás colocando una orden para {isSell ? "vender" : "comprar"} {formatARS(numAmount)} de {asset.ticker}.
          El costo total puede variar por volatilidad del mercado. Una vez ejecutada, la transacción no puede deshacerse.
          {"\n\n"}
          Sin comisiones · Liquidación en T+2.
        </Text>
        <Pressable>
          <Text style={s.disclosureLink}>Divulgaciones</Text>
        </Pressable>
      </View>

      {/* ── Submit area ── */}
      <View style={[s.submitArea, { paddingBottom: insets.bottom + 16 }]}>
        <Ionicons name="chevron-up" size={22} color={colors.text.secondary} style={{ marginBottom: 8 }} />
        <Pressable style={s.submitBtn} onPress={handleSubmit}>
          <Text style={s.submitBtnText}>
            Confirmar {isSell ? "venta" : "compra"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Sending state */
  sendingContainer: {
    flex: 1,
    backgroundColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
  },
  sendingGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "#1a0a0a",
    opacity: 0.4,
  },
  sendingText: {
    fontSize: 32,
    fontWeight: "300",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  editText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Amount */
  amountArea: {
    alignItems: "center",
    paddingVertical: 40,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  amountSign: {
    fontSize: 36,
    fontWeight: "300",
    color: colors.text.secondary,
    marginTop: 16,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 80,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -3,
  },

  /* Details */
  detailsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  detailLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailLabel: {
    fontSize: 15,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  /* Summary */
  summarySection: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
  },
  disclosureLink: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
    textDecorationLine: "underline",
    marginTop: 6,
  },

  /* Submit */
  submitArea: {
    alignItems: "center",
    paddingTop: 12,
    backgroundColor: colors.brand[700],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  submitBtn: {
    width: "80%",
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
});
