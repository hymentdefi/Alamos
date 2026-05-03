import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { useAuth } from "../../lib/auth/context";

type Role = "user" | "agent" | "system";

interface Message {
  id: string;
  role: Role;
  text: string;
  time: string;
}

const agentDirectory: Record<string, { name: string; role: string; initial: string; tone: "ink" | "green" | "warm" | "blue" }> = {
  a1: { name: "Sofía", role: "Atención al cliente", initial: "S", tone: "ink" },
  a2: { name: "Mateo", role: "Mesa de operaciones", initial: "M", tone: "green" },
  a3: { name: "Lucía", role: "Transferencias", initial: "L", tone: "warm" },
  a4: { name: "Juan", role: "Impuestos", initial: "J", tone: "blue" },
};

const topicGreetings: Record<string, string> = {
  cuenta:
    "Hola {name}, ¿qué necesitás resolver sobre tu cuenta? Verificación, datos personales, lo que sea.",
  operar:
    "Hola {name}, estoy para ayudarte con tus órdenes. ¿Estás teniendo algún problema para comprar o vender?",
  transferencias:
    "Hola {name}, ¿querés ingresar o extraer? Te guío paso a paso.",
  impuestos:
    "Hola {name}, ¿sobre qué necesitás info? Retenciones, certificados, bienes personales...",
  seguridad:
    "Hola {name}, ¿algo raro en tu cuenta o una duda sobre tu contraseña/2FA?",
  app:
    "Hola {name}, ¿hay algo de la app que no termina de quedarte claro?",
};

export default function ChatScreen() {
  const { topic, agent, urgent } = useLocalSearchParams<{
    topic?: string;
    agent?: string;
    urgent?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] ?? "Martín";

  // Elegir el agente: o el que venía por params, o uno default según topic.
  const selectedAgent = useMemo(() => {
    if (agent && agentDirectory[agent]) return agentDirectory[agent];
    if (topic === "operar") return agentDirectory.a2;
    if (topic === "transferencias") return agentDirectory.a3;
    if (topic === "impuestos") return agentDirectory.a4;
    return agentDirectory.a1;
  }, [agent, topic]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [agentTyping, setAgentTyping] = useState(false);
  const listRef = useRef<FlatList>(null);
  const scheduledTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scheduleTimeout = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    scheduledTimeouts.current.push(t);
    return t;
  };

  useEffect(() => {
    return () => {
      scheduledTimeouts.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Scripted greeting
  useEffect(() => {
    const now = nowTime();
    const intro: Message[] = [
      {
        id: "sys-1",
        role: "system",
        text: urgent
          ? "Fila prioritaria activada. Un especialista va a atenderte en segundos."
          : `Conectando con ${selectedAgent.name}…`,
        time: now,
      },
    ];
    setMessages(intro);

    scheduleTimeout(() => {
      setAgentTyping(true);
    }, urgent ? 400 : 900);

    scheduleTimeout(
      () => {
        setAgentTyping(false);
        const greetTemplate =
          topic && topicGreetings[topic]
            ? topicGreetings[topic]
            : urgent
            ? "Hola {name}, soy {aname} y te atiendo yo ahora mismo. Contame qué pasó con tu cuenta, paso a paso, así actuamos rápido."
            : "Hola {name}, soy {aname}. Estoy al lado tuyo. Contame qué necesitás y vemos cómo te ayudo.";
        const greetText = greetTemplate
          .replaceAll("{name}", firstName)
          .replaceAll("{aname}", selectedAgent.name);
        setMessages((m) => [
          ...m,
          {
            id: "a-1",
            role: "agent",
            text: greetText,
            time: nowTime(),
          },
        ]);
      },
      urgent ? 1500 : 2400,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, agentTyping]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      time: nowTime(),
    };
    setMessages((m) => [...m, userMsg]);
    setDraft("");

    // Agent auto-reply simulado
    scheduleTimeout(() => {
      setAgentTyping(true);
    }, 450);

    scheduleTimeout(() => {
      setAgentTyping(false);
      const reply = craftReply(text, selectedAgent.name);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "agent",
          text: reply,
          time: nowTime(),
        },
      ]);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }, 1600 + Math.min(2500, text.length * 40));
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: c.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          s.header,
          {
            backgroundColor: c.bg,
            borderBottomColor: c.border,
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={14}
          style={s.backBtn}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>

        <View style={s.headerIdentity}>
          <View style={s.headerAvatarWrap}>
            <View
              style={[
                s.headerAvatar,
                {
                  backgroundColor:
                    selectedAgent.tone === "ink"
                      ? c.ink
                      : selectedAgent.tone === "green"
                      ? c.green
                      : selectedAgent.tone === "warm"
                      ? "#E8B84A"
                      : "#4A7DFF",
                },
              ]}
            >
              <Text
                style={[
                  s.headerInitial,
                  {
                    color:
                      selectedAgent.tone === "green" ? c.ink : "#FFFFFF",
                  },
                ]}
              >
                {selectedAgent.initial}
              </Text>
            </View>
            <View
              style={[
                s.headerOnlineDot,
                { backgroundColor: c.greenDark, borderColor: c.bg },
              ]}
            />
          </View>
          <View>
            <Text style={[s.headerName, { color: c.text }]}>
              {selectedAgent.name}
            </Text>
            <Text style={[s.headerRole, { color: c.textMuted }]}>
              {selectedAgent.role} · en línea
            </Text>
          </View>
        </View>

        {urgent ? (
          <View style={[s.urgentPill, { backgroundColor: c.red }]}>
            <Feather name="alert-triangle" size={10} color="#FFFFFF" />
            <Text style={s.urgentPillText}>URGENTE</Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{
          paddingTop: 16,
          paddingHorizontal: 16,
          paddingBottom: 10,
        }}
        renderItem={({ item, index }) => {
          const prev = messages[index - 1];
          const sameSender = prev?.role === item.role && item.role !== "system";
          return <Bubble m={item} tight={sameSender} />;
        }}
        ListFooterComponent={agentTyping ? <TypingBubble /> : null}
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
      />

      <View
        style={[
          s.inputBar,
          {
            backgroundColor: c.bg,
            borderTopColor: c.border,
            paddingBottom: insets.bottom + 10,
          },
        ]}
      >
        <View
          style={[
            s.inputBox,
            { backgroundColor: c.surfaceHover, borderColor: c.border },
          ]}
        >
          <TextInput
            style={[s.input, { color: c.text }]}
            placeholder="Escribí tu mensaje…"
            placeholderTextColor={c.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={600}
          />
        </View>
        <Pressable
          onPress={send}
          disabled={!draft.trim()}
          style={[
            s.sendBtn,
            {
              backgroundColor: draft.trim() ? c.ink : c.surfaceHover,
            },
          ]}
        >
          <Feather
            name="arrow-up"
            size={20}
            color={draft.trim() ? c.bg : c.textMuted}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── Sub-components ─── */

function Bubble({ m, tight }: { m: Message; tight: boolean }) {
  const { c } = useTheme();

  if (m.role === "system") {
    return (
      <View style={s.systemWrap}>
        <Text style={[s.systemText, { color: c.textMuted }]}>{m.text}</Text>
      </View>
    );
  }

  const isUser = m.role === "user";
  return (
    <View
      style={[
        s.bubbleRow,
        isUser ? s.bubbleRowEnd : s.bubbleRowStart,
        tight ? s.bubbleRowTight : null,
      ]}
    >
      <View
        style={[
          s.bubble,
          isUser
            ? { backgroundColor: c.ink, borderBottomRightRadius: 6 }
            : { backgroundColor: c.surfaceHover, borderBottomLeftRadius: 6 },
        ]}
      >
        <Text
          style={[
            s.bubbleText,
            { color: isUser ? c.bg : c.text },
          ]}
        >
          {m.text}
        </Text>
        <Text
          style={[
            s.bubbleTime,
            {
              color: isUser
                ? "rgba(250,250,247,0.55)"
                : c.textMuted,
            },
          ]}
        >
          {m.time}
        </Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  const { c } = useTheme();
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 380,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 380,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.delay(260),
        ]),
      );
    const loops = [mk(d1, 0), mk(d2, 140), mk(d3, 280)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [d1, d2, d3]);

  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [
      {
        translateY: v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -3],
        }),
      },
    ],
  });

  return (
    <View style={[s.bubbleRow, s.bubbleRowStart]}>
      <View
        style={[
          s.bubble,
          s.typingBubble,
          { backgroundColor: c.surfaceHover, borderBottomLeftRadius: 6 },
        ]}
      >
        <Animated.View
          style={[s.typingDot, { backgroundColor: c.textMuted }, dotStyle(d1)]}
        />
        <Animated.View
          style={[s.typingDot, { backgroundColor: c.textMuted }, dotStyle(d2)]}
        />
        <Animated.View
          style={[s.typingDot, { backgroundColor: c.textMuted }, dotStyle(d3)]}
        />
      </View>
    </View>
  );
}

