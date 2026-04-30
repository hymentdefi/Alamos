import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { useAuth } from "../../../lib/auth/context";
import { useProMode } from "../../../lib/pro/context";
import { AlamosLogo } from "../../../lib/components/Logo";
import { AlamosAvatar } from "../../../lib/components/AlamosAvatar";
import { Tap } from "../../../lib/components/Tap";
import { AppearanceSheet } from "../../../lib/components/AppearanceSheet";

const APP_VERSION = "v1.0.0";

export default function AlamoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { c, pref } = useTheme();
  const { user, logout } = useAuth();
  const { isPro, requestSwitch } = useProMode();
  const scrollRef = useRef<ScrollView>(null);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (!isFocused) return;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation, isFocused]);

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";
  const fullName = user?.fullName ?? firstName;

  const appearanceLabel =
    pref === "dark"
      ? "Dark mode"
      : pref === "system"
      ? "Device settings"
      : "Light mode";

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* ── Card de identidad: fija arriba. Layout vertical — perfil
          (avatar + nombre + email) arriba, switch a Pro abajo. */}
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

        {/* Separador horizontal entre el bloque de perfil y el switch Pro. */}
        <View
          style={[s.proDividerH, { backgroundColor: c.border }]}
          pointerEvents="none"
        />

        <Pressable
          onPress={() => requestSwitch()}
          style={({ pressed }) => [
            s.proRow,
            {
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          hitSlop={10}
        >
          {/* Glow casi blanco detrás del contenido — apenas se
              insinúa una brisa más clara en diagonal, sin teñir. */}
          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0)",
              "rgba(252, 252, 250, 0.25)",
              "rgba(255, 255, 255, 0)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <AlamosLogo variant="lockupShort" tone="green" size={38} />
          {!isPro ? (
            <Text style={[s.proBtnAccent, { color: c.greenDark }]}>Pro</Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <Feather name="chevron-right" size={18} color={c.textFaint} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: 220,
        }}
        showsVerticalScrollIndicator={false}
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

  /* Card de identidad: layout vertical. Arriba perfil (avatar + nombre
     + email), abajo el switch a Pro como una row tappable full-width. */
  identityCard: {
    marginHorizontal: 20,
    marginBottom: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  /* Divider horizontal entre perfil y switch Pro. */
  proDividerH: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
    marginHorizontal: -16,
  },
  /* Row del switch Pro — full width abajo del perfil. */
  proRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    overflow: "hidden",
  },
  proBtnAccent: {
    fontFamily: fontFamily[800],
    fontSize: 16,
    letterSpacing: -0.3,
    marginLeft: -11,
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
