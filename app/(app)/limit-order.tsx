import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import {
  assets,
  assetCurrency,
  formatMoney,
  formatQty,
  type AssetCurrency,
} from "../../lib/data/assets";
import { nativeBalanceFor } from "../../lib/data/accounts";
import { assetMarket } from "../../lib/data/assets";
import { Tap } from "../../lib/components/Tap";

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

type Field = "qty" | "price";

/**
 * Pantalla dedicada para crear una orden límite. Estructura similar
 * a /buy pero con DOS inputs (cantidad + precio límite) que comparten
 * el keypad. La row activa muestra el cursor y la otra queda muted.
 *
 * Header: X (cierra y vuelve) + pill "Orden límite ▾" (reopen el
 * selector de tipos de orden via router.replace para no llenar la
 * stack).
 *
 * En el CTA "Revisar orden" pasa orderType=limit + limitPrice al
 * /confirm, que sabe cómo manejar el branch (skipea fase "Recibida"
 * y termina en "Orden Enviada" + crea queued en background).
 */
export default function LimitOrderScreen() {
  const { ticker, mode } = useLocalSearchParams<{
    ticker: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const asset = useMemo(
    () => assets.find((a) => a.ticker === ticker),
    [ticker],
  );
  const isSell = mode === "sell";

  const market = useMemo(
    () => (asset ? assetMarket(asset) : "AR"),
    [asset],
  );
  const nativeCurrency: AssetCurrency = useMemo(
    () => (asset ? assetCurrency(asset) : "ARS"),
    [asset],
  );
  const nativeBalance = useMemo(
    () => nativeBalanceFor(market),
    [market],
  );

  const [active, setActive] = useState<Field>("qty");
  const [qty, setQty] = useState("0");
  const [price, setPrice] = useState(() =>
    asset ? asset.price.toFixed(asset.price < 1 ? 4 : 2) : "0",
  );

  if (!asset) return null;

  const qtyNum = Number.parseFloat(qty) || 0;
  const priceNum = Number.parseFloat(price) || 0;
  const cost = qtyNum * priceNum;
  const maxQty = isSell ? asset.qty ?? 0 : priceNum > 0 ? nativeBalance / priceNum : 0;

  const exceeds = isSell ? qtyNum > (asset.qty ?? 0) : cost > nativeBalance;
  const hasInput = qtyNum > 0 && priceNum > 0;

  const handleKey = (k: string) => {
    const setter = active === "qty" ? setQty : setPrice;
    const value = active === "qty" ? qty : price;
    /* Decimales: cantidad permite hasta 4 (fracciones de unidad),
     *  precio límite permite hasta 4 también para activos sub-$1. */
    const maxDecimals = 4;

    if (k === "back") {
      setter((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
      return;
    }
    if (k === ".") {
      if (value.includes(".")) return;
      setter((p) => p + ".");
      return;
    }
    setter((p) => {
      if (p === "0") return k;
      if (p.includes(".")) {
        if (p.split(".")[1].length >= maxDecimals) return p;
      }
      return p + k;
    });
  };

  const handleBackLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    if (active === "qty") setQty("0");
    else setPrice("0");
  };

  const switchActive = (next: Field) => {
    if (next === active) return;
    Haptics.selectionAsync().catch(() => {});
    setActive(next);
  };

  const openTypeSelector = () => {
    router.replace({
      pathname: "/(app)/conditional-orders",
      params: { ticker: asset.ticker, mode: isSell ? "sell" : "buy" },
    });
  };

  const onContinue = () => {
    if (!hasInput || exceeds) return;
    router.push({
      pathname: "/(app)/confirm",
      params: {
        ticker: asset.ticker,
        amount: cost.toFixed(2),
        qty: qtyNum.toFixed(4),
        mode: isSell ? "sell" : "buy",
        currency: nativeCurrency,
        orderType: "limit",
        limitPrice: priceNum.toFixed(asset.price < 1 ? 4 : 2),
      },
    });
  };

  const fmtQty = formatDisplayQty(qty);
  const fmtPrice = formatDisplayPrice(price);

  const available = isSell
    ? `${formatQty(asset.qty ?? 0)} ${asset.ticker} disponibles`
    : `${formatMoney(nativeBalance, nativeCurrency)} disponibles`;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header — X cierra (router.back), pill arriba a la derecha
          reabre el selector de tipos para cambiar de orden. */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="x" size={22} color={c.text} />
        </Tap>
        <View style={{ flex: 1 }} />
        <Tap
          onPress={openTypeSelector}
          style={s.typePill}
          haptic="selection"
          pressScale={0.96}
        >
          <Text style={[s.typePillText, { color: c.brand }]}>
            Orden límite
          </Text>
          <Feather name="chevron-down" size={14} color={c.brand} />
        </Tap>
      </View>

      {/* Hero — título + disponibilidad */}
      <View style={s.hero}>
        <Text style={[s.heroTitle, { color: c.text }]}>
          {isSell ? "Vender" : "Comprar"} {asset.ticker}
        </Text>
        <Text style={[s.heroSub, { color: c.textMuted }]}>{available}</Text>
      </View>

      {/* Inputs — dos filas tap-to-switch. Cantidad arriba, Precio
          límite abajo. Cada una muestra label + valor a la derecha.
          La activa lleva un underline brand sutil. */}
      <View style={s.inputsBlock}>
        <InputRow
          label="Cantidad"
          value={fmtQty}
          sub={
            qtyNum > 0 && !isSell
              ? `Hasta ${formatQty(Math.floor(maxQty * 10000) / 10000)} ${asset.ticker} con el saldo actual`
              : undefined
          }
          active={active === "qty"}
          onPress={() => switchActive("qty")}
          accent={c.brand}
          textColor={
            isSell && qtyNum > (asset.qty ?? 0)
              ? c.red
              : !isSell && exceeds
                ? c.red
                : c.text
          }
        />
        <InputRow
          label="Precio límite"
          value={fmtPrice}
          sub={`Mercado: ${formatMoney(asset.price, nativeCurrency)}`}
          active={active === "price"}
          onPress={() => switchActive("price")}
          accent={c.brand}
          textColor={c.text}
          symbol={
            nativeCurrency === "ARS"
              ? "$"
              : nativeCurrency === "USD"
                ? "US$"
                : "USDT"
          }
        />
        <View style={[s.divider, { backgroundColor: c.border }]} />
        <View style={s.costRow}>
          <Text style={[s.costLabel, { color: c.textMuted }]}>
            {isSell ? "Recibís estimado" : "Costo estimado"}
          </Text>
          <Text
            style={[
              s.costValue,
              { color: exceeds ? c.red : c.text },
            ]}
          >
            {formatMoney(cost, nativeCurrency)}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* CTA + keypad */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <Tap
          style={[
            s.cta,
            {
              backgroundColor:
                hasInput && !exceeds ? c.brand : c.surfaceHover,
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
                color: hasInput && !exceeds ? c.onColor : c.textMuted,
              },
            ]}
          >
            Revisar orden
          </Text>
        </Tap>

        <View style={s.keypad}>
          {keys.map((row, ri) => (
            <View key={ri} style={s.keyRow}>
              {row.map((k) => (
                <Tap
                  key={k}
                  onPress={() => handleKey(k)}
                  onLongPress={k === "back" ? handleBackLongPress : undefined}
                  delayLongPress={400}
                  haptic="selection"
                  pressScale={0.92}
                  rippleColor="rgba(14,15,12,0.08)"
                  rippleContained={false}
                  style={s.keyBtn}
                >
                  {k === "back" ? (
                    <Feather name="delete" size={24} color={c.text} />
                  ) : (
                    <Text style={[s.keyText, { color: c.text }]}>
                      {k === "." ? "," : k}
                    </Text>
                  )}
                </Tap>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function InputRow({
  label,
  value,
  sub,
  active,
  onPress,
  accent,
  textColor,
  symbol,
}: {
  label: string;
  value: string;
  sub?: string;
  active: boolean;
  onPress: () => void;
  accent: string;
  textColor: string;
  symbol?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={s.inputRow}>
      <View style={{ flex: 1 }}>
        <Text style={[s.inputLabel, { color: c.text }]}>{label}</Text>
        {sub ? (
          <Text style={[s.inputSub, { color: c.textMuted }]}>{sub}</Text>
        ) : null}
      </View>
      <View style={s.inputValueWrap}>
        {symbol ? (
          <Text style={[s.inputValueSymbol, { color: textColor }]}>
            {symbol}
          </Text>
        ) : null}
        <Text
          style={[
            s.inputValue,
            { color: textColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        {active ? (
          <View style={[s.cursor, { backgroundColor: accent }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Formatea cantidad estilo "1.234,5678" — separador de miles en
 *  el entero, coma para decimal. */
function formatDisplayQty(raw: string): string {
  const trailingDot = raw.endsWith(".");
  const [intPart, decPart] = raw.split(".");
  const intN = Number.parseInt(intPart || "0", 10);
  const intFormatted = intN.toLocaleString("es-AR");
  if (trailingDot) return `${intFormatted},`;
  if (decPart != null) return `${intFormatted},${decPart}`;
  return intFormatted;
}

/** Formatea precio con coma decimal pero sin separador de miles si
 *  el número es chico (típico para precios <10k). */
function formatDisplayPrice(raw: string): string {
  return raw.replace(".", ",");
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  typePillText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
  },
  heroTitle: {
    fontFamily: fontFamily[800],
    fontSize: 32,
    letterSpacing: -1,
    lineHeight: 36,
  },
  heroSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginTop: 6,
  },
  inputsBlock: {
    paddingHorizontal: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.18)",
  },
  inputLabel: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  inputSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 4,
  },
  inputValueWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    maxWidth: "55%",
  },
  inputValueSymbol: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.2,
  },
  inputValue: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -0.6,
  },
  cursor: {
    width: 2,
    height: 24,
    marginLeft: 2,
    /* Sin animation por ahora — el cursor estático ya indica
     * suficientemente cuál input está activo. Si más adelante se
     * quiere blink, usar Animated.loop con opacity 1↔0. */
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
  },
  costLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  costValue: {
    fontFamily: fontFamily[800],
    fontSize: 20,
    letterSpacing: -0.4,
  },
  bottom: {
    paddingHorizontal: 20,
    gap: 12,
  },
  cta: {
    height: 52,
    borderCurve: "continuous",
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  keypad: {
    paddingTop: 4,
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
    fontSize: 26,
    letterSpacing: -0.5,
  },
});
