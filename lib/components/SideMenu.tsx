import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius, spacing } from "../theme";
import { useAuth } from "../auth/context";

const { width: SCREEN_W } = Dimensions.get("window");
const PANEL_W = Math.min(SCREEN_W * 0.88, 380);

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface NavItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  path?: string;
}

export function SideMenu({ visible, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode, toggle } = useTheme();
  const { user, logout } = useAuth();

  const [rendered, setRendered] = useState(visible);
  const tx = useRef(new Animated.Value(PANEL_W)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(tx, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      Animated.parallel([
        Animated.timing(tx, {
          toValue: PANEL_W,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setRendered(false));
    }
  }, [visible, rendered, tx, overlayOpacity]);

  if (!rendered) return null;

  const isPro = mode === "dark";

  const handleTogglePro = () => {
    Haptics.impactAsync(
      isPro
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium,
    ).catch(() => {});
    toggle();
  };

  const navigateTo = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as never), 220);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => logout(), 220);
  };

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
          icon: "help-circle",
          label: "Centro de ayuda",
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
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          s.overlay,
          {
            opacity: overlayOpacity,
            backgroundColor: "rgba(14,15,12,0.45)",
          },
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          s.panel,
          {
            width: PANEL_W,
            backgroundColor: c.bg,
            transform: [{ translateX: tx }],
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.closeRow}>
            <Pressable
              style={[s.closeBtn, { backgroundColor: c.surfaceHover }]}
              onPress={onClose}
              hitSlop={10}
            >
              <Feather name="x" size={20} color={c.text} />
            </Pressable>
          </View>

          {/* ── Alamos Pro Toggle ── */}
          <View
            style={[
              s.proCard,
              { backgroundColor: c.ink },
            ]}
          >
            <View style={s.proHead}>
              <View style={s.proEyebrow}>
                <View style={[s.proDot, { backgroundColor: c.green }]} />
                <Text style={[s.proEyebrowText, { color: c.green }]}>
                  ALAMOS PRO
                </Text>
              </View>
              <Switch
                value={isPro}
                onValueChange={handleTogglePro}
                trackColor={{
                  false: "rgba(250,250,247,0.16)",
                  true: c.green,
                }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="rgba(250,250,247,0.16)"
              />
            </View>
            <Text style={[s.proTitle, { color: c.bg }]}>
              Terminal pro para inversores avanzados.
            </Text>
            <Text
              style={[
                s.proBody,
                { color: "rgba(250,250,247,0.64)" },
              ]}
            >
              {isPro
                ? "Activo. Vista densa con profundidad de mercado, órdenes avanzadas y data cruda."
                : "Activá el modo Pro cuando estés listo. Tema oscuro tipo terminal, más data y controles rápidos."}
            </Text>
          </View>

          {/* ── User identity ── */}
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
                  onPress={() => it.path && navigateTo(it.path)}
                  style={[
                    s.row,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                  ]}
                >
                  <View style={[s.rowIcon, { backgroundColor: c.surfaceHover }]}>
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
          <Pressable
            style={[
              s.logoutBtn,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={15} color={c.red} />
            <Text style={[s.logoutText, { color: c.red }]}>Cerrar sesión</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  closeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  /* Pro card */
  proCard: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 18,
    borderRadius: radius.lg,
  },
  proHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  proEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  proEyebrowText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
  },
  proTitle: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  proBody: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
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
