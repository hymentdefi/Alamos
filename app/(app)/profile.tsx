import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import { AlamosLogo } from "../../lib/components/Logo";

interface MenuItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  path?: string;
  action?: () => void;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user, logout } = useAuth();

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";
  const initial = (user?.fullName ?? "M").charAt(0).toUpperCase();

  const maskedCuil = "20·••••••••·9";

  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: "Cuenta",
      items: [
        {
          icon: "user",
          label: "Datos personales",
          hint: "Nombre, DNI, domicilio",
          path: "/(app)/account",
        },
        {
          icon: "credit-card",
          label: "Transferencias y CBU",
          hint: "Alias, cuenta bancaria",
          path: "/(app)/transfer",
        },
        {
          icon: "bell",
          label: "Notificaciones",
          path: "/(app)/notifications",
        },
        {
          icon: "sliders",
          label: "Preferencias de la app",
          hint: "Tema, idioma, alertas",
          path: "/(app)/settings",
        },
      ],
    },
    {
      title: "Seguridad",
      items: [
        {
          icon: "lock",
          label: "Contraseña y factor doble",
          path: "/(app)/security",
        },
      ],
    },
    {
      title: "Ayuda",
      items: [
        {
          icon: "help-circle",
          label: "Centro de ayuda",
          hint: "Preguntas frecuentes, contacto",
          path: "/(app)/support",
        },
        {
          icon: "info",
          label: "Sobre Alamos Capital",
          path: "/(app)/about",
        },
      ],
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={[s.title, { color: c.text }]}>Perfil</Text>
          <AlamosLogo variant="mark" tone="light" size={22} />
        </View>

        <View
          style={[
            s.identityCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={[s.avatar, { backgroundColor: c.ink }]}>
            <Text style={[s.avatarText, { color: c.bg }]}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.userName, { color: c.text }]}>
              {user?.fullName ?? firstName}
            </Text>
            <Text style={[s.userMeta, { color: c.textMuted }]}>
              {user?.email ?? "—"}
            </Text>
            <Text style={[s.userMeta, { color: c.textMuted }]}>
              CUIL {maskedCuil}
            </Text>
          </View>
        </View>

        <View
          style={[
            s.statusCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={s.statusHead}>
            <View
              style={[s.statusDot, { backgroundColor: c.green }]}
            />
            <Text style={[s.statusLabel, { color: c.text }]}>
              Cuenta verificada
            </Text>
          </View>
          <Text style={[s.statusText, { color: c.textMuted }]}>
            Podés invertir hasta ARS 5.000.000 por operación. Para aumentar tus
            límites, completá la validación extendida.
          </Text>
          <Pressable>
            <Text style={[s.statusCta, { color: c.text }]}>
              Aumentar límites →
            </Text>
          </Pressable>
        </View>

        {groups.map((group) => (
          <View key={group.title} style={s.group}>
            <Text style={[s.groupTitle, { color: c.textMuted }]}>
              {group.title.toUpperCase()}
            </Text>
            <View
              style={[
                s.groupCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {group.items.map((item, i) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    if (item.action) return item.action();
                    if (item.path) router.push(item.path as any);
                  }}
                  style={[
                    s.row,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                  ]}
                >
                  <View style={[s.rowIcon, { backgroundColor: c.surfaceHover }]}>
                    <Feather name={item.icon} size={16} color={c.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowLabel, { color: c.text }]}>
                      {item.label}
                    </Text>
                    {item.hint ? (
                      <Text style={[s.rowHint, { color: c.textMuted }]}>
                        {item.hint}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={18} color={c.textFaint} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          style={[
            s.logoutBtn,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
          onPress={logout}
        >
          <Feather name="log-out" size={16} color={c.red} />
          <Text style={[s.logoutText, { color: c.red }]}>Cerrar sesión</Text>
        </Pressable>

        <View style={s.footer}>
          <AlamosLogo variant="lockupShort" tone="light" size={20} />
          <Text style={[s.footerText, { color: c.textMuted }]}>
            Alamos Capital ALYC · Versión 1.0.0
          </Text>
          <Text style={[s.footerText, { color: c.textFaint }]}>
            Agente Miembro CNV — Matrícula 000
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1.2,
  },
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.8,
  },
  userName: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
  },
  userMeta: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  statusCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  statusHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  statusText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    marginBottom: 12,
  },
  statusCta: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  group: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  groupTitle: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  groupCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: 14,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  footer: {
    alignItems: "center",
    paddingTop: 32,
    gap: 6,
  },
  footerText: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },
});
