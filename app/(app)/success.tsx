import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";
import { AlamosIcon } from "../../lib/components/AlamosIcon";

/**
 * Genera un ID de comprobante mock — el formato `AC-YYYY-XXXXXX` es el
 * mismo que usamos en la papelería de marca (ver brand-kit/06-letterhead).
 * En prod va a ser el `orderId` que devuelva la API de Manteca.
 */
function buildReceiptId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const yr = new Date().getFullYear();
  const num = (Math.abs(h) % 999999).toString().padStart(6, "0");
  return `AC-${yr}-${num}`;
}

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

  // El comprobante necesita un ID estable durante toda la sesión. Lo
  // derivamos de los params para que abrir/cerrar el receipt o
  // compartirlo más de una vez reutilice el mismo número.
  const receiptId = useMemo(
    () => buildReceiptId(`${ticker ?? ""}-${amount ?? ""}-${qty ?? ""}-${mode ?? ""}`),
    [ticker, amount, qty, mode],
  );

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
          style={[s.checkCircle, { backgroundColor: c.positive }]}
        >
          {/* Mismo path del check que dibuja la animación de
              confirm.tsx — para que la transición animación → success
              sea visualmente continua (mismo trazo, mismo grosor). */}
          <Svg width={44} height={44} viewBox="0 0 24 24">
            <Path
              d="M5 12 L10 17 L19 7"
              stroke="#FFFFFF"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
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

        {/* Compartir comprobante — link editorial sin chrome, alineado
            central. La acción está, sin gritar. */}
        <Pressable
          style={s.shareLink}
          onPress={() =>
            router.push({
              pathname: "/(app)/receipt",
              params: {
                ticker: ticker ?? "",
                amount: String(numAmount),
                qty: String(numQty),
                mode: isSell ? "sell" : "buy",
                receiptId,
              },
            })
          }
          hitSlop={8}
        >
          <Text style={[s.shareLinkText, { color: c.textMuted }]}>
            Compartir comprobante
          </Text>
          <AlamosIcon name="arrow" size={13} color={c.textMuted} />
        </Pressable>
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
    gap: 16,
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
  shareLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  shareLinkText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
});
