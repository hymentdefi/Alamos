import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";

interface Session {
  id: string;
  device: string;
  location: string;
  lastUsed: string;
  current?: boolean;
}

const sessions: Session[] = [
  {
    id: "1",
    device: "iPhone 15 Pro · Safari",
    location: "Buenos Aires, AR",
    lastUsed: "Activa ahora",
    current: true,
  },
  {
    id: "2",
    device: "MacBook Air · Chrome",
    location: "Buenos Aires, AR",
    lastUsed: "hace 3h",
  },
  {
    id: "3",
    device: "Pixel 8 · Chrome",
    location: "Rosario, AR",
    lastUsed: "hace 2d",
  },
];

export default function SecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { logout } = useAuth();

  const [bio, setBio] = useState(true);
  const [twoFA, setTwoFA] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);

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
        <Text style={[s.headerTitle, { color: c.text }]}>Seguridad</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            s.scoreCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={s.scoreHead}>
            <View style={[s.scoreIcon, { backgroundColor: c.greenDim }]}>
              <Feather name="shield" size={18} color={c.greenDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.scoreLabel, { color: c.text }]}>
                Tu cuenta está protegida
              </Text>
              <Text style={[s.scoreSub, { color: c.textMuted }]}>
                3 de 4 recomendaciones aplicadas
              </Text>
            </View>
          </View>
          <View style={[s.progressBg, { backgroundColor: c.surfaceSunken }]}>
            <View
              style={[
                s.progressFg,
                { backgroundColor: c.greenDark, width: "75%" },
              ]}
            />
          </View>
        </View>

        <View style={s.group}>
          <Text style={[s.groupTitle, { color: c.textMuted }]}>ACCESO</Text>

          <View
            style={[
              s.groupCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <NavRow
              icon="key"
              label="Cambiar contraseña"
              hint="Última modificación hace 4 meses"
            />
            <ToggleRow
              icon="smartphone"
              label="Desbloqueo biométrico"
              hint="Face ID / huella"
              value={bio}
              onChange={setBio}
            />
            <ToggleRow
              icon="lock"
              label="Autenticación en dos pasos"
              hint="Código SMS al operar"
              value={twoFA}
              onChange={setTwoFA}
            />
            <ToggleRow
              icon="bell"
              label="Alertas de inicio de sesión"
              hint="Te avisamos si alguien entra desde un dispositivo nuevo"
              value={loginAlerts}
              onChange={setLoginAlerts}
              last
            />
          </View>
        </View>

        <View style={s.group}>
          <Text style={[s.groupTitle, { color: c.textMuted }]}>
            SESIONES ACTIVAS
          </Text>
          <View
            style={[
              s.groupCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {sessions.map((sess, i) => (
              <View
                key={sess.id}
                style={[
                  s.sessionRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <View style={[s.sessionIcon, { backgroundColor: c.surfaceHover }]}>
                  <Feather
                    name={sess.device.includes("iPhone") || sess.device.includes("Pixel")
                      ? "smartphone"
                      : "monitor"}
                    size={16}
                    color={c.text}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.sessionTitleRow}>
                    <Text style={[s.sessionDevice, { color: c.text }]}>
                      {sess.device}
                    </Text>
                    {sess.current ? (
                      <View style={[s.currentBadge, { backgroundColor: c.greenDim }]}>
                        <Text style={[s.currentBadgeText, { color: c.greenDark }]}>
                          Esta sesión
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[s.sessionMeta, { color: c.textMuted }]}>
                    {sess.location} · {sess.lastUsed}
                  </Text>
                </View>
                {!sess.current ? (
                  <Pressable>
                    <Text style={[s.sessionAction, { color: c.red }]}>
                      Cerrar
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          <Pressable style={s.closeAllBtn}>
            <Text style={[s.closeAllText, { color: c.red }]}>
              Cerrar todas las otras sesiones
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[
            s.logoutBtn,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
          onPress={logout}
        >
          <Feather name="log-out" size={16} color={c.red} />
          <Text style={[s.logoutText, { color: c.red }]}>
            Cerrar sesión en este dispositivo
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function NavRow({
  icon,
  label,
  hint,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: c.surfaceHover }]}>
        <Feather name={icon} size={16} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
        {hint ? (
          <Text style={[s.rowHint, { color: c.textMuted }]}>{hint}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={c.textFaint} />
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        s.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={[s.rowIcon, { backgroundColor: c.surfaceHover }]}>
        <Feather name={icon} size={16} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: c.text }]}>{label}</Text>
        {hint ? (
          <Text style={[s.rowHint, { color: c.textMuted }]}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.surfaceSunken, true: c.ink }}
        thumbColor={c.bg}
        ios_backgroundColor={c.surfaceSunken}
      />
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
  scoreCard: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  scoreHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  scoreIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  scoreSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFg: {
    height: "100%",
    borderRadius: 3,
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
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  sessionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sessionDevice: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  currentBadgeText: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 0.2,
  },
  sessionMeta: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  sessionAction: {
    fontFamily: fontFamily[700],
    fontSize: 12,
  },
  closeAllBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  closeAllText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  logoutBtn: {
    marginHorizontal: 20,
    marginTop: 16,
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
});
