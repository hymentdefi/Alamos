import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import { assets, formatARS, type Asset } from "../../lib/data/assets";
import { useAuth } from "../../lib/auth/context";

const heldAssets = assets.filter((a) => a.held);
const cashBalance = 342180;

const activityItems = [
  { id: "1", icon: "shopping-cart" as const, title: "Compra GGAL", date: "Hoy, 14:32", amount: -85400, status: "Ejecutada" },
  { id: "2", icon: "arrow-down-left" as const, title: "Ingreso transferencia", date: "Ayer, 10:15", amount: 250000, status: "Acreditado" },
  { id: "3", icon: "shopping-cart" as const, title: "Compra AL30", date: "14 abr, 09:45", amount: -120000, status: "Ejecutada" },
  { id: "4", icon: "arrow-up-right" as const, title: "Venta YPFD", date: "12 abr, 16:20", amount: 94500, status: "Ejecutada" },
];

const timeFilters = ["1D", "1S", "1M", "3M", "1A", "MAX"] as const;

function getGreetingOptions() {
  const hour = new Date().getHours();

  if (hour < 12) return ["Buen dia", "Hola"];
  if (hour < 19) return ["Buenas tardes", "Hola"];
  return ["Buenas noches", "Hola", "Cerrando el dia"];
}

