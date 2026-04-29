import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { AlamosIcon } from "../../lib/components/AlamosIcon";
import {
  assets,
  assetCurrency,
  formatMoney,
  type AssetCurrency,
} from "../../lib/data/assets";
import {
  accounts,
  linkedBanks,
  type LinkedBank,
} from "../../lib/data/accounts";

/**
 * Pantalla de operación comprometida — se muestra cuando un débito
 * bancario quedó "comprometido" durante el puente de conversión.
 * Análogo al estado de IOL: los fondos están reservados pero no
 * acreditados, y el usuario puede reenviar la solicitud a otro CBU
 * sin perder la orden.
 *
 * Recibe los mismos params que ConfirmScreen — ticker + breakdown del
 * bridge — y lista los CBUs disponibles del usuario para reintentar.
 */
export default function CompromisedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const {
    ticker,
    amount,
    currency,
    bridgeFrom,
    bridgeDebit,
    bridgeArs,
  } = useLocalSearchParams<{
    ticker: string;
    amount?: string;
    currency?: string;
    bridgeFrom?: string;
    bridgeDebit?: string;
    bridgeArs?: string;
  }>();

  const asset = assets.find((a) => a.ticker === ticker);
  const nativeCurrency: AssetCurrency =
    (currency as AssetCurrency | undefined) ??
    (asset ? assetCurrency(asset) : "ARS");
  const numAmount = Number(amount) || 0;
  const debitSource = Number(bridgeDebit) || 0;
  const arsEquivalent = Number(bridgeArs) || 0;
  const sourceAccount = accounts.find((a) => a.id === bridgeFrom);

  const eligibleBanks = useMemo(
    () => linkedBanks.filter((b) => b.status === "active"),
    [],
  );

  const [selectedBank, setSelectedBank] = useState<string | null>(
    eligibleBanks[0]?.id ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  const onResubmit = () => {
    if (!selectedBank || submitting) return;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    // Mock: en producción acá se dispara la API de Manteca con el CBU
    // alternativo. Volvemos al confirm con un flag opcional para que
    // re-corra el flow de aprobación.
    setTimeout(() => {
      router.replace({
        pathname: "/(app)/confirm",
        params: {
          ticker: asset?.ticker ?? "",
          amount: amount ?? "0",
          currency: nativeCurrency,
          mode: "buy",
          retryBank: selectedBank,
        },
      });
    }, 350);
  };

  if (!asset) return null;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>
          Operación comprometida
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: ícono + título + explicación. */}
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: c.surfaceSunken }]}>
            <AlamosIcon name="alert" size={28} color={c.text} />
          </View>
          <Text style={[s.heroTitle, { color: c.text }]}>
            Tu conversión quedó en pausa
          </Text>
          <Text style={[s.heroBody, { color: c.textMuted }]}>
            El banco rechazó el débito en{" "}
            <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
              {sourceAccount?.location ?? "tu cuenta"}
            </Text>
            . Los fondos están{" "}
            <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
              reservados pero no debitados
            </Text>{" "}
            — podés reenviar la solicitud a otro CBU sin perder la orden.
          </Text>
        </View>

        {/* Resumen de la operación pendiente. */}
        <Text style={[s.eyebrow, { color: c.textMuted }]}>
          OPERACIÓN PENDIENTE
        </Text>
        <View
          style={[
            s.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <SummaryRow label="Compra" value={`${asset.ticker}`} strong />
          <Divider color={c.border} />
          <SummaryRow
            label="Monto"
            value={formatMoney(numAmount, nativeCurrency)}
          />
          <Divider color={c.border} />
          <SummaryRow
            label="Origen original"
            value={
              sourceAccount
                ? `${sourceAccount.location} · ${sourceAccount.currency}`
                : "—"
            }
          />
          <Divider color={c.border} />
          <SummaryRow
            label="A debitar"
            value={
              sourceAccount
                ? formatMoney(
                    debitSource,
                    sourceAccount.currency as AssetCurrency,
                  )
                : "—"
            }
          />
          <Divider color={c.border} />
          <SummaryRow
            label="Equivalente ARS"
            value={`$ ${arsEquivalent.toLocaleString("es-AR")}`}
          />
        </View>

        {/* Selector de CBU alternativo. */}
        <Text style={[s.eyebrow, { color: c.textMuted, marginTop: 28 }]}>
          REENVIAR A OTRO CBU
        </Text>
        <Text style={[s.eyebrowSub, { color: c.textMuted }]}>
          Elegí desde qué cuenta querés que volvamos a intentar el débito.
        </Text>
        <View style={{ paddingHorizontal: 20, gap: 10, marginTop: 4 }}>
          {eligibleBanks.map((bank) => (
            <BankRow
              key={bank.id}
              bank={bank}
              selected={selectedBank === bank.id}
              onPress={() => setSelectedBank(bank.id)}
            />
          ))}
          <Pressable
            onPress={() => router.push("/(app)/transfer")}
            style={[
              s.addBank,
              { borderColor: c.border, backgroundColor: c.surface },
            ]}
          >
            <Feather name="plus" size={16} color={c.textSecondary} />
            <Text style={[s.addBankText, { color: c.textSecondary }]}>
              Vincular otro banco
            </Text>
          </Pressable>
        </View>

        {/* Acciones */}
        <View style={[s.actions, { paddingHorizontal: 20, marginTop: 28 }]}>
          <Pressable
            onPress={onResubmit}
            disabled={!selectedBank || submitting}
            style={[
              s.cta,
              {
                backgroundColor:
                  selectedBank && !submitting ? c.text : c.surfaceHover,
              },
            ]}
          >
            <Text
              style={[
                s.ctaText,
                {
                  color:
                    selectedBank && !submitting ? c.bg : c.textMuted,
                },
              ]}
            >
              {submitting ? "Reenviando..." : "Reenviar a este banco"}
            </Text>
            {!submitting ? (
              <Feather
                name="arrow-right"
                size={16}
                color={selectedBank ? c.bg : c.textMuted}
              />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(app)/(tabs)")}
            style={s.secondaryBtn}
            hitSlop={8}
          >
            <Text style={[s.secondaryText, { color: c.textMuted }]}>
              Cancelar y volver al portafolio
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function BankRow({
  bank,
  selected,
  onPress,
}: {
  bank: LinkedBank;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.bankRow,
        {
          backgroundColor: c.surface,
          borderColor: selected ? c.text : c.border,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
    >
      <View style={[s.bankLogo, { backgroundColor: c.surfaceSunken }]}>
        <Text style={[s.bankLogoText, { color: c.text }]}>
          {bank.bank.slice(0, 1)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.bankName, { color: c.text }]}>{bank.bank}</Text>
        <Text style={[s.bankAlias, { color: c.textMuted }]}>
          {bank.alias} · ···{bank.last4}
        </Text>
      </View>
      <View
        style={[
          s.radio,
          {
            borderColor: selected ? c.text : c.border,
            backgroundColor: selected ? c.text : "transparent",
          },
        ]}
      >
        {selected ? (
          <Feather name="check" size={11} color={c.bg} />
        ) : null}
      </View>
    </Pressable>
  );
}

function SummaryRow({
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
    <View style={s.summaryRow}>
      <Text style={[s.summaryLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[
          s.summaryValue,
          { color: c.text },
          strong && { fontFamily: fontFamily[700], fontSize: 15 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: color,
        marginHorizontal: -16,
      }}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 30,
    marginBottom: 10,
  },
  heroBody: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
  },

  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  eyebrowSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  summaryLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  summaryValue: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
    flexShrink: 1,
    textAlign: "right",
  },

  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
  },
  bankLogo: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  bankLogoText: {
    fontFamily: fontFamily[800],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  bankName: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  bankAlias: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  addBank: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addBankText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },

  actions: {
    gap: 12,
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
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
});
