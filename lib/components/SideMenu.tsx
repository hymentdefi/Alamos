import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius, spacing } from "../theme";
import { useAuth } from "../auth/context";
import { useProMode } from "../pro/context";
import { AlamosLogo } from "./Logo";

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
  const { isPro, requestSwitch } = useProMode();

  const [rendered, setRendered] = useState(visible);
  const tx = useRef(new Animated.Value(-PANEL_W)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      // Ease-out-quart para apertura: arranca rápido y frena suave al
      // final — se siente como que el panel 'se asienta' en lugar de
      // rebotar como hacía el spring.
      Animated.timing(tx, {
        toValue: 0,
        duration: 340,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      // Ease-in-quart para cierre: arranca tranquilo y acelera al
      // final, espejando la curva de apertura.
      Animated.timing(tx, {
        toValue: -PANEL_W,
        duration: 280,
        easing: Easing.bezier(0.64, 0, 0.78, 0),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible, rendered, tx]);

  // Swipe-a-la-izquierda sobre el panel para cerrarlo. Usamos
  // PanGestureHandler de react-native-gesture-handler porque convive
  // mucho mejor con el ScrollView interno que PanResponder: los
  // activeOffsetX / failOffsetY se evalúan a nivel nativo y resuelven
  // el conflicto de gestos sin esperar al JS.
  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    const { translationX } = e.nativeEvent;
    if (translationX < 0) tx.setValue(translationX);
    else tx.setValue(0);
  };

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (
      e.nativeEvent.state === State.END ||
      e.nativeEvent.state === State.CANCELLED ||
      e.nativeEvent.state === State.FAILED
    ) {
      const tX = e.nativeEvent.translationX ?? 0;
      const vX = e.nativeEvent.velocityX ?? 0;
      const shouldClose = tX < -CLOSE_THRESHOLD || vX < -500;
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
    }
  };

  if (!rendered) return null;

  const handleTogglePro = () => {
    // Cerramos el menú primero y esperamos a que el Modal se desmonte
    // completo (anim 280ms + margen). Si abrimos el Modal del Transition
    // antes, iOS lo deja en cola hasta que se dismissea el anterior y
    // la animación de bienvenida se pierde.
    onClose();
    setTimeout(() => requestSwitch(), 380);
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
          label: "Sobre Álamos Capital",
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
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        // Sólo activar cuando el gesto es claramente horizontal-izquierda.
        // Esto evita que se active durante scroll vertical.
        activeOffsetX={[-10, 9999]}
        failOffsetY={[-20, 20]}
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
              style={s.closeBtn}
              onPress={onClose}
              hitSlop={10}
            >
              <Feather name="arrow-left" size={22} color={c.text} />
            </Pressable>
          </View>

          {/* ── Alamos Pro pill (toggle hacia el otro modo) ── */}
          <Pressable
            onPress={handleTogglePro}
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
            <AlamosLogo variant="lockupShort" tone="green" size={44} />
            {!isPro ? (
              <Text style={[s.proPillAccent, { color: c.greenDark }]}>
                Pro
              </Text>
            ) : null}
            <View style={{ flex: 1 }} />
            <Feather name="chevron-right" size={20} color={c.textFaint} />
          </Pressable>

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
      </PanGestureHandler>
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
  /* Pro pill — tipo Binance: logo + ALAMOS + 'Pro' + chevron */
  proPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  proPillTextRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  proPillBrand: {
    fontFamily: fontFamily[800],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  proPillAccent: {
    fontFamily: fontFamily[800],
    fontSize: 18,
    letterSpacing: -0.4,
    // El lockupShort tiene aire a la derecha del texto 'Alamos';
    // compensamos con un margin negativo para que 'Pro' quede cerca
    // del texto 'Alamos' del logo, con un pequeño aire de respiración.
    marginLeft: -13,
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
