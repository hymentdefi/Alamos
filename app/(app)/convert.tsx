import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme, fontFamily, fontMono, radius } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import { AccountFlag } from "../../lib/components/AccountFlag";
import {
  accounts,
  convertAmount,
  formatAccountBalance,
  rateBetween,
  type AccountId,
} from "../../lib/data/accounts";

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

function symbolFor(currency: "ARS" | "USD" | "USDT"): string {
  if (currency === "ARS") return "$";
  if (currency === "USD") return "US$";
  return "USDT";
}

/** Formatea el monto con el símbolo de la moneda y separadores AR. */
function formatAmount(value: number, currency: "ARS" | "USD" | "USDT"): string {
  const sym = symbolFor(currency);
  const num = value.toLocaleString("es-AR", {
    minimumFractionDigits: currency === "ARS" ? 0 : 2,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  });
  return currency === "USDT" ? `${sym} ${num}` : `${sym}${num}`;
}

/** El rate suele ser un número con muchos decimales — lo redondeamos
 *  según la moneda destino para que la chip sea legible. */
function formatRate(rate: number, toCurrency: "ARS" | "USD" | "USDT"): string {
  if (toCurrency === "ARS") {
    return rate.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  // Para USD/USDT mostramos hasta 6 decimales para que un rate
  // micro tipo 0.000833 (1 ARS → USD) se vea legible.
  return rate.toLocaleString("es-AR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export default function ConvertScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode } = useTheme();
  const isDark = mode === "dark";
  const badgeBacking = isDark ? "#1F1F1E" : "#FFFFFF";

  // Default: ARS → USD-AR (caso típico para usuarios argentinos).
  const [fromId, setFromId] = useState<AccountId>("ars-ar");
  const [toId, setToId] = useState<AccountId>("usd-ar");
  const [amount, setAmount] = useState("0");
  const [pickerSlot, setPickerSlot] = useState<null | "from" | "to">(null);

  const from = accounts.find((a) => a.id === fromId)!;
  const to = accounts.find((a) => a.id === toId)!;
  const numericAmount = Number(amount.replace(",", ".")) || 0;
  const received = convertAmount(numericAmount, from.currency, to.currency);
  const rate = rateBetween(from.currency, to.currency);
  const insufficient = numericAmount > from.balance;
  const canConfirm = numericAmount > 0 && !insufficient && fromId !== toId;

  // ─── Animación de swap ───────────────────────────────────────
  // Cuando from y to se intercambian (botón de swap o porque el
  // user eligió en el picker la moneda que ya está en el otro
  // slot), animamos las dos rows: cada una se desplaza hacia la
  // otra y se desvanece, hacemos el swap del estado en el midpoint
  // y reaparecen en su nueva identidad. Da la lectura visual de
  // "intercambiaron lugares".
  const fromY = useSharedValue(0);
  const toY = useSharedValue(0);
  const fromOpacity = useSharedValue(1);
  const toOpacity = useSharedValue(1);
  const SWAP_TRAVEL = 32;
  const SWAP_HALF = 180;

  const fromRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fromY.value }],
    opacity: fromOpacity.value,
  }));
  const toRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: toY.value }],
    opacity: toOpacity.value,
  }));

  const animateSwap = (apply: () => void) => {
    Haptics.selectionAsync().catch(() => {});
    // Phase 1: fade-out + acercarse mutuamente.
    fromY.value = withTiming(SWAP_TRAVEL, {
      duration: SWAP_HALF,
      easing: Easing.in(Easing.cubic),
    });
    toY.value = withTiming(-SWAP_TRAVEL, {
      duration: SWAP_HALF,
      easing: Easing.in(Easing.cubic),
    });
    fromOpacity.value = withTiming(0, { duration: SWAP_HALF });
    toOpacity.value = withTiming(
      0,
      { duration: SWAP_HALF },
      (finished) => {
        "worklet";
        if (!finished) return;
        // Estado swappeado en el midpoint (ya no se ve, opacity 0).
        runOnJS(apply)();
        // Phase 2: las rows aparecen en sus nuevas identidades,
        // viajando desde el lado opuesto hacia su posición de
        // reposo.
        fromY.value = -SWAP_TRAVEL;
        toY.value = SWAP_TRAVEL;
        fromY.value = withTiming(0, {
          duration: SWAP_HALF,
          easing: Easing.out(Easing.cubic),
        });
        toY.value = withTiming(0, {
          duration: SWAP_HALF,
          easing: Easing.out(Easing.cubic),
        });
        fromOpacity.value = withTiming(1, { duration: SWAP_HALF });
        toOpacity.value = withTiming(1, { duration: SWAP_HALF });
      },
    );
  };

  const swap = () => {
    animateSwap(() => {
      setFromId(toId);
      setToId(fromId);
    });
  };

  const onPickAccount = (id: AccountId) => {
    if (pickerSlot === "from") {
      // ¿Intercambio (la moneda elegida ya está en el otro slot)?
      if (id === toId) {
        animateSwap(() => {
          setFromId(toId);
          setToId(fromId);
        });
      } else {
        Haptics.selectionAsync().catch(() => {});
        setFromId(id);
      }
    } else if (pickerSlot === "to") {
      if (id === fromId) {
        animateSwap(() => {
          setFromId(toId);
          setToId(fromId);
        });
      } else {
        Haptics.selectionAsync().catch(() => {});
        setToId(id);
      }
    }
    setPickerSlot(null);
  };

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

  const onConfirm = () => {
    if (!canConfirm) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    Alert.alert(
      "Conversión enviada",
      `Vas a recibir ${formatAmount(received, to.currency)} en ${to.location}.`,
      [{ text: "Listo", onPress: () => router.back() }],
    );
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Convertir</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.body}>
        {/* FROM */}
        <Animated.View style={fromRowStyle}>
          <CurrencyRow
            mode="from"
            accountId={from.id}
            currency={from.currency}
            balance={formatAccountBalance(from)}
            amountLabel={`- ${formatAmount(numericAmount, from.currency)}`}
            insufficient={insufficient}
            badgeBacking={badgeBacking}
            onPress={() => setPickerSlot("from")}
          />
        </Animated.View>

        {/* SWAP + RATE */}
        <View style={s.middleRow}>
          <Pressable
            style={[s.swapBtn, { backgroundColor: c.action }]}
            onPress={swap}
            hitSlop={8}
          >
            <Feather name="arrow-down" size={20} color="#FFFFFF" />
          </Pressable>
          <View
            style={[
              s.ratePill,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Feather name="trending-up" size={14} color={c.positive} />
            <Text
              style={[s.rateText, { color: c.positive }]}
              numberOfLines={1}
            >
              1 {from.currency} = {formatRate(rate, to.currency)}{" "}
              {to.currency}
            </Text>
          </View>
        </View>

        {/* TO */}
        <Animated.View style={toRowStyle}>
          <CurrencyRow
            mode="to"
            accountId={to.id}
            currency={to.currency}
            balance={formatAccountBalance(to)}
            amountLabel={`+ ${formatAmount(received, to.currency)}`}
            badgeBacking={badgeBacking}
            onPress={() => setPickerSlot("to")}
          />
        </Animated.View>
      </View>

      {/* Spacer + keypad + CTA al fondo */}
      <View style={{ flex: 1 }} />

      <View style={s.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.map((k) => (
              <Tap
                key={k}
                onPress={() => handleKey(k)}
                haptic="selection"
                pressScale={0.92}
                style={s.keyBtn}
              >
                {k === "back" ? (
                  <Feather name="delete" size={22} color={c.text} />
                ) : (
                  <Text style={[s.keyText, { color: c.text }]}>{k}</Text>
                )}
              </Tap>
            ))}
          </View>
        ))}
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Pressable
          style={[
            s.cta,
            { backgroundColor: canConfirm ? c.ink : c.surfaceHover },
          ]}
          onPress={onConfirm}
          disabled={!canConfirm}
        >
          <Text
            style={[s.ctaText, { color: canConfirm ? c.bg : c.textMuted }]}
          >
            Revisar conversión
          </Text>
        </Pressable>
      </View>

      <AccountPickerSheet
        slot={pickerSlot}
        currentFromId={fromId}
        currentToId={toId}
        badgeBacking={badgeBacking}
        onPick={onPickAccount}
        onClose={() => setPickerSlot(null)}
      />
    </View>
  );
}

