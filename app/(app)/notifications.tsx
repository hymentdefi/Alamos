import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";

type Category = "ordenes" | "precios" | "movimientos" | "anuncios";

interface Notif {
  id: string;
  category: Category;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

const items: Notif[] = [
  {
    id: "1",
    category: "ordenes",
    icon: "check-circle",
    title: "Orden ejecutada",
    body: "Compraste 2 AAPL por $ 48.240 a precio promedio $ 24.120.",
    time: "hace 12 min",
    unread: true,
  },
  {
    id: "2",
    category: "precios",
    icon: "trending-up",
    title: "NVDA superó tu alerta",
    body: "NVIDIA subió 3,4% en la rueda. Precio actual $ 18.740.",
    time: "hace 1h",
    unread: true,
  },
  {
    id: "3",
    category: "movimientos",
    icon: "arrow-down-left",
    title: "Transferencia acreditada",
    body: "Se acreditó un ingreso por $ 250.000 desde Banco Galicia.",
    time: "ayer",
    unread: false,
  },
  {
    id: "4",
    category: "ordenes",
    icon: "check-circle",
    title: "Orden de venta ejecutada",
    body: "Vendiste 1 unidad de AL30 por $ 71.540.",
    time: "hace 2d",
    unread: false,
  },
  {
    id: "5",
    category: "anuncios",
    icon: "info",
    title: "Nuevas funciones disponibles",
    body: "Ahora podés operar en horario extendido de Wall Street hasta las 19hs.",
    time: "hace 3d",
    unread: false,
  },
  {
    id: "6",
    category: "movimientos",
    icon: "dollar-sign",
    title: "Dividendo acreditado",
    body: "Recibiste $ 4.280 por dividendos de tus CEDEARs.",
    time: "hace 5d",
    unread: false,
  },
];

type Filter = "todas" | Category;

const filters: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "ordenes", label: "Órdenes" },
  { id: "precios", label: "Alertas" },
  { id: "movimientos", label: "Movimientos" },
  { id: "anuncios", label: "Anuncios" },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [filter, setFilter] = useState<Filter>("todas");

  const visible = useMemo(
    () =>
      filter === "todas"
        ? items
        : items.filter((n) => n.category === filter),
    [filter],
  );

  const unreadCount = visible.filter((n) => n.unread).length;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Notificaciones</Text>
        {/* Atajo a Actividad — la campanita del home abre Notificaciones
            por default; desde acá el user salta a Actividad si quiere
            ver el historial. */}
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.replace("/(app)/activity")}
          hitSlop={12}
        >
          <Feather name="activity" size={18} color={c.text} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterContent}
        style={s.filterRow}
      >
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[
                s.filterPill,
                {
                  backgroundColor: active ? c.ink : c.surfaceHover,
                  borderColor: active ? c.ink : c.border,
                },
              ]}
            >
              <Text
                style={[
                  s.filterLabel,
                  { color: active ? c.bg : c.textSecondary },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {unreadCount > 0 ? (
        <View style={s.unreadBanner}>
          <Text style={[s.unreadText, { color: c.textMuted }]}>
            {unreadCount} sin leer
          </Text>
          <Pressable>
            <Text style={[s.markRead, { color: c.text }]}>Marcar todas</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {visible.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: c.text }]}>
              Nada por acá
            </Text>
            <Text style={[s.emptySub, { color: c.textMuted }]}>
              Cuando pase algo importante te vamos a avisar.
            </Text>
          </View>
        ) : (
          <View style={s.list}>
            {visible.map((n, i) => (
              <Pressable
                key={n.id}
                style={[
                  s.item,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <View
                  style={[
                    s.itemIcon,
                    {
                      backgroundColor: n.unread ? c.greenDim : c.surfaceHover,
                    },
                  ]}
                >
                  <Feather
                    name={n.icon}
                    size={16}
                    color={n.unread ? c.greenDark : c.text}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.itemTitleRow}>
                    <Text style={[s.itemTitle, { color: c.text }]}>
                      {n.title}
                    </Text>
                    {n.unread ? (
                      <View style={[s.unreadDot, { backgroundColor: c.green }]} />
                    ) : null}
                  </View>
                  <Text style={[s.itemBody, { color: c.textMuted }]}>
                    {n.body}
                  </Text>
                  <Text style={[s.itemTime, { color: c.textFaint }]}>
                    {n.time}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
    fontSize: 16,
    letterSpacing: -0.3,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterLabel: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  unreadBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  unreadText: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  markRead: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  list: {
    paddingHorizontal: 20,
  },
  item: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: spacing.lg,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  itemTitle: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  itemBody: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  itemTime: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 6,
    letterSpacing: -0.05,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
