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

/**
 * Bottom bar fija de la pantalla de detalle.
 *
 * Estado inicial — bar visible:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Disponibles                              ┌────────────┐ │
 *   │  $ 342.180                                │  Operar    │ │
 *   │                                           └────────────┘ │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Al tappear Operar — pills desplegadas verticalmente desde el CTA:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  (dim)                                    ┌────────────┐ │
 *   │  (dim)                                    │  Comprar   │ │
 *   │  (dim)                                    └────────────┘ │
 *   │  (dim)                                    ┌────────────┐ │
 *   │  (dim)                                    │  Vender    │ │
 *   │  (dim)                                    └────────────┘ │
 *   ├──────────────────────────────────────────────────────────│
 *   │  Disponibles                              ┌────────────┐ │
 *   │  $ 342.180                                │     X      │ │
 *   │                                           └────────────┘ │
 *   └──────────────────────────────────────────────────────────┘
 *
 * - El "Disponibles" sigue visible siempre (NO está dimeado — la
 *   spec dice "el resto de la pantalla" = arriba del bar).
 * - El X pill reemplaza al CTA Operar in-place (mismo ancho, alto,
 *   posición). Treatment visual distinto: borde color cromático,
 *   fondo transparente.
 * - Comprar y Vender aparecen ABOVE the bar with stagger animation
 *   (cada una 50ms después de la anterior, 280ms ease-out).
 * - Tap en X o tap en el dim cierra y vuelve al estado inicial.
 *
 * Mercado cerrado: las pills cambian copy a "Programar compra" /
 * "Programar venta". El flow internamente (buy.tsx) detecta el
 * cierre y encola en lugar de ejecutar inmediato.
 *
 * Vender se oculta si !hasPosition (no se puede vender lo que no
 * tenés).
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

const PILL_WIDTH = 160;
const PILL_HEIGHT = 52;
const PILL_GAP = 8;
const STAGGER_MS = 50;
const DUR = 280;

export const TradeBottomBar = memo(function TradeBottomBar({
  asset,
  hasPosition,
  onSelect,
  onConvert,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const assetColor = useAssetColorOptional();

  const market = useMemo(() => assetMarket(asset), [asset]);
  const balance = useMemo(() => nativeBalanceFor(market), [market]);
  const currency = useMemo(() => nativeCurrencyFor(market), [market]);
  const isEmpty = balance <= 0;

  const accent = assetColor ? assetColor.color : c.text;
  const ctaTextColor = "#FFFFFF";

  // Mercado cerrado → pills cambian a "Programar compra/venta". El
  // flow del buy.tsx detecta el cierre y encola la orden.
  const isMarketClosed = useMemo(() => {
    const reason = closedReasonFor(asset);
    return reason.kind !== "open" && reason.kind !== "notApplicable";
  }, [asset]);

  const buyLabel = isMarketClosed ? "Programar compra" : "Comprar";
  const sellLabel = isMarketClosed ? "Programar venta" : "Vender";

  const [expanded, setExpanded] = useState(false);

  // Progreso por pill (Comprar=top, Vender=middle, X=bottom). El X
  // siempre es 1 cuando expanded (no se anima), las otras tienen
  // stagger desde abajo hacia arriba.
  const buyProgress = useSharedValue(0);
  const sellProgress = useSharedValue(0);
  const dimProgress = useSharedValue(0);

  const expand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setExpanded(true);
    // Bottom-up stagger: Vender primero (más cerca del CTA), Comprar
    // después. El X aparece instant (es la transformación visual del CTA).
    dimProgress.value = withTiming(1, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    sellProgress.value = withTiming(1, {
      duration: DUR,
      easing: Easing.out(Easing.cubic),
    });
    buyProgress.value = withDelay(
      STAGGER_MS,
      withTiming(1, {
        duration: DUR,
        easing: Easing.out(Easing.cubic),
      }),
    );
  };

  const collapse = (cb?: () => void) => {
    Haptics.selectionAsync().catch(() => {});
    // Reverse animation: las pills colapsan hacia donde estaba el CTA.
    buyProgress.value = withTiming(0, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
    });
    sellProgress.value = withDelay(
      STAGGER_MS,
      withTiming(0, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      }),
    );
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

  // Si el padre cambia onSelect/asset durante la animación, los
  // shared values quedan en estado stale. Cleanup al unmount.
  useEffect(() => {
    return () => {
      buyProgress.value = 0;
      sellProgress.value = 0;
      dimProgress.value = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Estilos animados ─── */

  // Distancia desde la posición CTA hasta la posición final de cada pill.
  // Vender está 1 fila arriba, Comprar está 2 filas arriba.
  const sellOffset = PILL_HEIGHT + PILL_GAP;
  const buyOffset = 2 * (PILL_HEIGHT + PILL_GAP);

  const buyPillStyle = useAnimatedStyle(() => ({
    opacity: buyProgress.value,
    transform: [
      {
        translateY: interpolate(buyProgress.value, [0, 1], [buyOffset, 0]),
      },
    ],
  }));
  const sellPillStyle = useAnimatedStyle(() => ({
    opacity: sellProgress.value,
    transform: [
      {
        translateY: interpolate(sellProgress.value, [0, 1], [sellOffset, 0]),
      },
    ],
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimProgress.value * 0.38,
  }));

  const handleSelect = (mode: "buy" | "sell") => {
    // Cerramos primero (animación de salida) y disparamos el callback
    // DESPUÉS — así el push de navigate corre con las pills ya fuera
    // de pantalla y se ve más limpio.
    collapse(() => onSelect(mode));
  };

  return (
    <>
      {/* Dim overlay encima del resto del screen, BAJO el bar (orden
          de render: dim primero, bar después). pointerEvents auto
          sólo cuando expanded para que el tap-out funcione. */}
      {expanded ? (
        <Animated.View
          style={[
            s.dimOverlay,
            { backgroundColor: c.ink },
            dimStyle,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => collapse()}
            accessibilityLabel="Cerrar opciones"
          />
        </Animated.View>
      ) : null}

      {/* Vender + Comprar pills, posicionados absolutos arriba del bar.
          Render fuera del bar para no estar afectados por su layout. */}
      {expanded && hasPosition ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            s.pillFloating,
            {
              right: 20,
              bottom: insets.bottom + 8 + sellOffset,
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
      {expanded ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            s.pillFloating,
            {
              right: 20,
              bottom:
                insets.bottom + 8 + (hasPosition ? buyOffset : sellOffset),
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
          <Text style={[s.eyebrow, { color: c.textMuted }]}>
            Disponibles
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

/* ─── Pill de acción (Comprar / Vender) ─── */

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
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
    marginTop: 2,
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
