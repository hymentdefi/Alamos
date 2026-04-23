import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import {
  assets,
  assetIconCode,
  formatARS,
  type AssetCategory,
} from "../../lib/data/assets";
import { Tap } from "../../lib/components/Tap";
import { PercentSlider } from "../../lib/components/PercentSlider";

function unitWordFor(cat: AssetCategory): string {
  switch (cat) {
    case "cedears":
    case "acciones":
      return "acciones";
    case "bonos":
    case "letras":
      return "bonos";
    case "fci":
      return "cuotapartes";
    case "obligaciones":
      return "ONs";
    case "cripto":
      return "monedas";
    default:
      return "unidades";
  }
}

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

  const unitWord = unitWordFor(asset.category);

  /** Porcentaje de lo disponible que representa el input actual. */
  const currentPct =
    inputMode === "amount"
      ? maxCash > 0
        ? Math.min(100, Math.max(0, (arsAmount / maxCash) * 100))
        : 0
      : maxQty > 0
      ? Math.min(100, Math.max(0, (qtyAmount / maxQty) * 100))
      : 0;

  const applyPct = (pct: number) => {
    const ratio = pct / 100;
    if (inputMode === "amount") {
      const next = Math.round(maxCash * ratio);
      setInput(String(next));
    } else {
      const next = maxQty * ratio;
      const formatted = next
        .toFixed(4)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
      setInput(formatted || "0");
    }
  };

  const handleKey = (k: string) => {
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

  const switchInputMode = (next: InputMode) => {
    if (next === inputMode) return;
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

  const heroDisplay =
    inputMode === "amount"
      ? `$${bigPrimary}`
      : `${bigPrimary} ${asset.ticker}`;

  const hint = !hasInput
    ? " "
    : exceeds
    ? inputMode === "amount"
      ? `Supera lo disponible (${formatARS(maxCash)})`
      : `Supera lo disponible (${maxQty.toFixed(4)} ${asset.ticker})`
    : inputMode === "amount"
    ? `≈ ${qtyAmount.toFixed(4)} ${asset.ticker}`
    : `≈ ${formatARS(arsAmount)}`;

  const availableLabel = isSell
    ? `Disponible para vender: ${asset.qty ?? 0} ${asset.ticker}`
    : `Fondos disponibles para operar: ${formatARS(maxCash)}`;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Tap>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.text }]}>
            {isSell ? "Vender" : "Comprar"} {asset.ticker}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Toggle Monto / Cantidad: va debajo del header, NO centrado con
          el contenido. */}
      <View style={s.modeRow}>
        <View
          style={[
            s.modeToggle,
            { backgroundColor: c.surfaceHover, borderColor: c.border },
          ]}
        >
          <Tap
            onPress={() => switchInputMode("amount")}
            haptic="selection"
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
          </Tap>
          <Tap
            onPress={() => switchInputMode("qty")}
            haptic="selection"
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
              Cantidad en {unitWord}
            </Text>
          </Tap>
        </View>
      </View>

      {/* Spacer superior: empuja hero + slider hacia abajo. Ratio mayor
          al inferior para que el hero quede más bajo y el teclado suba. */}
      <View style={{ flex: 1.6 }} />

      <View style={s.hero}>
        <Text
          style={[s.heroValue, { color: exceeds ? c.red : c.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          allowFontScaling={false}
        >
          {heroDisplay}
        </Text>
        <Text style={[s.heroHint, { color: exceeds ? c.red : c.textMuted }]}>
          {hint}
        </Text>
        <Text style={[s.available, { color: c.textMuted }]}>
          {availableLabel}
        </Text>
      </View>

      <View style={s.sliderRow}>
        <PercentSlider
          value={currentPct}
          onChange={applyPct}
          disabled={maxCash <= 0}
        />
      </View>

      {/* Spacer inferior: más chico, así el teclado queda más arriba
          sin pegarse al asset strip. */}
      <View style={{ flex: 0.5 }} />

      <View style={s.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.map((k) => (
              <Tap
                key={k}
                onPress={() => handleKey(k)}
                haptic="selection"
                pressScale={0.92}
                rippleColor="rgba(14,15,12,0.08)"
                rippleContained={false}
                style={s.keyBtn}
              >
                {k === "back" ? (
                  <Feather name="delete" size={24} color={c.text} />
                ) : (
                  <Text style={[s.keyText, { color: c.text }]}>{k}</Text>
                )}
              </Tap>
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

        <Tap
          style={[
            s.cta,
            {
              backgroundColor:
                hasInput && !exceeds ? c.ink : c.surfaceHover,
            },
          ]}
          onPress={onContinue}
          disabled={!hasInput || exceeds}
          haptic="medium"
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
        </Tap>
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
    fontSize: 16,
    letterSpacing: -0.25,
  },
  modeRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
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
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: 20,
  },
  heroValue: {
    fontFamily: fontFamily[800],
    fontSize: 56,
    letterSpacing: -2.2,
    lineHeight: 62,
    textAlign: "center",
    includeFontPadding: false,
  },
  heroHint: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    marginTop: 10,
    letterSpacing: -0.1,
  },
  available: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  sliderRow: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 2,
  },
  keypad: {
    paddingHorizontal: 20,
    paddingTop: 6,
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
    borderRadius: radius.btn,
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
