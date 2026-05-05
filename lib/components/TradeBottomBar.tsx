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
/* Pills más slim — height 48 + radius pill (999) → forma de píldora
 * real (rounded ends), no rectángulo redondeado. Matchea el estilo
 * de la captura de Robinhood: chatas, finas, elegantes (no gordas
 * y cuadradas como estaban con height 52 + radius 18). */
const PILL_HEIGHT = 48;
const PILL_GAP = 8;
const STAGGER_MS = 50;
const DUR = 280;
/* Dim en 2 niveles:
 *   - STRONG (arriba del bar) → 0.55 — el resto de la pantalla
 *     se difumina fuerte, foco va a las pills.
 *   - WEAK (sobre el bar)     → 0.22 — 'Fondos disponibles' +
 *     balance se ven mateados pero todavía legibles. Le da al user
 *     una glance de cuánto tiene mientras decide la acción.
 * El feedback explícito del user fue: "todo se pone gris pero lo
 * del bottom que dice fondos disponibles y operar menos". */
const DIM_OPACITY_STRONG = 0.55;
/* Bar queda visualmente intacto cuando expanded (Robinhood-style:
 * superficie inferior 100% limpia, foco va a las pills flotantes
 * con shadow). El layer del weak dim sigue rendereándose con opacity
 * 0 — invisible pero su Pressable atrapa taps sobre 'Fondos
 * disponibles' para cerrar el menú (UX consistente con tap-fuera). */
