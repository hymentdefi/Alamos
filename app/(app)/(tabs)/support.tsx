import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { useAuth } from "../../../lib/auth/context";

/* ─── Data ─── */

interface Agent {
  id: string;
  name: string;
  role: string;
  avatarTone: "ink" | "green" | "warm" | "blue";
  avatarInitial: string;
}

const agents: Agent[] = [
  { id: "a1", name: "Sofía", role: "Atención", avatarTone: "ink", avatarInitial: "S" },
  { id: "a2", name: "Mateo", role: "Operaciones", avatarTone: "green", avatarInitial: "M" },
  { id: "a3", name: "Lucía", role: "Transferencias", avatarTone: "warm", avatarInitial: "L" },
  { id: "a4", name: "Juan", role: "Impuestos", avatarTone: "blue", avatarInitial: "J" },
];

interface Topic {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  hint: string;
}

const topics: Topic[] = [
  { id: "cuenta", label: "Mi cuenta", icon: "user", hint: "Datos, CUIL, verificación" },
  { id: "operar", label: "Operar", icon: "trending-up", hint: "Compras, ventas, órdenes" },
  { id: "transferencias", label: "Transferencias", icon: "credit-card", hint: "Ingresos, extracciones, CBU" },
  { id: "impuestos", label: "Impuestos", icon: "file-text", hint: "Retenciones, certificados" },
  { id: "seguridad", label: "Seguridad", icon: "shield", hint: "Contraseña, 2FA, sesiones" },
  { id: "app", label: "Usar la app", icon: "smartphone", hint: "Tutoriales y guía" },
];

interface PastCase {
  id: string;
  title: string;
  status: "resuelto" | "en curso";
  time: string;
}

const pastCases: PastCase[] = [
  { id: "c-8812", title: "Retención impositiva en venta de CEDEAR", status: "resuelto", time: "hace 3 días" },
  { id: "c-8450", title: "Cambio de CBU de extracción", status: "resuelto", time: "hace 2 semanas" },
];

