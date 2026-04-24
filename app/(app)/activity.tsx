import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { formatARS } from "../../lib/data/assets";
import { Tap } from "../../lib/components/Tap";

type ActivityTab = "movimientos" | "notificaciones";

interface ActivityItem {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  date: string;
  amount: number;
}

interface NotificationItem {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  date: string;
  unread?: boolean;
}

const activityItems: ActivityItem[] = [
  { id: "1", icon: "check-circle", title: "Compra AAPL", date: "Hoy, 14:32", amount: -48240 },
  { id: "2", icon: "arrow-down-left", title: "Ingreso transferencia", date: "Ayer, 10:15", amount: 250000 },
  { id: "3", icon: "check-circle", title: "Compra AL30", date: "14 abr, 09:45", amount: -71540 },
  { id: "4", icon: "dollar-sign", title: "Dividendo AAPL", date: "12 abr, 16:20", amount: 4280 },
  { id: "5", icon: "arrow-up-right", title: "Venta parcial MSFT", date: "10 abr, 11:02", amount: 83490 },
  { id: "6", icon: "arrow-down-left", title: "Ingreso transferencia", date: "5 abr, 09:10", amount: 120000 },
  { id: "7", icon: "check-circle", title: "Compra GGAL", date: "2 abr, 15:48", amount: -33120 },
  { id: "8", icon: "dollar-sign", title: "Cupón AL30", date: "1 abr, 10:00", amount: 6840 },
];

const notificationItems: NotificationItem[] = [
  {
    id: "n1",
    icon: "trending-up",
    title: "AAPL subió +3,4% hoy",
    body: "Una de tus tenencias tuvo un movimiento fuerte en la rueda.",
    date: "Hoy, 15:02",
    unread: true,
  },
  {
    id: "n2",
    icon: "dollar-sign",
    title: "Acreditación de cupón",
    body: "Se acreditó el cupón de AL30 en tu cuenta.",
    date: "Ayer, 10:00",
    unread: true,
  },
  {
    id: "n3",
    icon: "bell",
    title: "Tu alerta de BTC se disparó",
    body: "BTC cruzó los US$ 68.000 como pediste.",
    date: "13 abr, 18:22",
  },
  {
    id: "n4",
    icon: "info",
    title: "Mercado cerrado · Reanuda 10:30",
    body: "BYMA abrirá en el próximo día hábil.",
    date: "12 abr, 17:00",
  },
  {
    id: "n5",
    icon: "award",
    title: "Ya podés usar Alamos Pro",
    body: "Terminal con profundidad de mercado y órdenes avanzadas.",
    date: "10 abr, 09:45",
  },
];

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [tab, setTab] = useState<ActivityTab>("movimientos");

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Tap>
        <Text style={[s.headerTitle, { color: c.text }]}>Actividad</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* TabStrip Notificaciones / Movimientos */}
      <View style={s.tabsWrap}>
        <View style={[s.tabGroup, { backgroundColor: c.surfaceHover }]}>
          <TabButton
            label="Notificaciones"
            active={tab === "notificaciones"}
            onPress={() => {
              if (tab !== "notificaciones") {
                Haptics.selectionAsync().catch(() => {});
              }
              setTab("notificaciones");
            }}
          />
          <TabButton
            label="Movimientos"
            active={tab === "movimientos"}
            onPress={() => {
              if (tab !== "movimientos") {
                Haptics.selectionAsync().catch(() => {});
              }
              setTab("movimientos");
            }}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "movimientos" ? (
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {activityItems.map((item, i) => {
              const positive = item.amount > 0;
              return (
                <View
                  key={item.id}
                  style={[
                    s.row,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.iconWrap,
                      {
                        backgroundColor: positive
                          ? c.greenDim
                          : c.surfaceHover,
                      },
                    ]}
                  >
                    <Feather
                      name={item.icon}
                      size={16}
                      color={positive ? c.greenDark : c.text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.title, { color: c.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[s.date, { color: c.textMuted }]}>
                      {item.date}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.amount,
                      { color: positive ? c.greenDark : c.text },
                    ]}
                  >
                    {positive ? "+" : "−"}
                    {formatARS(item.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {notificationItems.map((n, i) => (
              <View
                key={n.id}
                style={[
                  s.notifRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <View
                  style={[s.iconWrap, { backgroundColor: c.surfaceHover }]}
                >
                  <Feather name={n.icon} size={16} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.notifTitleRow}>
                    <Text
                      style={[s.notifTitle, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {n.title}
                    </Text>
                    {n.unread ? (
                      <View
                        style={[s.unreadDot, { backgroundColor: c.greenDark }]}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[s.notifBody, { color: c.textMuted }]}
                    numberOfLines={2}
                  >
                    {n.body}
                  </Text>
                  <Text style={[s.notifDate, { color: c.textFaint }]}>
                    {n.date}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      style={[
        s.tab,
        active && [
          s.tabActive,
          { backgroundColor: c.surface, shadowColor: c.ink },
        ],
      ]}
      onPress={onPress}
    >
      <Text
        style={[s.tabLabel, { color: active ? c.text : c.textMuted }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
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
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.25,
  },

  /* Tabs */
  tabsWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabGroup: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  tabActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabLabel: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
  },

  /* Card común */
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },

  /* Movimientos */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  date: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 3,
    letterSpacing: -0.05,
  },
  amount: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },

  /* Notificaciones */
  notifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notifTitle: {
    flex: 1,
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifBody: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    letterSpacing: -0.05,
  },
  notifDate: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 6,
    letterSpacing: -0.05,
  },
});