const DIM_OPACITY_WEAK = 0;

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

  const ctaBottom = insets.bottom + 8;
  /* Altura del bar (paddingBottom + content + paddingTop). La uso
   * para tilear los 2 dims y para anclar las pills arriba del bar
   * con un gap visible (sin pisar el top edge del rectángulo). */
  const barHeight = insets.bottom + 8 + PILL_HEIGHT + 14;

  /* Offsets verticales relativos al CTA (donde está el X cuando
   * expanded).
   *
   * IMPORTANTE: el bar tiene paddingTop:14 entre el top de la barra
   * y el top del CTA. Si tomamos PILL_HEIGHT+PILL_GAP como offset
   * de la primera pill, esa pill termina dentro del paddingTop del
   * bar (visualmente solapada con el rectángulo de abajo). El user
   * lo señaló: 'el vender está compitiendo con la parte de abajo
   * blanca'. La spec real (Robinhood) tiene Sell justo arriba del
   * rectángulo, con gap visible.
   *
   * Fix: la pill más cercana al bar (Vender si hasPosition, Comprar
   * si no) se ancla al BORDE SUPERIOR del bar + PILL_GAP — no a la
   * top del CTA. Esto le da el gap visual que falta.
   *
   * aboveBarBase = (barHeight - ctaBottom) + PILL_GAP
   *              = paddingTop(14) + PILL_HEIGHT(48) + PILL_GAP(8)
   *              = 70 — la primera pill queda 70px arriba del CTA
   *              bottom, lo que la pone exactamente PILL_GAP por
   *              encima del top edge del bar. */
  const aboveBarBase = barHeight - ctaBottom + PILL_GAP;
  const sellOffset = aboveBarBase;
  const buyOffset =
    aboveBarBase + (hasPosition ? 1 : 0) * (PILL_HEIGHT + PILL_GAP);
  const optionsOffset =
    aboveBarBase + (hasPosition ? 2 : 1) * (PILL_HEIGHT + PILL_GAP);

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
  const strongDimStyle = useAnimatedStyle(() => ({
    opacity: dimProgress.value * DIM_OPACITY_STRONG,
  }));
  const weakDimStyle = useAnimatedStyle(() => ({
    opacity: dimProgress.value * DIM_OPACITY_WEAK,
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


  return (
    /* Z-order (orden de render = orden visual):
     *   1. Bar                 → bottom (siempre visible; cuando
     *                                    expanded queda DEBAJO del
     *                                    dim así también se difumina,
     *                                    el foco va 100% a las pills)
     *   2. Dim overlay         → mid    (cubre todo incluyendo el bar)
     *   3. X pill (floating)   → top    (re-renderizada por encima
     *                                    del dim, mismo lugar visual
     *                                    donde estaba el CTA)
     *   4. Action pills        → top    (Comprar/Vender/Opciones,
     *                                    también por encima del dim) */
    <>
      {/* 1) Bar — debajo del dim cuando expanded. */}
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
          <Text
            style={[s.eyebrow, { color: c.textMuted }]}
            numberOfLines={1}
          >
            Fondos disponibles
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

        {/* Slot derecho: si collapsed, CTA Operar. Si expanded, un
            placeholder vacío del mismo tamaño para que el layout del
            bar no salte (la X real se renderea como float arriba del
            dim, en este mismo slot pero por z-order). */}
        {expanded ? (
          <View style={s.ctaSlot} />
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

      {/* 2a) Strong dim — cubre arriba del bar (la mayoría del screen).
             Foco va a las pills. */}
      {expanded ? (
        <Animated.View
          style={[
            s.dimOverlay,
            { backgroundColor: c.ink, bottom: barHeight },
            strongDimStyle,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => collapse()}
            accessibilityLabel="Cerrar opciones"
          />
        </Animated.View>
      ) : null}

      {/* 2b) Weak dim — cubre solo el bar. Mateado pero legible:
             'Fondos disponibles' + balance se ven más sutiles que
             el resto de la pantalla pero el user todavía puede leer
             cuánto tiene mientras decide qué pill tocar. */}
      {expanded ? (
        <Animated.View
          style={[
            s.dimOverlay,
            {
              backgroundColor: c.ink,
              top: undefined,
              height: barHeight,
            },
            weakDimStyle,
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => collapse()}
            accessibilityLabel="Cerrar opciones"
          />
        </Animated.View>
      ) : null}

      {/* 3) X pill float — encima del dim, en el slot donde estaba
            el CTA (right:20, bottom:insets.bottom+8). */}
      {expanded ? (
        <Tap
          style={[
            s.xPillFloat,
            s.closePill,
            {
              right: 20,
              bottom: ctaBottom,
              borderColor: accent,
              backgroundColor: c.surface,
            },
          ]}
          onPress={() => collapse()}
          haptic="selection"
          accessibilityLabel="Cerrar opciones"
          accessibilityRole="button"
        >
          <Feather name="x" size={22} color={accent} />
        </Tap>
      ) : null}

      {/* 4) Action pills — Vender, Comprar, Opciones — por encima del
            dim. Se animan emergiendo desde la posición del CTA. */}
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
  /* X pill flotante — re-renderizada arriba del dim, en el mismo
   * lugar visual donde está el slot del CTA en el bar (right:20,
   * bottom: insets.bottom+8). Mismo tamaño que las action pills. */
  xPillFloat: {
    position: "absolute",
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPill: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderCurve: "continuous",
    /* Full pill (radius 999) — forma de píldora real con extremos
     * completamente redondeados. La spec se basó en la captura de
     * Robinhood donde las pills son chatas y elegantes, NO rectángulos
     * redondeados como estaba antes con radius.btn (18). */
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 8,
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
    marginTop: 4,
  },
  convertLink: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 2,
    textDecorationLine: "underline",
  },
  /* Slot del CTA / X — full pill matcheando las pills de acción
   * para consistencia visual cuando la swap Operar ↔ X ocurre. */
  ctaSlot: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  closePill: {
    /* Treatment visual distinto del CTA y de las pills de acción:
     * borde color del sistema cromático, fondo c.surface, ícono X
     * centrado en color cromático. La spec lo pide explícito. */
    borderWidth: 1.6,
  },
  ctaText: {
    /* Weight 600 (semi-bold) en vez de 700 — el bold se sentía
     * tosco. 15px en vez de 16. Más cerca de la elegancia del
     * mockup de referencia. */
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.15,
  },
});

export type { Props as TradeBottomBarProps };
