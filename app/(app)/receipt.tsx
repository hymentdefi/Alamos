import { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, fontMono, radius } from "../../lib/theme";
import {
  assets,
  assetCurrency,
  formatMoney,
  type AssetCurrency,
} from "../../lib/data/assets";
import { AlamosLogo } from "../../lib/components/Logo";
import { AlamosIcon } from "../../lib/components/AlamosIcon";
import { TrianglesWatermark } from "../../lib/components/TrianglesWatermark";

/**
 * Comprobante de operación — vista "papelería" formal con identidad de
 * marca. Inspirado en `brand-kit/06-letterhead` (variante C: watermark
 * + footer legal). Recibe los mismos params que SuccessScreen + un
 * `receiptId` derivado.
 *
 * El botón "Compartir" usa el `Share` nativo de RN con un texto
 * formateado — cuando tengamos `react-native-view-shot` armado,
 * podemos compartir como imagen renderizada de esta misma pantalla.
 */
export default function ReceiptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const { ticker, amount, qty, mode, receiptId, currency } =
    useLocalSearchParams<{
      ticker: string;
      amount: string;
      qty: string;
      mode?: string;
      receiptId: string;
      currency?: string;
    }>();

  const isSell = mode === "sell";
  const asset = assets.find((a) => a.ticker === ticker);
  const nativeCurrency: AssetCurrency =
    (currency as AssetCurrency | undefined) ??
    (asset ? assetCurrency(asset) : "ARS");
  const numAmount = Number(amount) || 0;
  const numQty = Number(qty) || 0;
  const fee = numAmount * 0.005;
  const total = isSell ? numAmount - fee : numAmount + fee;

  // Snapshot de fecha/hora — en prod va a venir del timestamp de la
  // orden ejecutada, pero para la demo usamos `Date.now()`.
  const { dateLabel, timeLabel } = useMemo(() => {
    const now = new Date();
    const fmtD = now.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const fmtT = now.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { dateLabel: fmtD, timeLabel: fmtT };
  }, []);

  const onShare = async () => {
    const lines = [
      `Comprobante Álamos Capital · ${receiptId}`,
      "",
      `${isSell ? "Venta" : "Compra"} de ${asset?.name ?? ticker} (${ticker})`,
      `Monto: ${formatMoney(numAmount, nativeCurrency)}`,
      `Precio: ${asset ? formatMoney(asset.price, nativeCurrency) : "—"}`,
      `Cantidad: ${numQty.toFixed(4)} ${ticker}`,
      `Comisión (0,5%): ${formatMoney(fee, nativeCurrency)}`,
      `${isSell ? "Total recibido" : "Total pagado"}: ${formatMoney(total, nativeCurrency)}`,
      "",
      `${dateLabel} · ${timeLabel}`,
      "",
      "Álamos Capital S.A. · ALYC CNV · alamos.capital",
    ];
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      Alert.alert("No pudimos compartir el comprobante");
    }
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header con back + share */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={s.iconBtn}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Comprobante</Text>
        <Pressable
          onPress={onShare}
          hitSlop={12}
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
        >
          <AlamosIcon name="upload" size={16} color={c.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* "Hoja membretada" — papel beige, watermark de triángulos
            atrás, header con lockup verde, body con datos, footer legal.
            Replica el variant C del brand-kit (06-letterhead). */}
        <View
          style={[
            s.sheet,
            { backgroundColor: c.beige, borderColor: c.border },
          ]}
        >
          <TrianglesWatermark
            size={260}
            opacity={0.07}
            style={{ bottom: -50, right: -40 }}
          />

          {/* Head: lockup verde + meta empresa */}
          <View style={s.sheetHead}>
            <AlamosLogo variant="lockup" tone="green" size={26} />
            <Text style={[s.sheetMeta, { color: c.textMuted }]}>
              Álamos Capital S.A.{"\n"}alamos.capital
            </Text>
          </View>

          {/* Eyebrow + ID + fecha. Plus Jakarta letter-spacing alto
              para feel "ingenieril" hasta que sumemos JetBrains Mono. */}
          <View style={s.refBlock}>
            <Text style={[s.refEyebrow, { color: c.textMuted }]}>
              COMPROBANTE DE OPERACIÓN
            </Text>
            <Text style={[s.refId, { color: c.text }]}>
              Ref · {receiptId}
            </Text>
            <Text style={[s.refDate, { color: c.textMuted }]}>
              {dateLabel} · {timeLabel}
            </Text>
          </View>

          {/* Operación: tipo + activo grande */}
          <View style={s.opBlock}>
            <Text style={[s.opType, { color: c.textMuted }]}>
              {isSell ? "VENTA" : "COMPRA"}
            </Text>
            <Text style={[s.opTicker, { color: c.text }]}>
              {ticker}
            </Text>
            <Text style={[s.opName, { color: c.textMuted }]}>
              {asset?.name ?? ""}
            </Text>
          </View>

          {/* Monto grande */}
          <View style={s.amountBlock}>
            <Text style={[s.amountLabel, { color: c.textMuted }]}>
              {isSell ? "TOTAL RECIBIDO" : "TOTAL PAGADO"}
            </Text>
            <Text style={[s.amountValue, { color: c.text }]}>
              {formatMoney(total, nativeCurrency)}
            </Text>
          </View>

          {/* Detalles */}
          <View style={[s.divider, { backgroundColor: c.border }]} />

          <ReceiptRow
            label="Monto"
            value={formatMoney(numAmount, nativeCurrency)}
          />
          <ReceiptRow
            label="Precio de ejecución"
            value={asset ? formatMoney(asset.price, nativeCurrency) : "—"}
          />
          <ReceiptRow
            label={isSell ? "Unidades vendidas" : "Unidades compradas"}
            value={`${numQty.toFixed(4)} ${ticker}`}
          />
          <ReceiptRow
            label="Comisión (0,5%)"
            value={formatMoney(fee, nativeCurrency)}
          />

          {/* Footer legal — formato letterhead variant C */}
          <View style={[s.divider, { backgroundColor: c.border, marginTop: 18 }]} />
          <View style={s.legalGrid}>
            <View style={s.legalCell}>
              <Text style={[s.legalLabel, { color: c.textMuted }]}>
                EMISOR
              </Text>
              <Text style={[s.legalValue, { color: c.text }]}>
                Álamos Capital S.A.{"\n"}CUIT 30-71xxxxxx-x
              </Text>
            </View>
            <View style={s.legalCell}>
              <Text style={[s.legalLabel, { color: c.textMuted }]}>
                REGULACIÓN
              </Text>
              <Text style={[s.legalValue, { color: c.text }]}>
                ALYC CNV nº 000{"\n"}Inversiones · CABA
              </Text>
            </View>
          </View>
          <Text style={[s.legalFootnote, { color: c.textMuted }]}>
            Este comprobante es un instrumento informativo. La liquidación
            efectiva se confirma por las cuentas de débito indicadas en
            la operación.
          </Text>
        </View>

        {/* Botón compartir grande, fuera de la "hoja". */}
        <View style={s.actionWrap}>
          <Pressable
            onPress={onShare}
            style={[s.shareBtn, { backgroundColor: c.text }]}
          >
            <AlamosIcon name="upload" size={16} color={c.bg} />
            <Text style={[s.shareBtnText, { color: c.bg }]}>
              Compartir comprobante
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.rowValue, { color: c.text }]}>{value}</Text>
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

  sheet: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    overflow: "hidden",
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  sheetMeta: {
    fontFamily: fontMono[500],
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0,
    textAlign: "right",
  },

  refBlock: {
    marginBottom: 24,
  },
  refEyebrow: {
    fontFamily: fontMono[700],
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  refId: {
    fontFamily: fontMono[700],
    fontSize: 16,
    letterSpacing: 0,
    marginBottom: 4,
  },
  refDate: {
    fontFamily: fontMono[500],
    fontSize: 12,
    letterSpacing: 0,
  },

  opBlock: {
    marginBottom: 22,
  },
  opType: {
    fontFamily: fontMono[700],
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  opTicker: {
    fontFamily: fontFamily[800],
    fontSize: 36,
    letterSpacing: -1.4,
    lineHeight: 38,
    marginBottom: 4,
  },
  opName: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },

  amountBlock: {
    marginBottom: 18,
  },
  amountLabel: {
    fontFamily: fontMono[700],
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  amountValue: {
    fontFamily: fontFamily[800],
    fontSize: 32,
    letterSpacing: -1.2,
    lineHeight: 36,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.05,
  },
  rowValue: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },

  legalGrid: {
    flexDirection: "row",
    gap: 18,
    marginTop: 6,
    marginBottom: 12,
  },
  legalCell: {
    flex: 1,
  },
  legalLabel: {
    fontFamily: fontMono[700],
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  legalValue: {
    fontFamily: fontMono[500],
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 15,
  },
  legalFootnote: {
    fontFamily: fontFamily[500],
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: -0.05,
    marginTop: 4,
  },

  actionWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: radius.btn,
  },
  shareBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
