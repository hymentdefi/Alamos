import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import {
  assets,
  assetIconCode,
  assetCurrency,
  assetMarket,
  formatMoney,
  formatQty,
  type AssetCategory,
  type AssetCurrency,
  type AssetMarket,
} from "../../lib/data/assets";
import { nativeBalanceFor } from "../../lib/data/accounts";
import { Tap } from "../../lib/components/Tap";
import { PercentSlider } from "../../lib/components/PercentSlider";
import {
  closedReasonFor,
  deferredCtaLabel,
  deferredOrderDisclaimerFor,
  nextOpenFor,
} from "../../lib/market/hours";
import { useQueuedOrders } from "../../lib/queued-orders/context";
import { useToast } from "../../lib/toast/context";

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
    case "crypto":
      return "monedas";
    default:
      return "unidades";
  }
}

/**
 * Affix de moneda para los inputs (calculadora del buy). Devuelve
 * prefix o suffix según la convención de la app:
 *   ARS → "$" antes
 *   USD → " US$" después (símbolo, no ticker)
 *   USDT → " USDT" después
 */
function moneyAffix(currency: AssetCurrency): {
  prefix: string;
  suffix: string;
} {
  if (currency === "ARS") return { prefix: "$", suffix: "" };
  const suffix = currency === "USD" ? " US$" : ` ${currency}`;
  return { prefix: "", suffix };
}

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
  const { create: createQueued } = useQueuedOrders();
  const { show: showToast } = useToast();
  const [submittingDeferred, setSubmittingDeferred] = useState(false);

  const asset = assets.find((a) => a.ticker === ticker);
  const isSell = mode === "sell";

  const [inputMode, setInputMode] = useState<InputMode>("amount");
  const [input, setInput] = useState("0");

  // Mercado del asset — driver del saldo source y de la moneda nativa.
  const market = useMemo<AssetMarket>(
    () => (asset ? assetMarket(asset) : "AR"),
    [asset],
  );
  // Moneda nativa del activo (display del input: $, US$, USDT). Aún
  // usa assetCurrency porque el cálculo de currency cae al market.
  const nativeCurrency = useMemo<AssetCurrency>(
    () => (asset ? assetCurrency(asset) : "ARS"),
    [asset],
  );

  // Saldo disponible para operar = saldo de la cuenta específica del
  // mercado (no se mezclan los USD de la cuenta argentina con los USD
  // de la cuenta USA — son pools separados).
  const nativeBalance = useMemo(() => nativeBalanceFor(market), [market]);

  if (!asset) return null;

  // En compra: el techo es el saldo nativo. En venta: contra la
  // tenencia del propio activo (same-currency).
  const maxCash = isSell ? asset.price * (asset.qty ?? 0) : nativeBalance;
  const maxQty = isSell ? asset.qty ?? 0 : maxCash / asset.price;

  const parsed = Number.parseFloat(input) || 0;
  const hasInput = parsed > 0;

  const targetAmount = inputMode === "amount" ? parsed : parsed * asset.price;
  const qtyAmount = inputMode === "qty" ? parsed : parsed / asset.price;

  const exceeds =
    inputMode === "amount" ? targetAmount > maxCash : qtyAmount > maxQty;

  const unitWord = unitWordFor(asset.category);

  /** Porcentaje de lo disponible que representa el input actual. */
  const currentPct =
    inputMode === "amount"
      ? maxCash > 0
        ? Math.min(100, Math.max(0, (targetAmount / maxCash) * 100))
        : 0
      : maxQty > 0
      ? Math.min(100, Math.max(0, (qtyAmount / maxQty) * 100))
      : 0;

  const applyPct = (pct: number) => {
    const ratio = pct / 100;
    if (inputMode === "amount") {
      // En 100% usamos Math.floor para no empujar 1 peso por encima del
      // disponible. El resto de porcentajes redondea normal.
      const next =
        pct >= 100 ? Math.floor(maxCash) : Math.round(maxCash * ratio);
      setInput(String(next));
    } else {
      // Truncar a 4 decimales (no toFixed, que redondea hacia arriba y
      // puede quedar 1 ulp por encima del máximo — eso disparaba el
      // 'supera lo disponible' al poner 100%).
      const raw = maxQty * ratio;
      const truncated = Math.floor(raw * 10000) / 10000;
      const formatted = truncated
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

  // Hold "back" para limpiar el input entero — patrón estándar de
  // calculadoras de banking (Mercado Pago, Brubank, Robinhood). Heavy
  // haptic para feedback táctil contundente del "limpié todo".
  const handleBackLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setInput("0");
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

  const goToConfirm = () => {
    const params: Record<string, string> = {
      ticker: asset.ticker,
      amount: String(targetAmount.toFixed(2)),
      qty: qtyAmount.toFixed(4),
      mode: isSell ? "sell" : "buy",
      currency: nativeCurrency,
    };
    router.push({ pathname: "/(app)/confirm", params });
  };

  /* ─── Mercado cerrado: orden diferida ────────────────────────
   *
   * Si el mercado del activo está cerrado al momento de operar, el
   * flow cambia: en lugar de routear a /confirm (ejecuta inmediato),
   * encolamos una market order que el backend procesa en la próxima
   * apertura. La spec lo pide explícitamente para v1: SOLO market
   * orders, NO limit. El precio de referencia es el último cierre.
   */
  const closedReason = useMemo(
    () => closedReasonFor(asset),
    [asset],
  );
  const isDeferred =
    closedReason.kind !== "open" && closedReason.kind !== "notApplicable";

  const queueOrder = async () => {
    if (!hasInput || exceeds || submittingDeferred) return;
    setSubmittingDeferred(true);
    try {
      const next = nextOpenFor(asset);
      await createQueued({
        assetId: asset.ticker,
        side: isSell ? "sell" : "buy",
        quantity: qtyAmount,
        currency: nativeCurrency,
        estimatedExecutionAt: next.toISOString(),
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      // Sin toast de confirmación — el haptic + el router.back() al
      // detail (con la orden en "Pendientes" si quiere verla)
      // alcanzan como feedback. Errores sí siguen tirando toast
      // porque el navigate-back no informa qué falló.
      router.back();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "No pudimos programar la orden. Reintentá.";
      showToast(msg, { variant: "error" });
    } finally {
      setSubmittingDeferred(false);
    }
  };

  const onContinue = () => {
    if (!hasInput || exceeds) return;
    if (isDeferred) {
      queueOrder();
      return;
    }
    goToConfirm();
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

  const { prefix: symPrefix, suffix: symSuffix } = moneyAffix(nativeCurrency);
  const heroDisplay =
    inputMode === "amount"
      ? `${symPrefix}${bigPrimary}${symSuffix}`
      : `${bigPrimary} ${asset.ticker}`;

  // Truncado a 4 decimales para alinear con lo que el slider deja
  // cargar al 100% — si acá mostramos redondeo hacia arriba, el hint
  // de 'supera lo disponible' queda incongruente con lo que alcanza.
  const maxQtyFloored = Math.floor(maxQty * 10000) / 10000;

  const hint = !hasInput
    ? " "
    : exceeds
    ? inputMode === "amount"
      ? `Supera lo disponible (${formatMoney(maxCash, nativeCurrency)})`
      : `Supera lo disponible (${formatQty(maxQtyFloored)} ${asset.ticker})`
    : inputMode === "amount"
    ? `≈ ${formatQty(qtyAmount)} ${asset.ticker}`
    : `≈ ${formatMoney(targetAmount, nativeCurrency)}`;

  const availableLabel = isSell
    ? `Disponible para vender: ${formatQty(asset.qty ?? 0)} ${asset.ticker}`
    : `Fondos disponibles para operar: ${formatMoney(maxCash, nativeCurrency)}`;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header — back arrow a la izquierda, título flex:1 con
          textAlign center, spacer fantasma del mismo ancho que el
          iconBtn a la derecha. Layout simétrico → título cae
          exactamente en el centro de pantalla (las paddings del
          parent y los anchos de los flancos son idénticos en
          ambos lados). */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Tap>
        <Text
          style={[s.headerTitle, { color: c.text }]}
          numberOfLines={1}
        >
          {isSell ? "Vender" : "Comprar"} {asset.ticker}
        </Text>
        <View style={s.iconBtn} />
      </View>

      {/* Banner de mercado cerrado — sólo cuando aplica. La copy se
          adapta al mercado del activo (AR / US). El flow encola la
          orden en lugar de ejecutar inmediato. */}
      {isDeferred ? (
        <View
          style={[
            s.deferredBanner,
            { backgroundColor: c.surfaceHover, borderColor: c.border },
          ]}
        >
          <Feather name="clock" size={16} color={c.textSecondary} />
          <Text
            style={[s.deferredText, { color: c.textSecondary }]}
            numberOfLines={4}
          >
            {deferredOrderDisclaimerFor(asset)}
          </Text>
        </View>
      ) : null}

      {/* Toggle Monto / Cantidad: va debajo del header, NO centrado con
          el contenido. */}
      <View style={s.modeRow}>
        <View
          style={s.modeToggle}
        >
          <Tap
            onPress={() => switchInputMode("amount")}
            haptic="selection"
            style={[
              s.modeBtn,
              {
                borderColor:
                  inputMode === "amount" ? c.brand : c.border,
              },
            ]}
          >
            <Text
              style={[
                s.modeBtnText,
                {
                  color: inputMode === "amount" ? c.brand : c.textMuted,
                },
              ]}
            >
              {nativeCurrency === "ARS"
                ? "Monto en pesos"
                : nativeCurrency === "USD"
                ? "Monto en US$"
                : "Monto en USDT"}
            </Text>
          </Tap>
          <Tap
            onPress={() => switchInputMode("qty")}
            haptic="selection"
            style={[
              s.modeBtn,
              {
                borderColor:
                  inputMode === "qty" ? c.brand : c.border,
              },
            ]}
          >
            <Text
              style={[
                s.modeBtnText,
                {
                  color: inputMode === "qty" ? c.brand : c.textMuted,
                },
              ]}
            >
              Cantidad en {unitWord}
            </Text>
          </Tap>
        </View>
      </View>

      {/* Pill de tipo de orden — debajo del toggle Monto/Cantidad,
          centrado. Por default "A mercado". Tap abre
          /conditional-orders con la lista de tipos (limit, stop,
          etc). */}
      <View style={s.typePillRow}>
        <Tap
          onPress={() =>
            router.push({
              pathname: "/(app)/conditional-orders",
              params: {
                ticker: asset.ticker,
                mode: isSell ? "sell" : "buy",
                current: "market",
              },
            })
          }
          style={s.typePill}
          haptic="selection"
          pressScale={0.96}
        >
          {/* Spacer fantasma del mismo ancho que el chevron-down de
              la derecha (14px) — balancea el peso del icono para que
              el TEXTO "A mercado" caiga visualmente en el centro de
              pantalla, en línea con el título de arriba. Sin esto,
              el chevron + gap empuja el texto ~9px a la izquierda
              del centro real. */}
          <View style={{ width: 14 }} />
          <Text style={[s.typePillText, { color: c.brand }]}>A mercado</Text>
          <Feather name="chevron-down" size={14} color={c.brand} />
        </Tap>
      </View>

      {/* Spacer superior: empuja hero + slider hacia abajo. */}
      <View style={{ flex: 0.7 }} />

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

      {/* Spacer entre slider y teclado. */}
      <View style={{ flex: 0.4 }} />

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

      {/* Levanta el teclado por encima del asset strip. */}
      <View style={{ height: 24 }} />

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
            {formatMoney(asset.price, nativeCurrency)}
          </Text>
        </View>

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
            {isDeferred
              ? deferredCtaLabel(isSell ? "sell" : "buy")
              : "Revisar orden"}
          </Text>
          <Feather
            name="arrow-right"
            size={16}
            color={hasInput && !exceeds ? c.onColor : c.textMuted}
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
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Título — flex:1 dentro del header con textAlign center. El
   * spacer fantasma del lado derecho (mismo s.iconBtn ancho) hace
   * que la simetría sea exacta y el título caiga en el medio de
   * pantalla. numberOfLines={1} en el render para evitar wrap
   * cuando el ticker es largo. */
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.25,
  },
  /* Pill de tipo de orden — debajo del toggle Monto/Cantidad,
   * centrado. Discreto pero presente, en brand verde. Tap abre
   * /conditional-orders con la lista de tipos disponibles. */
  typePillRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 10,
    paddingHorizontal: 20,
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
    fontSize: 13,
    letterSpacing: -0.2,
  },
  deferredBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deferredText: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  modeRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  /* Toggle Monto/Cantidad — alignSelf stretch + flex:1 en cada
   * botón para que los dos sean del MISMO ancho. Si los dejábamos
   * content-sized, "Cantidad en acciones" (~140px) era más ancho
   * que "Monto en pesos" (~110px) y el gap entre los dos pills (el
   * "medio" visual del segmented control) caía ~15px a la izquierda
   * del centro real de pantalla. Con flex:1 los dos botones miden
   * (screenWidth - 48) / 2 cada uno y el gap queda exacto en
   * screenWidth/2. */
  modeToggle: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "stretch",
  },
  modeBtn: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  modeBtnText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
    textAlign: "center",
  },
  hero: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: 20,
  },
  heroValue: {
    fontFamily: fontFamily[800],
    fontSize: 66,
    letterSpacing: -0.2,
    lineHeight: 72,
    textAlign: "center",
    includeFontPadding: false,
  },
  heroHint: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    marginTop: 10,
    letterSpacing: -0.1,
    textAlign: "center",
  },
  available: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    marginTop: 4,
    letterSpacing: -0.1,
    textAlign: "center",
  },
  /* Slider — paddingHorizontal alineado con el resto del screen
   * (header, hero, keypad, CTA todos usan 20). Antes estaba en 56,
   * lo que dejaba la pista del slider 72-90px más angosta que los
   * elementos de arriba/abajo — el ojo lo perciba como
   * desalineado aunque el centro geométrico coincida con
   * screenWidth/2. Con 20 ahora todo respira al mismo ancho. */
  sliderRow: {
    paddingHorizontal: 20,
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
    borderCurve: "continuous",
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
    borderCurve: "continuous",
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
