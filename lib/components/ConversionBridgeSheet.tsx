import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../theme";
import {
  formatARS,
  formatMoney,
  type AssetCurrency,
} from "../data/assets";
import {
  bridgeOptionsFor,
  type BridgeOption,
} from "../data/accounts";

interface Props {
  visible: boolean;
  /** Moneda destino — la del activo que estás comprando. */
  targetCurrency: AssetCurrency;
  /** Cantidad necesaria en la moneda destino para cerrar la compra. */
  targetAmount: number;
  /** Ticker del activo, sólo para contexto en el header. */
  assetTicker: string;
  /**
   * Se dispara cuando el usuario confirma la fuente. Quien recibe es
   * responsable de pasar la opción al confirm screen.
   */
  onConfirm: (opt: BridgeOption) => void;
  onClose: () => void;
}

/**
 * Bottom sheet que aparece cuando la moneda nativa del activo no tiene
 * saldo suficiente. Muestra todas las cuentas disponibles con la
 * conversión calculada (rate efectivo, spread, monto a debitar y
 * equivalente ARS) para que el usuario elija la fuente.
 *
 * El backend de Manteca va a ejecutar esto como dos eventos separados
 * (conversión + compra) pero la UI los presenta como uno sólo: el
 * usuario aprueba "convertir y comprar" en un solo swipe.
 */
export function ConversionBridgeSheet({
  visible,
  targetCurrency,
  targetAmount,
  assetTicker,
  onConfirm,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const options = useMemo(
    () => bridgeOptionsFor(targetAmount, targetCurrency),
    [targetAmount, targetCurrency],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose} />
      <View
        style={[
          s.sheet,
          {
            backgroundColor: c.bg,
            paddingBottom: insets.bottom + 16,
            borderColor: c.border,
          },
        ]}
      >
        <View style={s.grabber}>
          <View style={[s.grabberPill, { backgroundColor: c.borderStrong }]} />
        </View>

        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: c.text }]}>
              Puente de conversión
            </Text>
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              Para comprar {assetTicker} necesitás{" "}
              <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
                {formatMoney(targetAmount, targetCurrency)}
              </Text>
              . Elegí desde qué cuenta tomamos los fondos.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={[s.closeBtn, { backgroundColor: c.surfaceHover }]}
          >
            <Feather name="x" size={16} color={c.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {options.map((opt) => (
            <BridgeOptionRow
              key={opt.from.id}
              opt={opt}
              targetCurrency={targetCurrency}
              targetAmount={targetAmount}
              onPress={() => opt.enough && onConfirm(opt)}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function BridgeOptionRow({
  opt,
  targetCurrency,
  targetAmount,
  onPress,
}: {
  opt: BridgeOption;
  targetCurrency: AssetCurrency;
  targetAmount: number;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const sameCurrency = opt.from.currency === targetCurrency;
  const disabled = !opt.enough;

  // Etiqueta principal de la cuenta — moneda + ubicación.
  const label =
    opt.from.currency === "USDT"
      ? "Crypto · USDT"
      : `${opt.from.location} · ${opt.from.currency}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.optRow,
        {
          backgroundColor: disabled ? c.surfaceSunken : c.surface,
          borderColor: c.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={s.optHead}>
        <View style={{ flex: 1 }}>
          <Text style={[s.optLabel, { color: c.text }]}>{label}</Text>
          <Text
            style={[s.optBalance, { color: c.textMuted }]}
            numberOfLines={1}
          >
            Disponible:{" "}
            {formatMoney(opt.from.balance, opt.from.currency as AssetCurrency)}
          </Text>
        </View>
        {sameCurrency ? (
          <View style={[s.directBadge, { backgroundColor: c.greenDim }]}>
            <Text style={[s.directBadgeText, { color: c.greenDark }]}>
              Sin conversión
            </Text>
          </View>
        ) : opt.settles === "T+1" ? (
          <View style={[s.t1Badge, { backgroundColor: c.surfaceHover }]}>
            <Feather name="clock" size={11} color={c.textSecondary} />
            <Text style={[s.t1BadgeText, { color: c.textSecondary }]}>
              Liquida T+1
            </Text>
          </View>
        ) : null}
      </View>

      {/* Desglose de la conversión. Para same-currency mostramos sólo el
          débito; para conversión, rate + spread + ARS-equivalente. */}
      <View style={[s.detailBlock, { borderColor: c.border }]}>
        {!sameCurrency ? (
          <>
            <DetailRow
              label="Tipo de cambio"
              value={`1 ${opt.from.currency} = ${formatRate(
                opt.rateNet,
                targetCurrency,
              )}`}
            />
            <DetailRow
              label={`Spread (${(opt.feePct * 100).toFixed(2).replace(".", ",")}%)`}
              value={formatMoney(
                opt.feeAmountSource,
                opt.from.currency as AssetCurrency,
              )}
            />
            <DetailRow
              label="Equivalente ARS"
              value={formatARS(opt.arsEquivalent)}
            />
          </>
        ) : null}
        <DetailRow
          label="A debitar"
          value={formatMoney(
            opt.debitSource,
            opt.from.currency as AssetCurrency,
          )}
          strong
        />
        <DetailRow
          label="Comprás"
          value={formatMoney(targetAmount, targetCurrency)}
          strong
        />
      </View>

      {disabled ? (
        <Text style={[s.notEnough, { color: c.textMuted }]}>
          Saldo insuficiente para cubrir la operación.
        </Text>
      ) : (
        <View style={[s.useBtn, { backgroundColor: c.text }]}>
          <Text style={[s.useBtnText, { color: c.bg }]}>
            Usar esta cuenta
          </Text>
          <Feather name="arrow-right" size={14} color={c.bg} />
        </View>
      )}
    </Pressable>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={s.detailRow}>
      <Text style={[s.detailLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[
          s.detailValue,
          { color: c.text },
          strong && { fontFamily: fontFamily[700] },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/** "$ 1.198,40" / "USDT 0,9956" según target. */
function formatRate(rate: number, target: AssetCurrency): string {
  const decimals = target === "ARS" ? 2 : 4;
  const formatted = rate.toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (target === "ARS") return `$ ${formatted}`;
  if (target === "USD") return `US$ ${formatted}`;
  return `USDT ${formatted}`;
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    alignItems: "center",
    paddingVertical: 8,
  },
  grabberPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  /* Option row */
  optRow: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  optHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optLabel: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  optBalance: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  directBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  directBadgeText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.2,
  },
  t1Badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  t1BadgeText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.2,
  },

  detailBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
  },
  detailValue: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },

  notEnough: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 12,
    textAlign: "center",
  },

  useBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: radius.btn,
    marginTop: 12,
  },
  useBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.1,
  },
});
