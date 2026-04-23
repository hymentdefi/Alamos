import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { formatARS } from "../../lib/data/assets";
import { Tap } from "../../lib/components/Tap";

interface ActivityItem {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  date: string;
  amount: number;
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

export default function ActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

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

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
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
                      backgroundColor: positive ? c.greenDim : c.surfaceHover,
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
                  <Text style={[s.title, { color: c.text }]}>{item.title}</Text>
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
      </ScrollView>
    </View>
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
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
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
});
