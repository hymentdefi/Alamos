import { memo, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { fontFamily, radius, useTheme } from "../theme";
import { Tap } from "./Tap";
import {
  type Asset,
  assetMarket,
  formatMoney,
} from "../data/assets";
import {
  nativeBalanceFor,
  nativeCurrencyFor,
} from "../data/accounts";
import { useAssetColorOptional } from "../asset-color/context";
import { closedReasonFor } from "../market/hours";
import { useToast } from "../toast/context";

/**
 * Bottom bar fija de la pantalla de detalle.
 *
 * Estado collapsed — bar visible:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Fondos disponibles para                  ┌────────────┐ │
 *   │  operar en este mercado                   │  Operar    │ │
 *   │  $ 342.180                                │            │ │
 *   │                                           └────────────┘ │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Estado expanded — pills desplegadas estilo Robinhood:
 *
 *                                              ┌────────────────┐
 *                                              │ Operar opciones│
 *                                              └────────────────┘
 *                                              ┌────────────────┐
 *                                              │   Comprar      │
 *                                              └────────────────┘
 *                                              ┌────────────────┐
 *                                              │   Vender       │
 *                                              └────────────────┘
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Fondos disponibles para                  ┌────────────┐ │
 *   │  operar en este mercado                   │     X      │ │
 *   │  $ 342.180                                │  (outline) │ │
 *   │                                           └────────────┘ │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Pills:
 *   - Operar Opciones (top) — placeholder, options trading no
 *     existe en Álamos v1 (tap → toast "Próximamente").
 *   - Comprar — routea a /(app)/buy?mode=buy
 *   - Vender — routea a /(app)/buy?mode=sell, sólo si hasPosition.
 *   - X (bottom, en el slot del CTA) — outline color cromático,
 *     fondo c.surface, ícono X. Cierra el menú.
 *
 * Animación:
 *   - Dim overlay fade-in 200ms, opacity 0 → 0.55
 *   - Pills emergen desde la posición del CTA (translateY positivo)
 *     hacia su posición final (translateY 0), con stagger bottom-up
 *     50ms entre cada una.
 *   - Collapse: animación inversa.
 *
 * Mercado cerrado: Comprar/Vender cambian a "Programar compra/venta".
 *
 * 'Disponibles' del bar SIEMPRE visible (NO dimeada — la spec dice
 * "el resto de la pantalla" = arriba del bar).
 */

interface Props {
  asset: Asset;
  /** ¿El usuario tiene posición abierta? Habilita la pill Vender. */
  hasPosition: boolean;
  /** Callback cuando el user elige Comprar o Vender. El padre routea
   *  al flow correspondiente (típico: /(app)/buy?mode=...). */
  onSelect: (mode: "buy" | "sell") => void;
  /** Tap en el bloque de fondos cuando el saldo es 0 — debe
   *  navegar a /(app)/convert. */
  onConvert?: () => void;
}

const PILL_WIDTH = 200;
const PILL_HEIGHT = 52;
const PILL_GAP = 8;
const STAGGER_MS = 50;
const DUR = 280;
const DIM_OPACITY = 0.55;

export const TradeBottomBar = memo(function TradeBottomBar({
  asset,
  hasPosition,
  onSelect,
  onConvert,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const assetColor = useAssetColorOptional();
  const { show: showToast } = useToast();

  const market = useMemo(() => assetMarket(asset), [asset]);
  const balance = useMemo(() => nativeBalanceFor(market), [market]);
  const currency = useMemo(() => nativeCurrencyFor(market), [market]);
  const isEmpty = balance <= 0;

  const accent = assetColor ? assetColor.color : c.text;
  const ctaTextColor = "#FFFFFF";

  const isMarketClosed = useMemo(() => {
    const reason = closedReasonFor(asset);
    return reason.kind !== "open" && reason.kind !== "notApplicable";
  }, [asset]);

  const buyLabel = isMarketClosed ? "Programar compra" : "Comprar";
  const sellLabel = isMarketClosed ? "Programar venta" : "Vender";

  const [expanded, setExpanded] = useState(false);

  /* Offsets verticales relativos al CTA (donde está el X cuando
   * expanded). Cuando NO hay posición, Vender no se renderea y los
   * de arriba bajan una fila. */
  const sellOffset = PILL_HEIGHT + PILL_GAP; // 1 row above CTA
  const buyOffset =
    (hasPosition ? 2 : 1) * (PILL_HEIGHT + PILL_GAP);
  const optionsOffset =
    (hasPosition ? 3 : 2) * (PILL_HEIGHT + PILL_GAP);

  /* Progreso individual por pill (0 = at CTA position, 1 = at final
   * position). Stagger: la más cercana al CTA arranca primero. */
  const sellProgress = useSharedValue(0);
  const buyProgress = useSharedValue(0);
  const optionsProgress = useSharedValue(0);
  const dimProgress = useSharedValue(0);

  const expand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setExpanded(true);
    dimProgress.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    // Bottom-up stagger: la pill más cercana al CTA aparece primero.
    if (hasPosition) {
      sellProgress.value = withTiming(1, {
        duration: DUR,
        easing: Easing.out(Easing.cubic),
      });
      buyProgress.value = withDelay(
        STAGGER_MS,
        withTiming(1, { duration: DUR, easing: Easing.out(Easing.cubic) }),
      );
      optionsProgress.value = withDelay(
        STAGGER_MS * 2,
        withTiming(1, { duration: DUR, easing: Easing.out(Easing.cubic) }),
      );
    } else {
      buyProgress.value = withTiming(1, {
        duration: DUR,
        easing: Easing.out(Easing.cubic),
      });
      optionsProgress.value = withDelay(
        STAGGER_MS,
        withTiming(1, { duration: DUR, easing: Easing.out(Easing.cubic) }),
      );
    }
  };

  const collapse = (cb?: () => void) => {
    Haptics.selectionAsync().catch(() => {});
    /* Reverse animation: la más lejana del CTA colapsa primero
     * (top-down) para que se "doblen" hacia el origen como un
     * stack de cartas que cae. */
    optionsProgress.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.cubic),
    });
    buyProgress.value = withDelay(
      STAGGER_MS,
      withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }),
    );
    if (hasPosition) {
      sellProgress.value = withDelay(
        STAGGER_MS * 2,
        withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }),
      );
    }
    dimProgress.value = withTiming(
      0,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) {
          runOnJS(setExpanded)(false);
          if (cb) runOnJS(cb)();
        }
      },
    );
  };

  useEffect(() => {
    return () => {
      sellProgress.value = 0;
      buyProgress.value = 0;
      optionsProgress.value = 0;
      dimProgress.value = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Animated styles ─── */

  const sellPillStyle = useAnimatedStyle(() => ({
    opacity: sellProgress.value,
    transform: [
      {
        translateY: interpolate(sellProgress.value, [0, 1], [sellOffset, 0]),
      },
    ],
  }));
  const buyPillStyle = useAnimatedStyle(() => ({
    opacity: buyProgress.value,
    transform: [
      {
        translateY: interpolate(buyProgress.value, [0, 1], [buyOffset, 0]),
      },
    ],
  }));
  const optionsPillStyle = useAnimatedStyle(() => ({
    opacity: optionsProgress.value,
    transform: [
      {
        translateY: interpolate(
          optionsProgress.value,
          [0, 1],
          [optionsOffset, 0],
        ),
      },
    ],
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimProgress.value * DIM_OPACITY,
  }));

  /* ─── Handlers ─── */

  const handleSelect = (mode: "buy" | "sell") => {
    collapse(() => onSelect(mode));
  };
  const handleSelectOptions = () => {
    collapse(() => {
      // TODO(options): Álamos no opera options en v1. Cuando se
      // sume el flow de options, routear a /(app)/options-buy o
      // similar. Por ahora toast de "Próximamente".
      showToast("Operar opciones — próximamente", { variant: "neutral" });
    });
  };

  const ctaBottom = insets.bottom + 8;

  return (
    <>
      {/* Dim overlay encima del resto del screen, BAJO el bar.
          pointerEvents auto sólo cuando expanded para que el
          tap-out funcione. */}
      {expanded ? (
        <Animated.View
          style={[s.dimOverlay, { backgroundColor: c.ink }, dimStyle]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => collapse()}
            accessibilityLabel="Cerrar opciones"
          />
        </Animated.View>
      ) : null}

      {/* Vender pill — sólo si hasPosition. */}
      {expanded && hasPosition ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            s.pillFloating,
            {
              right: 20,
              bottom: ctaBottom + sellOffset,
              width: PILL_WIDTH,
              height: PILL_HEIGHT,
            },
            sellPillStyle,
          ]}
        >
          <ActionPill
            label={sellLabel}
            bg={accent}
            textColor={ctaTextColor}
            onPress={() => handleSelect("sell")}
          />
        </Animated.View>
      ) : null}

      {/* Comprar pill. */}
      {expanded ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            s.pillFloating,
            {
              right: 20,
              bottom: ctaBottom + buyOffset,
              width: PILL_WIDTH,
              height: PILL_HEIGHT,
            },
            buyPillStyle,
          ]}
        >
          <ActionPill
            label={buyLabel}
            bg={accent}
            textColor={ctaTextColor}
            onPress={() => handleSelect("buy")}
          />
        </Animated.View>
      ) : null}

      {/* Operar Opciones pill — top de la columna. */}
      {expanded ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            s.pillFloating,
            {
              right: 20,
              bottom: ctaBottom + optionsOffset,
              width: PILL_WIDTH,
              height: PILL_HEIGHT,
            },
            optionsPillStyle,
          ]}
        >
          <ActionPill
            label="Operar opciones"
            bg={accent}
            textColor={ctaTextColor}
            onPress={handleSelectOptions}
          />
        </Animated.View>
      ) : null}

      {/* Bar — siempre visible, NO dimeada. */}
      <View
        style={[
          s.bar,
          {
            backgroundColor: c.surface,
            borderTopColor: c.border,
            paddingBottom: insets.bottom + 8,
            shadowColor: c.ink,
          },
        ]}
      >
        <View style={s.left}>
          {/* Eyebrow extendido — la spec lo pide explícitamente.
           * Wrap en 2 líneas, font 10px para no dominar el balance. */}
          <Text
            style={[s.eyebrow, { color: c.textMuted }]}
            numberOfLines={2}
          >
            FONDOS DISPONIBLES PARA{"\n"}OPERAR EN ESTE MERCADO
          </Text>
          <Text style={[s.balance, { color: c.text }]} numberOfLines={1}>
            {formatMoney(balance, currency)}
          </Text>
          {isEmpty && onConvert ? (
            // TODO(spec): "mostrar opción de conversión rápida desde
            // otras monedas". Por ahora link a /(app)/convert.
            <Tap onPress={onConvert} haptic="selection" hitSlop={6}>
              <Text style={[s.convertLink, { color: c.brand }]}>
                Convertir desde otra cuenta
              </Text>
            </Tap>
          ) : null}
        </View>

        {/* Right: CTA Operar (collapsed) o pill X (expanded). Mismo
            tamaño/posición — el X reemplaza al CTA in-place. */}
        {expanded ? (
          <Tap
            style={[
              s.ctaSlot,
              s.closePill,
              { borderColor: accent, backgroundColor: c.surface },
            ]}
            onPress={() => collapse()}
            haptic="selection"
            accessibilityLabel="Cerrar opciones"
            accessibilityRole="button"
          >
            <Feather name="x" size={22} color={accent} />
          </Tap>
        ) : (
          <Tap
            style={[s.ctaSlot, { backgroundColor: accent }]}
            onPress={expand}
            haptic="medium"
            accessibilityLabel="Operar este activo"
            accessibilityRole="button"
            accessibilityHint={
              hasPosition
                ? "Te abre las opciones de comprar o vender"
                : "Te abre el flujo de compra"
            }
          >
            <Text style={[s.ctaText, { color: ctaTextColor }]}>Operar</Text>
          </Tap>
        )}
      </View>
    </>
  );
});

/* ─── Pill de acción (Comprar / Vender / Operar Opciones) ─── */

interface ActionPillProps {
  label: string;
  bg: string;
  textColor: string;
  onPress: () => void;
}

function ActionPill({ label, bg, textColor, onPress }: ActionPillProps) {
  return (
    <Tap
      style={[s.actionPill, { backgroundColor: bg }]}
      onPress={onPress}
      haptic="medium"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[s.ctaText, { color: textColor }]}>{label}</Text>
    </Tap>
  );
}

const s = StyleSheet.create({
  dimOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  pillFloating: {
    position: "absolute",
  },
  actionPill: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderCurve: "continuous",
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fontFamily[600],
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.5,
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  convertLink: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 2,
    textDecorationLine: "underline",
  },
  /* Slot del CTA / X — mismo tamaño y radio para que la swap
   * Operar ↔ X sea visualmente in-place. */
  ctaSlot: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderCurve: "continuous",
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  closePill: {
    /* Treatment visual distinto del CTA y de las pills de acción:
     * borde color del sistema cromático, fondo transparente/superficie,
     * ícono X centrado en color cromático. La spec lo pide explícito. */
    borderWidth: 1.6,
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});

export type { Props as TradeBottomBarProps };
