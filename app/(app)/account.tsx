import { useState } from "react";
import {
  View, Text, Pressable, ScrollView, Switch, StyleSheet, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── Mock account data ─── */
const ACCOUNT_NUM = "234891";
const heldAssets = assets.filter((a) => a.held);
const portfolioValue = heldAssets.reduce((s, a) => s + a.price * (a.qty || 1), 0);
const cashBalance = 342180;
const totalValue = portfolioValue + cashBalance;

const stocksValue = heldAssets
  .filter((a) => a.category === "acciones" || a.category === "cedears")
  .reduce((s, a) => s + a.price * (a.qty || 1), 0);
const bondsValue = heldAssets
  .filter((a) => a.category === "bonos")
  .reduce((s, a) => s + a.price * (a.qty || 1), 0);

/* ─── Recent transactions ─── */
interface Transaction {
  label: string;
  date: string;
  amount: string;
  pending?: boolean;
}

const recentTx: Transaction[] = [
  { label: "Compra YPFD", date: "28 mar 2026", amount: "-$45.200" },
  { label: "Compra GD30", date: "27 mar 2026", amount: "-$120.000" },
  { label: "Depósito desde CBU", date: "25 mar 2026", amount: "+$200.000", pending: true },
  { label: "Venta ALUA", date: "24 mar 2026", amount: "+$18.340" },
  { label: "Dividendo YPFD", date: "20 mar 2026", amount: "+$1.250" },
  { label: "Compra AL30", date: "18 mar 2026", amount: "-$85.000" },
];

/* ─── Donut chart helper ─── */
const DONUT_SIZE = 160;
const STROKE = 14;

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showTxAll, setShowTxAll] = useState(false);
  const [dripEnabled, setDripEnabled] = useState(false);
  const [interestEnabled, setInterestEnabled] = useState(true);
  const [lendingEnabled, setLendingEnabled] = useState(false);
  const [withdrawLock, setWithdrawLock] = useState(false);

  const investedPct = totalValue > 0 ? Math.round((portfolioValue / totalValue) * 100) : 0;

  const visibleTx = showTxAll ? recentTx : recentTx.slice(0, 4);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerLabel}>Nº de Cuenta</Text>
          <Text style={s.headerAccount}>{ACCOUNT_NUM}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {/* ══════════════════════════════════════
          SECTION 1: Investing Overview
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Inversiones</Text>

        {/* Portfolio Value */}
        <Text style={s.valueLabel}>Valor del portafolio</Text>
        <Text style={s.valueAmount}>{formatARS(totalValue)}</Text>
        <Text style={s.valueDesc}>
          El valor del portafolio representa el total de tus tenencias, incluyendo efectivo.
        </Text>

        {/* Donut chart */}
        <View style={s.donutArea}>
          <View style={s.donutRing}>
            {/* Green arc (invested) */}
            <View style={[s.donutArc, { borderColor: colors.brand[500] }]} />
            {/* Center text */}
            <View style={s.donutCenter}>
              <Text style={s.donutValue}>{formatARS(totalValue)}</Text>
              <Text style={s.donutLabel}>Portafolio</Text>
            </View>
          </View>

          {/* Legend */}
          <View style={s.donutLegend}>
            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <Text style={s.legendLabel}>Acciones y CEDEARs</Text>
                <Text style={s.legendValue}>{formatARS(stocksValue)}</Text>
              </View>
            </View>
            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <Text style={s.legendLabel}>Bonos</Text>
                <Text style={s.legendValue}>{formatARS(bondsValue)}</Text>
              </View>
            </View>
            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <Text style={s.legendLabel}>Efectivo</Text>
                <Text style={s.legendValue}>{formatARS(cashBalance)}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 2: Instant Deposits / Salud depósitos
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.subSectionLabel}>Salud de depósitos</Text>
        <Text style={s.healthStatus}>Buena</Text>
        <Text style={s.valueDesc}>
          Tenés acceso a hasta $1.000.000 de depósitos instantáneos. Esto significa que podés invertir tus depósitos mientras se acreditan desde tu banco.{" "}
          <Text style={s.linkText}>Más información</Text>
        </Text>

        {/* Details rows */}
        <View style={s.detailRows}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Límite de depósito instantáneo</Text>
            <Text style={s.detailValue}>{formatARS(1000000)}</Text>
          </View>
          <View style={s.detailDivider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Depósitos pendientes</Text>
            <Text style={s.detailValue}>{formatARS(200000)}</Text>
          </View>
          <View style={s.detailDivider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Depósitos acreditados</Text>
            <Text style={s.detailValue}>{formatARS(200000)}</Text>
          </View>
          <View style={s.detailDivider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Depósitos instantáneos usados</Text>
            <Text style={s.detailValue}>{formatARS(0)}</Text>
          </View>
        </View>

        {/* Deposit button */}
        <Pressable style={s.outlineBtn}>
          <Text style={s.outlineBtnText}>Depositar fondos</Text>
        </Pressable>
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 3: Recurring Investments
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.subSectionLabel}>Inversiones recurrentes</Text>
        <Text style={s.healthStatus}>0</Text>
        <Text style={s.valueDesc}>
          Las inversiones recurrentes compran acciones, CEDEARs o bonos automáticamente en un horario definido. Podés pausar o eliminar tus inversiones recurrentes en cualquier momento.{" "}
          <Text style={s.linkText}>Más información</Text>
        </Text>

        <Pressable style={s.outlineBtn}>
          <Text style={s.outlineBtnText}>Ver inversiones recurrentes</Text>
        </Pressable>
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 4: Dividend Reinvestment
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.subSectionLabel}>Reinversión de dividendos</Text>
        <Text style={s.healthStatus}>{dripEnabled ? "Activada" : "Desactivada"}</Text>
        <Text style={s.valueDesc}>
          La reinversión de dividendos (DRIP) reinvierte automáticamente los pagos de dividendos en acciones adicionales del activo subyacente.{" "}
          <Text style={s.linkText}>Más información</Text>
        </Text>

        <Pressable
          style={s.outlineBtn}
          onPress={() => setDripEnabled(!dripEnabled)}
        >
          <Text style={s.outlineBtnText}>
            {dripEnabled ? "Desactivar reinversión" : "Activar reinversión"}
          </Text>
        </Pressable>
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 5: Cash Sweep / Programa de intereses
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.subSectionLabel}>Programa de intereses</Text>
        <Text style={s.healthStatus}>{interestEnabled ? "Activado" : "Desactivado"}</Text>
        <Text style={s.valueDesc}>
          Estás generando intereses sobre el efectivo no invertido en tu cuenta comitente. Tu próximo pago de intereses es el 30 de abril.{" "}
          <Text style={s.linkText}>Más información</Text>
        </Text>

        <View style={s.detailRows}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Tasa nominal anual (TNA)</Text>
            <Text style={s.detailValue}>65%</Text>
          </View>
          <View style={s.detailDivider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Efectivo barrido</Text>
            <Text style={s.detailValue}>{formatARS(cashBalance)}</Text>
          </View>
          <View style={s.detailDivider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Intereses pendientes</Text>
            <Text style={s.detailValue}>{formatARS(0)}</Text>
          </View>
          <View style={s.detailDivider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Intereses ganados total</Text>
            <Text style={s.detailValue}>{formatARS(4850)}</Text>
          </View>
        </View>

        <Pressable
          style={s.outlineBtn}
          onPress={() => setInterestEnabled(!interestEnabled)}
        >
          <Text style={s.outlineBtnText}>
            {interestEnabled ? "Desactivar intereses" : "Activar intereses"}
          </Text>
        </Pressable>
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 7: Cash / Efectivo
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Efectivo</Text>
        <Text style={s.cashValue}>{formatARS(cashBalance)}</Text>

        {/* Recent transactions */}
        <Text style={s.subTitle}>Movimientos recientes</Text>

        {visibleTx.map((tx, i) => (
          <Pressable key={i} style={s.txRow}>
            <View>
              <Text style={s.txLabel}>{tx.label}</Text>
              <Text style={s.txDate}>
                {tx.date}
                {tx.pending && <Text style={s.txPending}> · Pendiente</Text>}
              </Text>
            </View>
            <View style={s.txRight}>
              <Text
                style={[
                  s.txAmount,
                  tx.amount.startsWith("+") && s.txAmountPositive,
                ]}
              >
                {tx.amount}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.text.muted} />
            </View>
          </Pressable>
        ))}

        {!showTxAll && recentTx.length > 4 && (
          <Pressable onPress={() => setShowTxAll(true)}>
            <Text style={s.showMore}>Mostrar más</Text>
          </Pressable>
        )}

        {/* Transfer button */}
        <Pressable style={s.greenBtn}>
          <Text style={s.greenBtnText}>Transferir</Text>
        </Pressable>
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 8: Banking / Datos bancarios
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Datos bancarios</Text>

        <View style={s.bankRow}>
          <View style={s.bankIconBox}>
            <Ionicons name="business-outline" size={20} color={colors.text.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bankName}>Banco Galicia</Text>
            <Text style={s.bankDetail}>CBU ····3847</Text>
          </View>
          <View style={s.bankBadge}>
            <Text style={s.bankBadgeText}>Principal</Text>
          </View>
        </View>

        <View style={s.detailRows}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Mostrar CBU/CVU</Text>
            <Switch
              value={false}
              trackColor={{ false: colors.surface[200], true: colors.brand[500] }}
              thumbColor={colors.text.primary}
              style={{ transform: [{ scale: 0.85 }] }}
            />
          </View>
          <View style={s.detailDivider} />
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Bloquear retiros</Text>
            <Switch
              value={withdrawLock}
              onValueChange={setWithdrawLock}
              trackColor={{ false: colors.surface[200], true: colors.brand[500] }}
              thumbColor={colors.text.primary}
              style={{ transform: [{ scale: 0.85 }] }}
            />
          </View>
        </View>

        {withdrawLock && (
          <View style={s.lockCard}>
            <Text style={s.lockTitle}>Retiros bloqueados</Text>
            <Text style={s.lockDesc}>
              Los retiros están bloqueados para prevenir que cualquier persona (incluyéndote) retire dinero de tu cuenta comitente. Podés desbloquearlos en cualquier momento.
            </Text>
          </View>
        )}
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 9: Security
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Seguridad</Text>

        <SettingRow
          icon="finger-print-outline"
          label="Autenticación biométrica"
          rightElement={
            <Switch
              value={true}
              trackColor={{ false: colors.surface[200], true: colors.brand[500] }}
              thumbColor={colors.text.primary}
              style={{ transform: [{ scale: 0.85 }] }}
            />
          }
        />
        <SettingRow
          icon="key-outline"
          label="Cambiar contraseña"
        />
        <SettingRow
          icon="shield-checkmark-outline"
          label="Verificación en dos pasos"
          subtitle="Activada"
        />
        <SettingRow
          icon="phone-portrait-outline"
          label="Dispositivos autorizados"
          subtitle="1 dispositivo"
        />
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 10: Legal
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Legal</Text>

        <SettingRow icon="document-text-outline" label="Acuerdo de cuenta comitente" />
        <SettingRow icon="document-text-outline" label="Tabla de comisiones y aranceles" />
        <SettingRow icon="document-text-outline" label="Política de privacidad" />
        <SettingRow icon="document-text-outline" label="Términos y condiciones" />
        <SettingRow icon="document-text-outline" label="Información del agente (CNV)" />
      </View>

      <View style={s.thickDivider} />

      {/* ══════════════════════════════════════
          SECTION 11: Fee table
          ══════════════════════════════════════ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Comisiones y aranceles</Text>
        <Text style={s.valueDesc}>
          Álamos Capital busca mantener las comisiones lo más bajas posible para los inversores argentinos.
        </Text>

        <View style={s.feeTable}>
          <View style={s.feeHeaderRow}>
            <Text style={s.feeHeaderLabel}>Concepto</Text>
            <Text style={s.feeHeaderValue}>Costo</Text>
          </View>
          {[
            { label: "Comisión mensual", value: "$0" },
            { label: "Compra/venta acciones", value: "0,5%" },
            { label: "Compra/venta CEDEARs", value: "0,5%" },
            { label: "Compra/venta bonos", value: "0,25%" },
            { label: "Transferencia de fondos", value: "$0" },
            { label: "Custodia de títulos", value: "$0" },
            { label: "Derecho de mercado (BYMA)", value: "Incluido" },
          ].map((fee, i) => (
            <View key={i} style={s.feeRow}>
              <Text style={s.feeLabel}>{fee.label}</Text>
              <Text style={s.feeValue}>{fee.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Disclaimer ── */}
      <View style={s.disclaimerSection}>
        <Text style={s.disclaimerText}>
          Álamos Capital S.A. es un Agente de Liquidación y Compensación registrado ante la Comisión Nacional de Valores (CNV) bajo el N° XXX. Todas las inversiones implican riesgo, incluyendo la posible pérdida del capital invertido. Los rendimientos pasados no garantizan rendimientos futuros.
        </Text>
      </View>
    </ScrollView>
  );
}