function QuickAction({
  icon,
  label,
  onPress,
  iconBg,
  iconColor,
  textColor,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  iconBg: string;
  iconColor: string;
  textColor: string;
}) {
  return (
    <Pressable style={s.quickAction} onPress={onPress}>
      <View style={[s.quickActionIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[s.quickActionText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user } = useAuth();
  const [hideBalance, setHideBalance] = useState(false);
  const [greeting, setGreeting] = useState("Hola");

  const firstName = user?.fullName?.split(" ")[0] || "Chris";

  useFocusEffect(
    useCallback(() => {
      const options = getGreetingOptions();
      setGreeting(options[Math.floor(Math.random() * options.length)]);
    }, [])
  );

  const openDetail = (asset: Asset) => {
    router.push({ pathname: "/(app)/detail", params: { ticker: asset.ticker } });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.fixedTop, { backgroundColor: c.bg, paddingTop: insets.top + 16 }]}>
        <View style={s.topBar}>
          <Text style={[s.greeting, { color: c.text }]}>
            {greeting}, {firstName}
          </Text>
          <Pressable
            style={[s.iconButton, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}
            onPress={() => router.push("/(app)/notifications")}
            hitSlop={12}
          >
            <Feather name="bell" size={18} color={c.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ paddingTop: insets.top + 88, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.primaryCard, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
          <View style={s.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardLabel, { color: c.textSecondary }]}>Disponible</Text>
              <View style={s.balanceRow}>
                <Text style={[s.mainBalance, { color: c.text }]}>
                  {hideBalance ? "$ ••••••" : formatARS(cashBalance)}
                </Text>
                <Pressable onPress={() => setHideBalance((value) => !value)} hitSlop={12}>
                  <Feather
                    name={hideBalance ? "eye-off" : "eye"}
                    size={20}
                    color={c.textMuted}
                  />
                </Pressable>
              </View>
              <View style={s.tnaRow}>
                <View style={[s.tnaBadge, { backgroundColor: c.greenDim }]}>
                  <Feather name="trending-up" size={12} color={c.green} />
                  <Text style={[s.tnaBadgeText, { color: c.green }]}>37% TNA</Text>
                </View>
                <Text style={[s.tnaHint, { color: c.textSecondary }]}>
                  Tu saldo rinde automáticamente
                </Text>
              </View>
            </View>
          </View>

          <View style={s.quickActionsRow}>
            <QuickAction
              icon="arrow-down-left"
              label="Ingresar"
              onPress={() => router.push("/(app)/transfer")}
              iconBg={c.greenDim}
              iconColor={c.green}
              textColor={c.text}
            />
            <QuickAction
              icon="repeat"
              label="Transferir"
              onPress={() => router.push("/(app)/transfer")}
              iconBg={c.surfaceHover}
              iconColor={c.text}
              textColor={c.text}
            />
            <QuickAction
              icon="trending-up"
              label="Invertir"
              onPress={() => router.push("/(app)/explore")}
              iconBg={c.surfaceHover}
              iconColor={c.text}
              textColor={c.text}
            />
            <QuickAction
              icon="at-sign"
              label="Alias"
              onPress={() => router.push("/(app)/account")}
              iconBg={c.surfaceHover}
              iconColor={c.text}
              textColor={c.text}
            />
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: c.text }]}>Tus inversiones</Text>
            <Pressable onPress={() => router.push("/(app)/portfolio")}>
              <Text style={[s.linkText, { color: c.green }]}>Ir a portfolio</Text>
            </Pressable>
          </View>

          <View style={[s.listCard, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
            {heldAssets.slice(0, 3).map((asset, index) => {
              const value = asset.price * (asset.qty || 1);
              const isUp = asset.change >= 0;

              return (
                <Pressable
                  key={asset.ticker}
                  style={[
                    s.assetRow,
                    index < 2 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: c.border,
                    },
                  ]}
                  onPress={() => openDetail(asset)}
                >
                  <View style={[s.assetMark, { backgroundColor: c.surfaceHover }]}>
                    <Text style={[s.assetMarkText, { color: c.text }]}>{asset.ticker.slice(0, 1)}</Text>
                  </View>
                  <View style={s.assetInfo}>
                    <Text style={[s.assetTicker, { color: c.text }]}>{asset.ticker}</Text>
                    <Text style={[s.assetName, { color: c.textSecondary }]}>
                      {asset.qty} un. · {asset.name}
                    </Text>
                  </View>
                  <View style={s.assetValues}>
                    <Text style={[s.assetPrice, { color: c.text }]}>{formatARS(value)}</Text>
                    <Text style={[s.assetChange, { color: isUp ? c.green : c.red }]}>
                      {isUp ? "+" : ""}
                      {asset.change.toFixed(2)}%
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: c.text }]}>Actividad</Text>
            <Pressable onPress={() => router.push("/(app)/cash")}>
              <Text style={[s.linkText, { color: c.green }]}>Ver todo</Text>
            </Pressable>
          </View>

          <View style={[s.listCard, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>
            {activityItems.map((item, index) => {
              const isPositive = item.amount > 0;
              return (
                <View
                  key={item.id}
                  style={[
                    s.assetRow,
                    index < activityItems.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: c.border,
                    },
                  ]}
                >
                  <View style={[s.activityIcon, { backgroundColor: c.surfaceHover }]}>
                    <Feather name={item.icon} size={18} color={c.textSecondary} />
                  </View>
                  <View style={s.assetInfo}>
                    <Text style={[s.assetTicker, { color: c.text }]}>{item.title}</Text>
                    <Text style={[s.assetName, { color: c.textSecondary }]}>{item.date}</Text>
                  </View>
                  <View style={s.assetValues}>
                    <Text style={[s.assetPrice, { color: isPositive ? c.green : c.text }]}>
                      {isPositive ? "+" : ""}
                      {formatARS(Math.abs(item.amount))}
                    </Text>
                    <Text style={[s.assetName, { color: c.textSecondary }]}>{item.status}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  fixedTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCard: {
    marginHorizontal: 16,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mainBalance: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1.4,
  },
  tnaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  tnaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  tnaBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  tnaHint: {
    fontSize: 13,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "700",
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: 10,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  listCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  assetMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  assetMarkText: {
    fontSize: 16,
    fontWeight: "800",
  },
  assetInfo: {
    flex: 1,
  },
  assetTicker: {
    fontSize: 15,
    fontWeight: "700",
  },
  assetName: {
    fontSize: 13,
    marginTop: 4,
  },
  assetValues: {
    alignItems: "flex-end",
  },
  assetPrice: {
    fontSize: 15,
    fontWeight: "700",
  },
  assetChange: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
});
