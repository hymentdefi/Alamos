import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { assets, assetIconCode, formatARS } from "../../lib/data/assets";

const AVAILABLE_CASH = 342180;

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

export default function BuyScreen() {
  const { ticker, mode } = useLocalSearchParams<{
    ticker: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const asset = assets.find((a) => a.ticker === ticker);
  const isSell = mode === "sell";
  const [amount, setAmount] = useState("0");

  if (!asset) return null;

  const available = isSell
    ? asset.price * (asset.qty ?? 0)
    : AVAILABLE_CASH;
  const parsed = Number.parseFloat(amount) || 0;
  const hasAmount = parsed > 0;
  const exceeds = parsed > available;
  const estUnits = parsed / asset.price;

  const quick = isSell
    ? [
        { label: "25%", value: Math.round(available * 0.25) },
        { label: "50%", value: Math.round(available * 0.5) },
        { label: "Todo", value: Math.round(available) },
      ]
    : [
        { label: formatARS(5000), value: 5000 },
        { label: formatARS(20000), value: 20000 },
        { label: formatARS(100000), value: 100000 },
      ];

  const handleKey = (k: string) => {
    if (k === "back") {
      setAmount((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
      return;
    }
    if (k === ".") {
      if (amount.includes(".")) return;
      setAmount((p) => p + ".");
      return;
    }
    setAmount((p) => {
      if (p === "0") return k;
      if (p.includes(".") && p.split(".")[1].length >= 2) return p;
      return p + k;
    });
  };

  const onContinue = () => {
    if (!hasAmount || exceeds) return;
    router.push({
      pathname: "/(app)/confirm",
      params: {
        ticker: asset.ticker,
        amount: String(parsed),
        mode: isSell ? "sell" : "buy",
      },
    });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.text }]}>
            {isSell ? "Vender" : "Comprar"} {asset.ticker}
          </Text>
          <Text style={[s.headerSub, { color: c.textMuted }]}>
            {isSell
              ? `${asset.qty ?? 0} unidades disponibles`
              : `Efectivo ${formatARS(available)}`}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.amountSection}>
        <Text style={[s.amountLabel, { color: c.textMuted }]}>
          Monto en pesos
        </Text>
        <View style={s.amountRow}>
          <Text style={[s.amountSign, { color: c.textMuted }]}>$</Text>
          <Text
            style={[
              s.amountValue,
              { color: exceeds ? c.red : c.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {Number.parseFloat(amount || "0").toLocaleString("es-AR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
            {amount.endsWith(".") ? "," : ""}
          </Text>
        </View>
        <Text style={[s.amountHint, { color: exceeds ? c.red : c.textMuted }]}>
          {exceeds
            ? `Supera lo disponible (${formatARS(available)})`
            : hasAmount
            ? `≈ ${estUnits.toFixed(4)} unidades de ${asset.ticker}`
            : " "}
        </Text>
      </View>

      <View style={s.quickRow}>
        {quick.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => setAmount(String(q.value))}
            style={[
              s.quickPill,
              { backgroundColor: c.surfaceHover, borderColor: c.border },
            ]}
          >
            <Text style={[s.quickText, { color: c.text }]}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.map((k) => (
              <Pressable
                key={k}
                onPress={() => handleKey(k)}
                style={s.keyBtn}
                android_ripple={{ color: c.surfaceHover, borderless: true }}
              >
                {k === "back" ? (
                  <Feather name="delete" size={22} color={c.text} />
                ) : (
                  <Text style={[s.keyText, { color: c.text }]}>{k}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 14 }]}>
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
          <View style={{ flex: 1 }}>
            <Text style={[s.stripTicker, { color: c.text }]}>{asset.ticker}</Text>
            <Text style={[s.stripSub, { color: c.textMuted }]}>
              {asset.subLabel}
            </Text>
          </View>
          <Text style={[s.stripPrice, { color: c.text }]}>
            {formatARS(asset.price)}
          </Text>
        </View>

        <Pressable
          style={[
            s.cta,
            {
              backgroundColor:
                hasAmount && !exceeds ? c.ink : c.surfaceHover,
            },
          ]}
          onPress={onContinue}
          disabled={!hasAmount || exceeds}
        >
          <Text
            style={[
              s.ctaText,
              {
                color: hasAmount && !exceeds ? c.bg : c.textMuted,
              },
            ]}
          >
            Revisar orden
          </Text>
          <Feather
            name="arrow-right"
            size={16}
            color={hasAmount && !exceeds ? c.bg : c.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 1,
  },
  amountSection: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 12,
  },
  amountLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 24,
  },
  amountSign: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    marginRight: 6,
  },
  amountValue: {
    fontFamily: fontFamily[700],
    fontSize: 58,
    letterSpacing: -2.4,
  },
  amountHint: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 8,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  quickPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  quickText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
  },
  keypad: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  keyBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontFamily: fontFamily[600],
    fontSize: 26,
    letterSpacing: -0.5,
  },
  bottom: {
    paddingHorizontal: 20,
    gap: 12,
  },
  assetStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  stripIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stripIconText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
  },
  stripTicker: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  stripSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 1,
  },
  stripPrice: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  cta: {
    height: 52,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
