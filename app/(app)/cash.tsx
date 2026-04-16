import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { formatARS } from "../../lib/data/assets";

const cashBalance = 342180;
const interestThisMonth = 8540;
const interestTotal = 15420;
const tna = 97;

const transactions = [
  { id: "1", type: "interest", label: "Interés acreditado", amount: 4270, date: "11 abr" },
  { id: "2", type: "deposit", label: "Depósito", amount: 150000, date: "8 abr" },
  { id: "3", type: "interest", label: "Interés acreditado", amount: 4270, date: "1 abr" },
  { id: "4", type: "withdraw", label: "Retiro a cuenta bancaria", amount: -50000, date: "28 mar" },
  { id: "5", type: "interest", label: "Interés acreditado", amount: 3890, date: "22 mar" },
  { id: "6", type: "deposit", label: "Depósito", amount: 200000, date: "15 mar" },
];

export default function CashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* Hero */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>Efectivo disponible</Text>
        <Text style={s.heroAmount}>{formatARS(cashBalance)}</Text>
        <View style={s.tnaPill}>
          <Feather name="zap" size={12} color="#000" />
          <Text style={s.tnaPillText}>Generando TNA {tna}%</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        <Pressable style={s.actionBtn} onPress={() => router.push("/(app)/transfer")}>
          <View style={s.actionIcon}>
            <Feather name="arrow-down-left" size={20} color={colors.brand[500]} />
          </View>
          <Text style={s.actionText}>Depositar</Text>
        </Pressable>
        <Pressable style={s.actionBtn} onPress={() => router.push("/(app)/transfer")}>
          <View style={s.actionIcon}>
            <Feather name="arrow-up-right" size={20} color={colors.brand[500]} />
          </View>
          <Text style={s.actionText}>Retirar</Text>
        </Pressable>
        <Pressable style={s.actionBtn}>
          <View style={s.actionIcon}>
            <Feather name="repeat" size={20} color={colors.brand[500]} />
          </View>
          <Text style={s.actionText}>Automático</Text>
        </Pressable>
      </View>

      <View style={s.divider} />

      {/* Interest details */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Rendimiento</Text>

        <View style={s.statRow}>
          <Text style={s.statLabel}>Interés acumulado este mes</Text>
          <Text style={s.statValue}>{formatARS(interestThisMonth)}</Text>
        </View>
        <View style={s.statDivider} />

        <View style={s.statRow}>
          <Text style={s.statLabel}>Interés total cobrado</Text>
          <Text style={s.statValue}>{formatARS(interestTotal)}</Text>
        </View>
        <View style={s.statDivider} />

        <View style={s.statRow}>
          <Text style={s.statLabel}>Efectivo generando interés</Text>
          <Text style={s.statValue}>{formatARS(cashBalance)}</Text>
        </View>
        <View style={s.statDivider} />

        <View style={s.statRow}>
          <Text style={s.statLabel}>Tasa nominal anual</Text>
          <Text style={[s.statValue, { color: colors.brand[500] }]}>{tna}%</Text>
        </View>
        <View style={s.statDivider} />

        <View style={s.statRow}>
          <Text style={s.statLabel}>Próximo pago de interés</Text>
          <Text style={s.statValue}>30 de abril</Text>
        </View>
      </View>

      <View style={s.divider} />

      {/* How it works */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Cómo funciona</Text>
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <View style={s.infoDot} />
            <Text style={s.infoText}>Tu efectivo no invertido genera rendimiento automáticamente</Text>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoDot} />
            <Text style={s.infoText}>Los intereses se acreditan el último día hábil de cada mes</Text>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoDot} />
            <Text style={s.infoText}>Sin tope máximo — mientras más efectivo, más ganás</Text>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoDot} />
            <Text style={s.infoText}>Podés retirar tu efectivo en cualquier momento, sin penalidad</Text>
          </View>
        </View>
      </View>

      <View style={s.divider} />

      {/* Recent activity */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Actividad reciente</Text>
        {transactions.map((tx) => {
          const isPositive = tx.amount >= 0;
          const icon = tx.type === "interest" ? "percent" : tx.type === "deposit" ? "arrow-down-left" : "arrow-up-right";
          return (
            <View key={tx.id} style={s.txRow}>
              <View style={[s.txIcon, {
                backgroundColor: tx.type === "interest"
                  ? "rgba(0,230,118,0.10)"
                  : "rgba(255,255,255,0.06)",
              }]}>
                <Feather
                  name={icon}
                  size={16}
                  color={tx.type === "interest" ? colors.brand[500] : colors.text.secondary}
                />
              </View>
              <View style={s.txInfo}>
                <Text style={s.txLabel}>{tx.label}</Text>
                <Text style={s.txDate}>{tx.date}</Text>
              </View>
              <Text style={[s.txAmount, { color: isPositive ? colors.brand[500] : colors.text.primary }]}>
                {isPositive ? "+" : ""}{formatARS(tx.amount)}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  /* Hero */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: "400",
    color: colors.text.secondary,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1.5,
  },
  tnaPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: colors.brand[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  tnaPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },

  /* Actions */
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 24,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,230,118,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
  },

  divider: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 16,
  },

  /* Stats */
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  statLabel: {
    fontSize: 15,
    color: colors.text.secondary,
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },
  statDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  /* Info card */
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand[500],
    marginTop: 7,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  /* Transactions */
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  txInfo: { flex: 1 },
  txLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.primary,
  },
  txDate: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
});