/* ─── Helpers ─── */

function nowTime() {
  const d = new Date();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function craftReply(userText: string, agentName: string): string {
  const lower = userText.toLowerCase();
  if (/hola|buen(os|as)/.test(lower)) {
    return `¡Hola! Gracias por escribirnos. Contame un poco más para ayudarte mejor.`;
  }
  if (/transfer|ingres|extrae|cbu|alias/.test(lower)) {
    return `Entendido. Las transferencias se acreditan en el momento si el banco de origen confirma la operación. ¿Tenés el comprobante a mano? Dame el importe y la fecha y lo rastreo.`;
  }
  if (/compra|vender|orden|ejecut/.test(lower)) {
    return `Dale. ¿Qué activo estás operando y qué te apareció en pantalla? Si ya mandaste la orden, pasame el número y lo chequeo en vivo.`;
  }
  if (/impuesto|retenc|gan(ancias)?|bienes/.test(lower)) {
    return `Sí, hay una retención que depende del instrumento. Te paso el certificado de retenciones del último mes o del año que necesites. Decime qué período y te lo subo acá mismo.`;
  }
  if (/clave|contraseñ|2fa|acceso|robaron|hack/.test(lower)) {
    return `Primero quedate tranqui. Ya puedo bloquear la cuenta desde acá mientras seguimos hablando. ¿Querés que lo haga ahora y después revisamos los movimientos juntos?`;
  }
  return `Dame un segundo que lo chequeo en el sistema… ${agentName} no deja a nadie colgado. Contame si necesitás adjuntar algún comprobante y te paso un link seguro para subirlo.`;
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatarWrap: {
    position: "relative",
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInitial: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.4,
  },
  headerOnlineDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerName: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.25,
  },
  headerRole: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 1,
    letterSpacing: -0.05,
  },
  urgentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  urgentPillText: {
    color: "#FFFFFF",
    fontFamily: fontFamily[800],
    fontSize: 9,
    letterSpacing: 0.6,
  },

  /* Bubbles */
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  bubbleRowStart: {
    justifyContent: "flex-start",
  },
  bubbleRowEnd: {
    justifyContent: "flex-end",
  },
  bubbleRowTight: {
    marginTop: -6,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  bubbleTime: {
    fontFamily: fontFamily[500],
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
    letterSpacing: 0.2,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  /* System */
  systemWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  systemText: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
    paddingHorizontal: 20,
    textAlign: "center",
  },

  /* Input */
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBox: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  input: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
    paddingVertical: 10,
    padding: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
