import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../../lib/theme";
import { useAuth } from "../../../lib/auth/context";
import { useProMode } from "../../../lib/pro/context";
import { AlamosLogo } from "../../../lib/components/Logo";
import { Tap } from "../../../lib/components/Tap";

interface NavItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  path?: string;
}

export default function AlamoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { c } = useTheme();
  const { user, logout } = useAuth();
  const { isPro, requestSwitch } = useProMode();
  const scrollRef = useRef<ScrollView>(null);

  // Scroll al tope cuando volvés a tapear la tab estando acá.
  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (!isFocused) return;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation, isFocused]);

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";
  const initial = (user?.fullName ?? "M").charAt(0).toUpperCase();

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "CUENTA",
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
          path: "/(app)/settings",
        },
      ],
    },
    {
      title: "SEGURIDAD",
      items: [
        {
          icon: "lock",
          label: "Contraseña y factor doble",
          path: "/(app)/security",
        },
      ],
    },
    {
      title: "AYUDA",
      items: [
        {
          icon: "message-circle",
          label: "Centro de soporte",
          hint: "Academy + chat con IA o persona",
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
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[s.title, { color: c.text }]}>Tu Alamo</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Alamos Pro pill ── */}
        <Pressable
          onPress={() => requestSwitch()}
          style={({ pressed }) => [
            s.proPill,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
        >
          <AlamosLogo variant="lockupShort" tone="light" size={44} />
          {!isPro ? (
            <Text style={[s.proPillAccent, { color: c.greenDark }]}>Pro</Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <Feather name="chevron-right" size={20} color={c.textFaint} />
        </Pressable>

        {/* ── Identidad del usuario ── */}
        <View style={s.identity}>
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
          </View>
        </View>

        {/* ── Groups ── */}
        {groups.map((g) => (
          <View key={g.title} style={s.group}>
            <Text style={[s.groupTitle, { color: c.textMuted }]}>
              {g.title}
            </Text>
            {g.items.map((it, i) => (
              <Pressable
                key={it.label}
                onPress={() => it.path && router.push(it.path as never)}
                style={[
                  s.row,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <View
                  style={[s.rowIcon, { backgroundColor: c.surfaceHover }]}
                >
                  <Feather name={it.icon} size={15} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowLabel, { color: c.text }]}>
                    {it.label}
                  </Text>
                  {it.hint ? (
                    <Text style={[s.rowHint, { color: c.textMuted }]}>
                      {it.hint}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={16} color={c.textFaint} />
              </Pressable>
            ))}
          </View>
        ))}

        {/* ── Logout ── */}
        <Tap
          style={[
            s.logoutBtn,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
          onPress={() => logout()}
          haptic="light"
        >
          <Feather name="log-out" size={15} color={c.red} />
          <Text style={[s.logoutText, { color: c.red }]}>Cerrar sesión</Text>
        </Tap>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
  },

  /* Pro pill */
  proPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  proPillAccent: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.4,
    marginLeft: -14,
  },

  /* Identity */
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.6,
  },
  userName: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  userMeta: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },

  /* Groups */
  group: {
    marginTop: 18,
    paddingHorizontal: 20,
  },
  groupTitle: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing.md + 2,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  rowHint: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.05,
  },

  /* Logout */
  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