/* ─── SettingRow subcomponent ─── */
interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
}

function SettingRow({ icon, label, subtitle, rightElement, onPress }: SettingRowProps) {
  return (
    <Pressable style={s.settingRow} onPress={onPress}>
      <View style={s.settingLeft}>
        <View style={s.settingIconBox}>
          <Ionicons name={icon} size={18} color={colors.text.secondary} />
        </View>
        <View>
          <Text style={s.settingLabel}>{label}</Text>
          {subtitle ? <Text style={s.settingSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
      )}
    </Pressable>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: { alignItems: "center" },
  headerLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  headerAccount: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: 1,
  },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 12,
    marginTop: 24,
  },
  subSectionLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  healthStatus: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 12,
  },

  /* Value display */
  valueLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  valueAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 12,
  },
  valueDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  linkText: {
    color: colors.brand[500],
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  /* Donut chart */
  donutArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingVertical: 12,
  },
  donutRing: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  donutArc: {
    position: "absolute",
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    borderRadius: DONUT_SIZE / 2,
    borderWidth: STROKE,
    borderColor: colors.brand[500],
    borderRightColor: colors.surface[200],
  },
  donutCenter: {
    alignItems: "center",
  },
  donutValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  donutLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },

  /* Legend */
  donutLegend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {},
  legendItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legendLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Detail rows */
  detailRows: {
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  detailLabel: {
    fontSize: 15,
    color: colors.text.secondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
  },

  /* Buttons */
  outlineBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  outlineBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brand[500],
  },
  greenBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  greenBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface[0],
  },

  /* Thick divider */
  thickDivider: {
    height: 6,
    backgroundColor: colors.surface[100],
  },

  /* Cash */
  cashValue: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1,
    marginBottom: 8,
  },

  /* Transactions */
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.primary,
    marginBottom: 3,
  },
  txDate: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  txPending: {
    color: colors.text.muted,
    fontStyle: "italic",
  },
  txRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  txAmountPositive: {
    color: colors.brand[500],
  },
  showMore: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand[500],
    marginTop: 12,
  },

  /* Bank */
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface[100],
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  bankIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  bankName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 2,
  },
  bankDetail: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  bankBadge: {
    backgroundColor: colors.accentDim,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bankBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand[500],
  },

  /* Lock card */
  lockCard: {
    backgroundColor: colors.surface[100],
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  lockTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
  },
  lockDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  /* Setting row */
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface[100],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: "500",
  },
  settingSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },

  /* Fee table */
  feeTable: {
    backgroundColor: colors.surface[100],
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },
  feeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  feeHeaderLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  feeHeaderValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  feeLabel: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: "400",
  },
  feeValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Disclaimer */
  disclaimerSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
  },
});
