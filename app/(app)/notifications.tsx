import { useState } from "react";
import {
  View, Text, Pressable, FlatList, ScrollView, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

/* ─── Mock notifications ─── */
interface Notification {
  id: string;
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  preview: string;
  time: string;
  unread: boolean;
  messages: NotifMessage[];
}

interface NotifMessage {
  text: string;
  date: string;
  hasButton?: boolean;
  buttonLabel?: string;
}

const notifications: Notification[] = [
  {
    id: "announcements",
    category: "Anuncios",
    icon: "megaphone-outline",
    iconColor: colors.brand[500],
    preview: "Hola! Bienvenido a Notificaciones. Acá vas a...",
    time: "ahora",
    unread: true,
    messages: [
      {
        text: "Hola! Bienvenido a Notificaciones. Este es el lugar donde vas a recibir información oportuna y relevante de nuestra parte una vez que empieces a operar.",
        date: "1 abr a las 10:42",
        hasButton: true,
        buttonLabel: "Más información",
      },
    ],
  },
  {
    id: "orders",
    category: "Órdenes",
    icon: "swap-vertical-outline",
    iconColor: "#42A5F5",
    preview: "Tu orden de YPFD fue ejecutada exitosamente.",
    time: "hace 2h",
    unread: true,
    messages: [
      {
        text: "Tu orden de compra de YPFD por $45.200 fue ejecutada exitosamente. Se compraron 2,34 unidades a un precio promedio de $19.316.",
        date: "1 abr a las 08:30",
      },
    ],
  },
  {
    id: "dividends",
    category: "Dividendos",
    icon: "cash-outline",
    iconColor: "#66BB6A",
    preview: "Recibiste un dividendo de YPFD por $1.250.",
    time: "hace 3d",
    unread: false,
    messages: [
      {
        text: "Se acreditó un dividendo de YPFD en tu cuenta por $1.250. El monto fue depositado en tu saldo de efectivo disponible.",
        date: "28 mar a las 14:00",
      },
    ],
  },
  {
    id: "prices",
    category: "Alertas de precio",
    icon: "notifications-outline",
    iconColor: "#FFA726",
    preview: "ALUA alcanzó tu precio objetivo de $850.",
    time: "hace 5d",
    unread: false,
    messages: [
      {
        text: "ALUA alcanzó tu precio objetivo de $850. El precio actual es $852,40. Podés revisar tu posición o configurar una nueva alerta.",
        date: "26 mar a las 11:15",
        hasButton: true,
        buttonLabel: "Ver ALUA",
      },
    ],
  },
  {
    id: "security",
    category: "Seguridad",
    icon: "shield-checkmark-outline",
    iconColor: "#EF5350",
    preview: "Nuevo inicio de sesión detectado en tu cuenta.",
    time: "hace 1sem",
    unread: false,
    messages: [
      {
        text: "Se detectó un nuevo inicio de sesión en tu cuenta desde iPhone 15 Pro en Buenos Aires, Argentina. Si no fuiste vos, cambiá tu contraseña inmediatamente.",
        date: "24 mar a las 09:00",
        hasButton: true,
        buttonLabel: "Revisar seguridad",
      },
    ],
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Notification | null>(null);

  /* ════════════════════════════════════════
     LIST VIEW
     ════════════════════════════════════════ */
  if (!selected) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
          </Pressable>
        </View>

        <Text style={s.title}>Notificaciones</Text>

        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <Pressable style={s.notifRow} onPress={() => setSelected(item)}>
              {/* Unread dot */}
              {item.unread && <View style={s.unreadDot} />}

              {/* Icon */}
              <View style={[s.notifIcon, { borderColor: item.iconColor }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>

              {/* Content */}
              <View style={s.notifContent}>
                <View style={s.notifTopRow}>
                  <Text style={[s.notifCategory, item.unread && s.notifCategoryUnread]}>
                    {item.category}
                  </Text>
                  <Text style={s.notifTime}>{item.time}</Text>
                </View>
                <Text style={s.notifPreview} numberOfLines={1}>
                  {item.preview}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.text.muted} />
              <Text style={s.emptyText}>No tenés notificaciones</Text>
            </View>
          }
        />
      </View>
    );
  }

  /* ════════════════════════════════════════
     DETAIL VIEW (Chat-style)
     ════════════════════════════════════════ */
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.detailHeader}>
        <Pressable onPress={() => setSelected(null)} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
        </Pressable>
        <View style={s.detailHeaderCenter}>
          <View style={[s.detailHeaderIcon, { borderColor: selected.iconColor }]}>
            <Ionicons name={selected.icon} size={18} color={selected.iconColor} />
          </View>
          <Text style={s.detailHeaderTitle}>{selected.category}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {/* Divider */}
      <View style={s.detailDivider} />

      {/* Messages */}
      <ScrollView
        contentContainerStyle={s.messagesContainer}
        showsVerticalScrollIndicator={false}
      >
        {selected.messages.map((msg, i) => (
          <View key={i} style={s.messageGroup}>
            {/* Date label */}
            <Text style={s.messageDate}>{msg.date}</Text>

            {/* Message bubble */}
            <View style={s.messageBubble}>
              <Text style={s.messageText}>{msg.text}</Text>

              {msg.hasButton && msg.buttonLabel && (
                <Pressable style={s.messageBubbleBtn}>
                  <Text style={s.messageBubbleBtnText}>{msg.buttonLabel}</Text>
                </Pressable>
              )}
            </View>

            {/* Pin icon */}
            <View style={s.pinIcon}>
              <Ionicons name="pencil-outline" size={14} color={colors.text.muted} />
            </View>

            {/* Timestamp */}
            <Text style={s.messageTimestamp}>
              {msg.date.split(" a las ")[1] || ""}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  /* Notification rows */
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    left: 8,
    top: "50%",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand[500],
    marginTop: -4,
  },
  notifIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  notifContent: {
    flex: 1,
  },
  notifTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notifCategory: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  notifCategoryUnread: {
    fontWeight: "700",
    color: colors.text.primary,
  },
  notifTime: {
    fontSize: 13,
    color: colors.text.muted,
  },
  notifPreview: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 19,
  },

  /* Empty state */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.muted,
  },

  /* ═══ DETAIL VIEW ═══ */
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  detailHeaderCenter: {
    alignItems: "center",
  },
  detailHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  detailHeaderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.brand[500],
    marginHorizontal: 20,
  },

  /* Messages */
  messagesContainer: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  messageGroup: {
    marginTop: 16,
  },
  messageDate: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: "center",
    marginBottom: 16,
  },
  messageBubble: {
    backgroundColor: colors.surface[100],
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
    maxWidth: "85%",
    alignSelf: "flex-end",
  },
  messageText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
  },
  messageBubbleBtn: {
    marginTop: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  messageBubbleBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
  },
  pinIcon: {
    marginTop: 8,
  },
  messageTimestamp: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 4,
  },
});