/* ─── Screen ─── */

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";

  // Scroll-top al tapear la tab Soporte estando ya en Soporte
  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (!isFocused) return;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation, isFocused]);

  const openChat = (ctx?: { topic?: string; agent?: string; urgent?: boolean }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({
      pathname: "/(app)/chat",
      params: {
        topic: ctx?.topic ?? "",
        agent: ctx?.agent ?? "",
        urgent: ctx?.urgent ? "1" : "",
      },
    });
  };

  const openWhatsapp = () => {
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL("https://wa.me/5491100000000").catch(() => {});
  };

  const openPhone = () => {
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL("tel:08003422567").catch(() => {});
  };

  const openMail = () => {
    Haptics.selectionAsync().catch(() => {});
    Linking.openURL("mailto:ayuda@alamos.capital").catch(() => {});
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[s.title, { color: c.text }]}>Soporte</Text>
        <StatusBadge />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO ── */}
        <View style={s.heroBlock}>
          <Text style={[s.heroGreet, { color: c.textMuted }]}>
            Hola, {firstName}
          </Text>
          <Text style={[s.heroTitle, { color: c.text }]}>
            ¿En qué te ayudamos?
          </Text>

          <View style={[s.metaRow]}>
            <MetaChip
              dotColor={c.greenDark}
              label="Respondemos en ~1 min"
              textColor={c.textSecondary}
              bg={c.surfaceHover}
              border={c.border}
            />
            <MetaChip
              label="Persona real"
              textColor={c.textSecondary}
              bg={c.surfaceHover}
              border={c.border}
            />
          </View>

          <Pressable
            onPress={() => openChat()}
            style={[s.primaryCta, { backgroundColor: c.ink }]}
          >
            <View style={s.ctaLeft}>
              <View style={[s.ctaIconBubble, { backgroundColor: c.green }]}>
                <Feather name="message-circle" size={18} color={c.ink} />
              </View>
              <View>
                <Text style={[s.ctaTitle, { color: c.bg }]}>
                  Iniciar chat
                </Text>
                <Text
                  style={[
                    s.ctaSub,
                    { color: "rgba(250,250,247,0.64)" },
                  ]}
                >
                  Hablá con alguien del equipo ahora
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={c.bg} />
          </Pressable>
        </View>

        {/* ── EQUIPO EN LÍNEA ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={[s.eyebrow, { color: c.textMuted }]}>
              Equipo en línea ahora
            </Text>
            <Text style={[s.counter, { color: c.greenDark }]}>
              · {agents.length} disponibles
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.agentsRow}
          >
            {agents.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                onPress={() => openChat({ agent: a.id })}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── TEMAS FRECUENTES ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={[s.eyebrow, { color: c.textMuted }]}>
              Temas frecuentes
            </Text>
          </View>
          <View style={s.topicsGrid}>
            {topics.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => openChat({ topic: t.id })}
                style={[
                  s.topicCard,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View
                  style={[
                    s.topicIcon,
                    { backgroundColor: c.surfaceHover },
                  ]}
                >
                  <Feather name={t.icon} size={18} color={c.text} />
                </View>
                <Text style={[s.topicLabel, { color: c.text }]}>{t.label}</Text>
                <Text style={[s.topicHint, { color: c.textMuted }]} numberOfLines={1}>
                  {t.hint}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── URGENCIA / FRAUDE ── */}
        <Pressable
          onPress={() => openChat({ urgent: true })}
          style={[s.urgent, { borderColor: c.red }]}
        >
          <View style={[s.urgentIcon, { backgroundColor: c.red }]}>
            <Feather name="alert-triangle" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.urgentTitle, { color: c.red }]}>
              ¿Fraude o acceso no autorizado?
            </Text>
            <Text style={[s.urgentBody, { color: c.textSecondary }]}>
              Fila prioritaria 24/7. Respondemos al instante y te ayudamos a
              bloquear la cuenta.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={c.red} />
        </Pressable>

        {/* ── OTROS CANALES ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={[s.eyebrow, { color: c.textMuted }]}>
              Otros canales
            </Text>
          </View>
          <View style={s.channelsRow}>
            <ChannelPill
              icon="phone"
              label="Teléfono"
              hint="0800-342-2567"
              onPress={openPhone}
            />
            <ChannelPill
              icon="mail"
              label="Mail"
              hint="ayuda@alamos.capital"
              onPress={openMail}
            />
            <ChannelPill
              icon="message-square"
              label="WhatsApp"
              hint="+54 11 0000-0000"
              onPress={openWhatsapp}
            />
          </View>
        </View>

        {/* ── CASOS ANTERIORES ── */}
        {pastCases.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={[s.eyebrow, { color: c.textMuted }]}>
                Tus conversaciones
              </Text>
            </View>
            <View
              style={[
                s.casesCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {pastCases.map((pc, i) => (
                <Pressable
                  key={pc.id}
                  onPress={() => openChat()}
                  style={[
                    s.caseRow,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.caseTitle, { color: c.text }]} numberOfLines={2}>
                      {pc.title}
                    </Text>
                    <View style={s.caseMeta}>
                      <View
                        style={[
                          s.caseBadge,
                          {
                            backgroundColor:
                              pc.status === "resuelto"
                                ? c.surfaceHover
                                : c.green,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.caseBadgeText,
                            {
                              color:
                                pc.status === "resuelto"
                                  ? c.textSecondary
                                  : c.ink,
                            },
                          ]}
                        >
                          {pc.status}
                        </Text>
                      </View>
                      <Text style={[s.caseTime, { color: c.textMuted }]}>
                        {pc.time}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={c.textFaint} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[s.promise, { color: c.textMuted }]}>
          Prometemos humanos, no bots. Respuestas claras, no vueltas. Soporte
          cuando lo necesites, no cuando a nosotros nos convenga.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─── Sub-components ─── */

function StatusBadge() {
  const { c } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View
      style={[
        s.statusBadge,
        { backgroundColor: c.surfaceHover, borderColor: c.border },
      ]}
    >
      <Animated.View
        style={[
          s.statusDot,
          { backgroundColor: c.greenDark, opacity: pulse },
        ]}
      />
      <Text style={[s.statusText, { color: c.textSecondary }]}>
        Online
      </Text>
    </View>
  );
}

function MetaChip({
  label,
  dotColor,
  textColor,
  bg,
  border,
}: {
  label: string;
  dotColor?: string;
  textColor: string;
  bg: string;
  border: string;
}) {
  return (
    <View
      style={[s.metaChip, { backgroundColor: bg, borderColor: border }]}
    >
      {dotColor ? (
        <View style={[s.metaDot, { backgroundColor: dotColor }]} />
      ) : null}
      <Text style={[s.metaText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function AgentCard({
  agent,
  onPress,
}: {
  agent: Agent;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const toneBg =
    agent.avatarTone === "ink"
      ? c.ink
      : agent.avatarTone === "green"
      ? c.green
      : agent.avatarTone === "warm"
      ? "#E8B84A"
      : "#4A7DFF";
  const toneFg = agent.avatarTone === "green" ? c.ink : "#FFFFFF";
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.agentCard,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={s.agentAvatarWrap}>
        <View style={[s.agentAvatar, { backgroundColor: toneBg }]}>
          <Text style={[s.agentInitial, { color: toneFg }]}>
            {agent.avatarInitial}
          </Text>
        </View>
        <View
          style={[
            s.onlineDot,
            { backgroundColor: c.greenDark, borderColor: c.surface },
          ]}
        />
      </View>
      <Text style={[s.agentName, { color: c.text }]}>{agent.name}</Text>
      <Text style={[s.agentRole, { color: c.textMuted }]} numberOfLines={1}>
        {agent.role}
      </Text>
    </Pressable>
  );
}

function ChannelPill({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.channelPill,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={[s.channelIcon, { backgroundColor: c.surfaceHover }]}>
        <Feather name={icon} size={16} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.channelLabel, { color: c.text }]}>{label}</Text>
        <Text style={[s.channelHint, { color: c.textMuted }]} numberOfLines={1}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
  },

  /* Status badge */
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* Hero */
  heroBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heroGreet: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: fontFamily[700],
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.4,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  metaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  metaText: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: radius.xl,
  },
  ctaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  ctaIconBubble: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTitle: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.5,
  },
  ctaSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },

  /* Section common */
  section: {
    marginTop: 28,
  },
  sectionHead: {
    paddingHorizontal: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  counter: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.5,
  },

  /* Agents */
  agentsRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  agentCard: {
    width: 110,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  agentAvatarWrap: {
    position: "relative",
  },
  agentAvatar: {
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  agentInitial: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  onlineDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  agentName: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  agentRole: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },

  /* Topics grid */
  topicsGrid: {
    paddingHorizontal: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  topicCard: {
    width: "48%",
    flexGrow: 1,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  topicIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topicLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
  },
  topicHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
  },

  /* Urgent */
  urgent: {
    marginHorizontal: 20,
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  urgentIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  urgentTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  urgentBody: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.05,
  },

  /* Channels */
  channelsRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  channelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  channelIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  channelLabel: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  channelHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },

  /* Cases */
  casesCard: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  caseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  caseTitle: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  caseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  caseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  caseBadgeText: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  caseTime: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },

  /* Promise */
  promise: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: -0.1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
});
