import { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { registerTabTap } from "../../../lib/tabs/activeTap";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { useAuth } from "../../../lib/auth/context";
import { AlamosAvatar } from "../../../lib/components/AlamosAvatar";
import { Tap } from "../../../lib/components/Tap";
import { AppearanceSheet } from "../../../lib/components/AppearanceSheet";

const APP_VERSION = "v1.0.0";

export default function AlamoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, pref } = useTheme();
  const { user, logout } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      setRefreshing(false);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }, 1100);
  }, []);

  // Tap-on-active-tab: scroll al tope si no estoy arriba; refresh
  // si ya estoy. Mismo patrón que el resto de las tabs.
  useEffect(() => {
    return registerTabTap("alamo", {
      isAtTop: () => scrollYRef.current <= 8,
      scrollToTop: () =>
        scrollRef.current?.scrollTo({ y: 0, animated: true }),
      refresh: () => {
        if (!refreshing) onRefresh();
      },
    });
  }, [refreshing, onRefresh]);

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";
  const fullName = user?.fullName ?? firstName;

  const appearanceLabel =
    pref === "dark"
      ? "Dark mode"
      : pref === "system"
      ? "Device settings"
      : "Light mode";

  return (
    <View style={[s.root, { backgroundColor: c.surfaceSunken }]}>
      {/* ── Card de identidad: avatar + nombre + email. */}
      <View
        style={[
          s.identityCard,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            marginTop: insets.top + 14,
          },
        ]}
      >
        <View style={s.identityTop}>
          {/* Avatar: inicial del usuario sobre uno de los 12 schemes
              de color. Tap cicla los colores y persiste en SecureStore. */}
          <AlamosAvatar size={64} initial={firstName} />

          <View style={s.identityNameBlock}>
            <Text style={[s.userName, { color: c.text }]} numberOfLines={1}>
              {fullName}
            </Text>
            <Text
              style={[s.userMeta, { color: c.textMuted }]}
              numberOfLines={1}
            >
              {user?.email ?? ""}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: 220,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* ── Sección 1: cuenta ── */}
        <View style={s.group}>
          <Row
            icon="user"
            label="Datos personales"
            onPress={() => router.push("/(app)/account")}
          />
          <Row
            icon="credit-card"
            label="Transferencias y CBU"
            onPress={() => router.push("/(app)/transfer")}
          />
          <Row
            icon="bell"
            label="Mis alertas"
            onPress={() => router.push("/(app)/alerts")}
          />
          <Row
            icon="clock"
            label="Órdenes pendientes"
            onPress={() => router.push("/(app)/queued-orders")}
          />
        </View>

        <Divider />

        {/* ── Sección 2: preferencias ── */}
        <View style={s.group}>
          <ToggleRow
            icon="bell"
            label="Allow push notifications"
            value={pushEnabled}
            onValueChange={(v) => {
              Haptics.selectionAsync().catch(() => {});
              setPushEnabled(v);
            }}
          />
          <Row
            icon="moon"
            label="Apariencia"
            sub={appearanceLabel}
            onPress={() => setAppearanceOpen(true)}
          />
          <Row
            icon="shield"
            label="Seguridad"
            onPress={() => router.push("/(app)/security")}
          />
        </View>

        <Divider />

        {/* ── Sección 3: ayuda ── */}
        <View style={s.group}>
          <Row
            icon="message-circle"
            label="Centro de soporte"
            onPress={() => router.push("/(app)/support")}
          />
          <Row
            icon="info"
            label="Sobre Álamos Capital"
            onPress={() => router.push("/(app)/about")}
          />
        </View>

        <Divider />

        {/* ── Sign out ── */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
            logout();
          }}
          style={s.group}
        >
          <View style={s.row}>
            <View style={[s.iconWrap, { backgroundColor: c.surfaceHover }]}>
              <Feather name="log-out" size={15} color={c.red} />
            </View>
            <Text style={[s.rowLabel, { color: c.red }]}>Cerrar sesión</Text>
          </View>
        </Pressable>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Pressable
            onPress={() =>
              Linking.openURL("https://alamos.capital/terms").catch(() => {})
            }
          >
            <Text style={[s.footerText, { color: c.textMuted }]}>
              <Text style={{ fontFamily: fontFamily[600] }}>Álamos</Text>{" "}
              <Text style={s.underline}>
                Términos y Condiciones y Política de Privacidad
              </Text>
            </Text>
          </Pressable>

          <View style={s.socialRow}>
            <Pressable
              hitSlop={10}
              onPress={() =>
                Linking.openURL(
                  "https://instagram.com/alamos.capital",
                ).catch(() => {})
              }
            >
              <Feather name="instagram" size={18} color={c.textMuted} />
            </Pressable>
            <Pressable
              hitSlop={10}
              onPress={() =>
                Linking.openURL("https://x.com/alamoscapital").catch(() => {})
              }
            >
              <Text style={[s.xIcon, { color: c.textMuted }]}>𝕏</Text>
            </Pressable>
          </View>

          <Text style={[s.version, { color: c.textMuted }]}>
            {APP_VERSION}
          </Text>
        </View>
      </ScrollView>

      <AppearanceSheet
        visible={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
      />
    </View>
  );
}

/* ─── Primitives ─── */

function Row({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub?: string;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Tap
      style={s.row}
      onPress={onPress}
      haptic="selection"
    >
      <View style={[s.iconWrap, { backgroundColor: c.surfaceHover }]}>
        <Feather name={icon} size={15} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
        {sub ? (
          <Text style={[s.rowSub, { color: c.textMuted }]}>{sub}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={16} color={c.textFaint} />
    </Tap>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={s.row}>
      <View style={[s.iconWrap, { backgroundColor: c.surfaceHover }]}>
        <Feather name={icon} size={15} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.surfaceSunken, true: c.greenDark }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Divider() {
  const { c } = useTheme();
  return (
    <View
      style={[s.divider, { backgroundColor: c.border }]}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  /* Card de identidad: avatar + nombre + email. */
  identityCard: {
    marginHorizontal: 20,
    marginBottom: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  identityTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  identityNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    letterSpacing: -0.4,
  },
  userMeta: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  /* Groups + rows */
  group: {
    paddingHorizontal: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },

  /* Footer */
  footer: {
    alignItems: "center",
    paddingTop: 32,
    paddingHorizontal: 20,
    gap: 14,
  },
  footerText: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    textAlign: "center",
    letterSpacing: -0.05,
  },
  underline: {
    textDecorationLine: "underline",
  },
  socialRow: {
    flexDirection: "row",
    gap: 22,
    marginTop: 4,
  },
  xIcon: {
    fontSize: 18,
    fontFamily: fontFamily[700],
  },
  version: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
});
