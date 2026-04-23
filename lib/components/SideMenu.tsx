import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
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
import { useProMode } from "../pro/context";

const { width: SCREEN_W } = Dimensions.get("window");
// Panel ocupa el 100% de la pantalla — sin dejar un borde a la derecha.
const PANEL_W = SCREEN_W;
// Umbral de arrastre para cerrar con swipe-a-la-izquierda.
const CLOSE_THRESHOLD = SCREEN_W * 0.25;

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
  const { c } = useTheme();
  const { user, logout } = useAuth();
  const { isPro, togglePro } = useProMode();

  const [rendered, setRendered] = useState(visible);
  const tx = useRef(new Animated.Value(-PANEL_W)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.spring(tx, {
        toValue: 0,
        tension: 70,
        friction: 14,
        restSpeedThreshold: 0.5,
        restDisplacementThreshold: 0.5,
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(tx, {
        toValue: -PANEL_W,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, rendered, tx]);

  // Swipe-a-la-izquierda sobre el panel para cerrarlo: el panel sigue
  // al dedo durante el drag y al soltar se anima hasta el borde.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy),
        onMoveShouldSetPanResponderCapture: (_, g) =>
          g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (g.dx < 0) tx.setValue(g.dx);
          else tx.setValue(0);
        },
        onPanResponderRelease: (_, g) => {
          const shouldClose = g.dx < -CLOSE_THRESHOLD || g.vx < -0.6;
          if (shouldClose) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            Animated.timing(tx, {
              toValue: -PANEL_W,
              duration: 220,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                setRendered(false);
                onClose();
              }
            });
          } else {
            Animated.spring(tx, {
              toValue: 0,
              tension: 90,
              friction: 14,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(tx, {
            toValue: 0,
            tension: 90,
            friction: 14,
            useNativeDriver: true,
          }).start();
        },
      }),
    [tx, onClose],
  );

  if (!rendered) return null;

  const handleTogglePro = () => {
    togglePro();
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
          icon: "message-circle",
          label: "Centro de soporte",
          hint: "Chat, teléfono, mail",
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
          s.panel,
          {
            width: PANEL_W,
            backgroundColor: c.bg,
            transform: [{ translateX: tx }],
          },
        ]}
        {...panResponder.panHandlers}
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
  panel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
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
