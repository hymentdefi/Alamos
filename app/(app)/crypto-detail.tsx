import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { AccountAvatar } from "../../lib/components/AccountAvatar";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../lib/components/Sparkline";
import {
  accounts,
  convertAmount,
  formatAccountBalance,
} from "../../lib/data/accounts";
import { formatARS, formatPct } from "../../lib/data/assets";

/**
 * Detalle de la sección Crypto desde Inicio.
 *
 * Se accede tappeando el header "Crypto" en la home. Muestra el balance
 * total convertido a ARS, métricas (APY promedio, rendimiento estimado
 * mensual), y la lista de holdings crypto con su mini sparkline.
 */
export default function CryptoDetailScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cryptoAccounts = useMemo(
    () => accounts.filter((a) => a.currency === "USDT"),
    [],
  );

  const totalNative = cryptoAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalArs = cryptoAccounts.reduce(
    (sum, a) => sum + convertAmount(a.balance, a.currency, "ARS"),
    0,
  );
  const weightedYield = useMemo(() => {
    if (totalNative <= 0) return 0;
    return (
      cryptoAccounts.reduce(
        (sum, a) => sum + a.yield.pct * (a.balance / totalNative),
        0,
      ) || 0
    );
  }, [cryptoAccounts, totalNative]);
  // Rendimiento estimado mensual (mock): APY promedio / 12.
  const monthlyEstimate = (totalArs * (weightedYield / 100)) / 12;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Crypto</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero balance total */}
        <View style={s.hero}>
          <Text style={[s.heroEyebrow, { color: c.textMuted }]}>
            BALANCE TOTAL
          </Text>
          <Text style={[s.heroAmount, { color: c.text }]}>
            USDT{" "}
            {totalNative.toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
          <Text style={[s.heroSub, { color: c.textMuted }]}>
            ≈ {formatARS(totalArs)}
          </Text>
        </View>

        {/* Métricas */}
        <Text style={[s.eyebrow, { color: c.textMuted }]}>MÉTRICAS</Text>
        <View
          style={[
            s.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <MetricRow
            label="APY promedio"
            value={`${weightedYield.toLocaleString("es-AR", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}%`}
            valueColor={c.greenDark}
          />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetricRow
            label="Rendimiento mensual estimado"
            value={`+ ${formatARS(monthlyEstimate)}`}
            valueColor={c.greenDark}
          />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetricRow label="Activos" value={`${cryptoAccounts.length}`} />
        </View>

        {/* Holdings */}
        <Text style={[s.eyebrow, { color: c.textMuted, marginTop: 28 }]}>
          TUS HOLDINGS
        </Text>
        <View
          style={[
            s.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          {cryptoAccounts.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? (
                <View style={[s.rowDivider, { backgroundColor: c.border }]} />
              ) : null}
              <View style={s.holdingRow}>
                <AccountAvatar account={a} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={s.tickerRow}>
                    <Text style={[s.ticker, { color: c.text }]}>
                      {a.currency}
                    </Text>
                    <View
                      style={[s.yieldBadge, { backgroundColor: c.surfaceHover }]}
                    >
                      <Text style={[s.yieldText, { color: c.greenDark }]}>
                        {a.yield.pct.toLocaleString("es-AR", {
                          minimumFractionDigits: 1,
                        })}
                        {a.yield.label}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[s.tickerSub, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {a.location}
                  </Text>
                </View>
                <View style={s.chartCol}>
                  <MiniSparkline
                    series={seriesFromSeed(a.id, 28, "up")}
                    color={c.greenDark}
                  />
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.balance, { color: c.text }]}>
                    {formatAccountBalance(a)}
                  </Text>
                  <Text style={[s.balanceSub, { color: c.textMuted }]}>
                    ≈{" "}
                    {formatARS(
                      convertAmount(a.balance, a.currency, "ARS"),
                    )}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Info card */}
        <View
          style={[
            s.noteCard,
            {
              backgroundColor: c.surfaceHover,
              borderColor: c.border,
              marginTop: 20,
            },
          ]}
        >
          <Feather name="info" size={14} color={c.textSecondary} />
          <Text style={[s.noteText, { color: c.textSecondary }]}>
            Tu saldo en stablecoins genera rendimientos automáticamente. Los
            intereses se acreditan al inicio de cada día hábil.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function MetricRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={s.metricRow}>
      <Text style={[s.metricLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[
          s.metricValue,
          { color: valueColor ?? c.text },
        ]}
      >
        {value}
      </Text>
    </View>
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

  /* Hero */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  heroEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroAmount: {
    fontFamily: fontFamily[800],
    fontSize: 36,
    letterSpacing: -1.2,
  },
  heroSub: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
    marginTop: 6,
  },

  /* Card / list */
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
  },

  /* Métricas */
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  metricLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  metricValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },

  /* Holding */
  holdingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ticker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  tickerSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  yieldBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  yieldText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.1,
  },
  chartCol: {
    width: 56,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  balance: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  balanceSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.05,
  },

  /* Note */
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
});