/* ─── Bottom sheet: picker de cuenta ─── */

function AccountPickerSheet({
  slot,
  currentFromId,
  currentToId,
  badgeBacking,
  onPick,
  onClose,
}: {
  slot: null | "from" | "to";
  currentFromId: AccountId;
  currentToId: AccountId;
  badgeBacking: string;
  onPick: (id: AccountId) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const visible = slot !== null;
  // Cacheamos el slot del último open para que el header del sheet
  // no parpadee a "Convertir desde/hacia null" durante la
  // animación de cierre. Sólo se actualiza cuando el sheet se abre.
  const slotRef = useRef<"from" | "to">("from");
  if (slot !== null) slotRef.current = slot;
  const activeSlot = slotRef.current;

  const translateY = useSharedValue(windowH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    translateY.value = withTiming(
      windowH,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) runOnJS(onClose)();
      },
    );
    backdropOpacity.value = withTiming(0, { duration: 240 });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = Math.max(
          0,
          1 - e.translationY / windowH,
        );
      }
    })
    .onEnd((e) => {
      "worklet";
      const shouldDismiss = e.translationY > 110 || e.velocityY > 600;
      if (shouldDismiss) {
        translateY.value = withTiming(
          windowH,
          { duration: 240, easing: Easing.in(Easing.cubic) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(onClose)();
          },
        );
        backdropOpacity.value = withTiming(0, { duration: 240 });
      } else {
        translateY.value = withTiming(0, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
        backdropOpacity.value = withTiming(1, { duration: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View style={[s.sheetBackdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: c.bg,
              borderColor: c.border,
              paddingBottom: insets.bottom + 18,
            },
            sheetStyle,
          ]}
        >
          <View style={s.sheetGrabber}>
            <View
              style={[
                s.sheetGrabberPill,
                { backgroundColor: c.borderStrong },
              ]}
            />
          </View>

          <Text style={[s.sheetTitle, { color: c.text }]}>
            {activeSlot === "from"
              ? "Elegí la moneda de origen"
              : "Elegí la moneda de destino"}
          </Text>

          <View style={s.sheetList}>
            {accounts.map((a, i) => {
              const selected =
                activeSlot === "from"
                  ? a.id === currentFromId
                  : a.id === currentToId;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => onPick(a.id)}
                  style={({ pressed }) => [
                    s.sheetRow,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <AccountFlag
                    accountId={a.id}
                    size={40}
                    badgeBackingColor={badgeBacking}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.sheetRowCurrency, { color: c.text }]}>
                      {a.currency}
                    </Text>
                    <Text
                      style={[s.sheetRowLocation, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {a.location}
                    </Text>
                  </View>
                  <Text style={[s.sheetRowBalance, { color: c.text }]}>
                    {formatAccountBalance(a)}
                  </Text>
                  {selected ? (
                    <Feather
                      name="check"
                      size={18}
                      color={c.positive}
                      style={{ marginLeft: 10 }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

function CurrencyRow({
  accountId,
  currency,
  balance,
  amountLabel,
  insufficient,
  badgeBacking,
  onPress,
}: {
  mode: "from" | "to";
  accountId: AccountId;
  currency: "ARS" | "USD" | "USDT";
  balance: string;
  amountLabel: string;
  insufficient?: boolean;
  badgeBacking: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={s.rowBlock}>
      <Pressable style={s.row} onPress={onPress} hitSlop={4}>
        <View style={s.rowLeft}>
          <Text style={[s.rowCurrency, { color: c.text }]}>{currency}</Text>
          <Feather name="chevron-down" size={20} color={c.text} />
        </View>
        <Text
          style={[
            s.rowAmount,
            { color: insufficient ? c.red : c.text },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {amountLabel}
        </Text>
      </Pressable>
      <View style={s.rowBalance}>
        <AccountFlag
          accountId={accountId}
          size={16}
          badgeBackingColor={badgeBacking}
        />
        <Text style={[s.rowBalanceText, { color: c.textMuted }]}>
          Saldo: {balance}
        </Text>
        {insufficient ? (
          <Text style={[s.rowBalanceText, { color: c.red, marginLeft: 6 }]}>
            · Insuficiente
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.25,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  rowBlock: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowCurrency: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1.2,
  },
  rowAmount: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1,
    flexShrink: 1,
    textAlign: "right",
  },
  rowBalance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  rowBalanceText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  middleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  swapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ratePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rateText: {
    fontFamily: fontMono[700],
    fontSize: 12,
    letterSpacing: 0,
  },

  keypad: {
    paddingHorizontal: 20,
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

  /* Bottom sheet picker */
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetGrabber: {
    alignItems: "center",
    paddingVertical: 8,
  },
  sheetGrabberPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetTitle: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sheetList: {
    paddingTop: 4,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  sheetRowCurrency: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  sheetRowLocation: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  sheetRowBalance: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
