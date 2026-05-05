import { memo, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

/**
 * Bottom bar fija de la pantalla de detalle. Reemplaza los dos
 * botones separados Comprar / Vender por:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Disponibles                              ┌────────────┐ │
 *   │  $ 342.180                                │  Operar    │ │
 *   │                                           └────────────┘ │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Razón del cambio (de la spec):
 *   Con botones separados, "Comprar" en naranja sugería advertencia
 *   y "Vender" en verde sugería acción correcta. Un CTA neutro deja
 *   que el COLOR de la acción refleje exclusivamente el estado del
 *   activo (sistema cromático contextual).
 *
 * Lógica de moneda según mercado del activo (delegada a
 * `nativeCurrencyFor`):
 *   - Argentino → ARS
 *   - Estadounidense → USD
 *   - Crypto → USDT
 *
 * Edge case "saldo en moneda relevante = 0":
 *   La spec pide ofrecer "conversión rápida desde otras monedas"
 *   pero deja el comportamiento exacto como TODO. Por ahora muestro
 *   un sublabel "Convertir desde otras monedas" que rutea a
 *   /(app)/convert (la pantalla ya existe). Decisión de UI exacta
 *   queda para iteración con diseño.
 */

interface Props {
  asset: Asset;
  /** ¿El usuario tiene posición abierta? Habilita el flow de venta
   *  en la sheet selectora. */
  hasPosition: boolean;
  /** Tap en CTA "Operar". El padre decide qué hacer (típico:
   *  abrir TradeSelectorSheet o, si mercado cerrado y queremos
   *  flow diferido, primero mostrar disclaimer). */
  onOperar: () => void;
  /** Tap en el bloque de fondos cuando el saldo es 0 — debe
   *  navegar a /(app)/convert. Inyectado para no acoplar el
   *  componente al router. */
  onConvert?: () => void;
}

export const TradeBottomBar = memo(function TradeBottomBar({
  asset,
  hasPosition,
  onOperar,
  onConvert,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const assetColor = useAssetColorOptional();

  const market = useMemo(() => assetMarket(asset), [asset]);
  const balance = useMemo(() => nativeBalanceFor(market), [market]);
  const currency = useMemo(() => nativeCurrencyFor(market), [market]);
  const isEmpty = balance <= 0;

  // Color del CTA — viene del sistema cromático contextual. Fallback
  // c.text para que el botón siga usable fuera del provider (ej:
  // tests, storybook). El brief lo pide explícitamente: "CTA único
  // 'Operar' prominente, color del sistema cromático".
  const ctaBg = assetColor ? assetColor.color : c.text;
  // Texto del CTA: blanco siempre — los dos colores del sistema
  // (verde brand + naranja #EB5D2A) tienen contraste suficiente
  // contra blanco según WCAG AA en pesos 600+.
  const ctaTextColor = "#FFFFFF";

  return (
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
          // otras monedas". Por ahora link plano que rutea a la
          // pantalla /(app)/convert (existente). Iteración:
          // mostrar inline las cuentas con saldo y la mejor ruta.
          <Tap onPress={onConvert} haptic="selection" hitSlop={6}>
            <Text style={[s.convertLink, { color: c.brand }]}>
              Convertir desde otra cuenta
            </Text>
          </Tap>
        ) : null}
      </View>

      <Tap
        style={[s.cta, { backgroundColor: ctaBg }]}
        onPress={onOperar}
        haptic="medium"
        accessibilityLabel="Operar este activo"
        accessibilityRole="button"
        // hasPosition se usa luego en la sheet (para mostrar/ocultar
        // Vender). Lo paso por props sólo para que el padre tenga
        // un único punto de decisión y la sheet ya lo conozca.
        // No afecta el render del CTA en sí.
        accessibilityHint={
          hasPosition
            ? "Te abre las opciones de comprar o vender"
            : "Te abre el flujo de compra"
        }
      >
        <Text style={[s.ctaText, { color: ctaTextColor }]}>Operar</Text>
      </Tap>
    </View>
  );
});

const s = StyleSheet.create({
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
  cta: {
    paddingHorizontal: 28,
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});

export type { Props as TradeBottomBarProps };
