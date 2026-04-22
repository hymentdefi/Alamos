import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { assets, assetIconCode, formatARS } from "../../lib/data/assets";

const AVAILABLE_CASH = 342180;

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

type InputMode = "amount" | "qty";

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

  const [inputMode, setInputMode] = useState<InputMode>("amount");
  const [input, setInput] = useState("0");

  if (!asset) return null;

  const maxCash = isSell ? asset.price * (asset.qty ?? 0) : AVAILABLE_CASH;
  const maxQty = isSell ? asset.qty ?? 0 : maxCash / asset.price;

  const parsed = Number.parseFloat(input) || 0;
  const hasInput = parsed > 0;

  const arsAmount = inputMode === "amount" ? parsed : parsed * asset.price;
  const qtyAmount = inputMode === "qty" ? parsed : parsed / asset.price;

  const exceeds =
    inputMode === "amount" ? arsAmount > maxCash : qtyAmount > maxQty;

  const quick = useMemo(() => {
    if (inputMode === "amount") {
      if (isSell) {
        return [
          { label: "25%", value: String(Math.round(maxCash * 0.25)) },
          { label: "50%", value: String(Math.round(maxCash * 0.5)) },
          { label: "Todo", value: String(Math.round(maxCash)) },
          { label: "Max", value: String(Math.round(maxCash)) },
        ];
      }
      return [
        { label: formatARS(5000), value: "5000" },
        { label: formatARS(20000), value: "20000" },
        { label: formatARS(100000), value: "100000" },
        { label: "Max", value: String(Math.floor(maxCash)) },
      ];
    }
    // qty mode
    if (isSell) {
      return [
        { label: "25%", value: (maxQty * 0.25).toFixed(4) },
        { label: "50%", value: (maxQty * 0.5).toFixed(4) },
        { label: "Todo", value: maxQty.toFixed(4) },
        { label: "Max", value: maxQty.toFixed(4) },
      ];
    }
    return [
      { label: "1", value: "1" },
      { label: "5", value: "5" },
      { label: "10", value: "10" },
      { label: "Max", value: maxQty.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") },
    ];
  }, [inputMode, isSell, maxCash, maxQty]);

  const handleKey = (k: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (k === "back") {
      setInput((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
      return;
    }
    if (k === ".") {
      if (input.includes(".")) return;
      setInput((p) => p + ".");
      return;
    }
    setInput((p) => {
      if (p === "0") return k;
      if (p.includes(".")) {
        const maxDecimals = inputMode === "qty" ? 4 : 2;
        if (p.split(".")[1].length >= maxDecimals) return p;
      }
      return p + k;
    });
  };

  const setQuick = (val: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInput(val);
  };

  const switchInputMode = (next: InputMode) => {
    if (next === inputMode) return;
    Haptics.selectionAsync().catch(() => {});
    // Convertir el valor actual al equivalente en el otro modo para que la
    // continuidad sea intuitiva (si el usuario estaba escribiendo $10.000 y
    // cambia a cantidad, muestra la cantidad equivalente).
    if (hasInput) {
      if (next === "qty") {
        setInput((parsed / asset.price).toFixed(4).replace(/0+$/, "").replace(/\.$/, "") || "0");
      } else {
        setInput(String(Math.round(parsed * asset.price)));
      }
    }
    setInputMode(next);
  };

  const onContinue = () => {
    if (!hasInput || exceeds) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({
      pathname: "/(app)/confirm",
      params: {
        ticker: asset.ticker,
        amount: String(Math.round(arsAmount)),
        qty: qtyAmount.toFixed(4),
        mode: isSell ? "sell" : "buy",
      },
    });
  };

  // ─── Display helpers ───
  const trailingDot = input.endsWith(".");
  let bigPrimary: string;
  if (inputMode === "amount") {
    const [intPart, decPart] = input.split(".");
    const intN = Number.parseInt(intPart || "0", 10);
    const intFormatted = intN.toLocaleString("es-AR");
    bigPrimary = trailingDot
      ? `${intFormatted},`
      : decPart != null
      ? `${intFormatted},${decPart}`
      : intFormatted;
  } else {
    bigPrimary = input === "0" ? "0" : input.replace(".", ",");
  }
  const hint = !hasInput
    ? " "
    : exceeds
    ? inputMode === "amount"
      ? `Supera lo disponible (${formatARS(maxCash)})`
      : `Supera lo disponible (${maxQty.toFixed(4)} ${asset.ticker})`
    : inputMode === "amount"
    ? `≈ ${qtyAmount.toFixed(4)} ${asset.ticker}`
    : `≈ ${formatARS(arsAmount)}`;

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
              : `Efectivo ${formatARS(maxCash)}`}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Toggle: Monto en pesos / Cantidad */}
      <View style={s.modeRow}>
        <View
          style={[
            s.modeToggle,
            { backgroundColor: c.surfaceHover, borderColor: c.border },
          ]}
        >
          <Pressable
            onPress={() => switchInputMode("amount")}
            style={[
              s.modeBtn,
              inputMode === "amount" && { backgroundColor: c.ink },
            ]}
          >
            <Text
              style={[
                s.modeBtnText,
                { color: inputMode === "amount" ? c.bg : c.textSecondary },
              ]}
            >
              Monto en pesos
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchInputMode("qty")}
            style={[
              s.modeBtn,
              inputMode === "qty" && { backgroundColor: c.ink },
            ]}
          >
            <Text
              style={[
                s.modeBtnText,
                { color: inputMode === "qty" ? c.bg : c.textSecondary },
              ]}
            >
              Cantidad
            </Text>
          </Pressable>
        </View>
      </View>

      {/* AMOUNT HERO — enorme, centrado, lo principal */}
      <View style={s.hero}>
        <View style={s.heroRow}>
          {inputMode === "amount" ? (
            <Text
              style={[
                s.heroSign,
                { color: exceeds ? c.red : c.textMuted },
              ]}
            >
              $
            </Text>
          ) : null}
          <Text
            style={[
              s.heroValue,
              { color: exceeds ? c.red : c.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.4}
          >
            {bigPrimary}
          </Text>
          {inputMode === "qty" ? (
            <Text
              style={[
                s.heroUnit,
                { color: exceeds ? c.red : c.textMuted },
              ]}
              numberOfLines={1}
            >
              {asset.ticker}
            </Text>
          ) : null}
        </View>
        <Text
          style={[s.heroHint, { color: exceeds ? c.red : c.textMuted }]}
        >
          {hint}
        </Text>
      </View>

      <View style={s.spacer} />

      <View style={s.quickRow}>
        {quick.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => setQuick(q.value)}
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
                  <Feather name="delete" size={24} color={c.text} />
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
                hasInput && !exceeds ? c.ink : c.surfaceHover,
            },
          ]}
          onPress={onContinue}
          disabled={!hasInput || exceeds}
        >
          <Text
            style={[
              s.ctaText,
              {
                color: hasInput && !exceeds ? c.bg : c.textMuted,
              },
            ]}
          >
            Revisar orden
          </Text>
          <Feather
            name="arrow-right"
            size={16}
            color={hasInput && !exceeds ? c.bg : c.textMuted}
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
  modeRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: "center",
  },
  modeToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  modeBtnText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  hero: {
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: 16,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  heroSign: {
    fontFamily: fontFamily[700],
    fontSize: 56,
    marginTop: 14,
    marginRight: 8,
    letterSpacing: -1.6,
  },
  heroValue: {
    fontFamily: fontFamily[800],
    fontSize: 96,
    letterSpacing: -4,
    lineHeight: 104,
  },
  heroUnit: {
    fontFamily: fontFamily[700],
    fontSize: 24,
    marginTop: 28,
    marginLeft: 10,
    letterSpacing: -0.4,
  },
  heroHint: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    marginTop: 14,
    letterSpacing: -0.1,
  },
  spacer: {
    flex: 1,
    minHeight: 8,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  quickPill: {
    paddingVertical: 9,
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
    paddingTop: 12,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  keyBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontFamily: fontFamily[600],
    fontSize: 28,
    letterSpacing: -0.5,
  },
  bottom: {
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 12,
  },
  assetStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
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
    height: 56,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
