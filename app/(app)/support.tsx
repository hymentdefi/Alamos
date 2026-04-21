import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    id: "1",
    question: "¿Cuánto tarda en acreditarse un ingreso?",
    answer:
      "Los ingresos desde tu cuenta bancaria asociada se acreditan en el momento, apenas el banco emisor confirme la transferencia. Si no aparece en 30 minutos, contactanos.",
  },
  {
    id: "2",
    question: "¿Qué comisiones cobra Alamos?",
    answer:
      "0,5% por operación en CEDEARs, acciones y bonos. Los fondos comunes de inversión no tienen comisión de compra/venta. No hay costo de mantenimiento de cuenta.",
  },
  {
    id: "3",
    question: "¿Cómo se paga el impuesto a las ganancias?",
    answer:
      "Como ALyC retenemos impuestos a bienes personales cuando corresponde. El impuesto a las ganancias sobre rendimientos financieros lo liquidás en tu declaración anual.",
  },
  {
    id: "4",
    question: "¿Cuáles son los horarios de mercado?",
    answer:
      "BYMA opera de lunes a viernes, 11 a 17hs. CEDEARs extienden hasta las 19hs en rueda extendida. Las órdenes fuera de horario se ejecutan al inicio de la siguiente rueda.",
  },
  {
    id: "5",
    question: "¿Puedo operar desde la web?",
    answer:
      "Sí. Todo lo que hacés en la app está disponible en alamos.capital. Usá el mismo email y contraseña.",
  },
  {
    id: "6",
    question: "¿Qué pasa si pierdo mi celular?",
    answer:
      "Iniciá sesión desde la web y cerrá la sesión del dispositivo perdido en Seguridad → Sesiones activas. Para bloquear tu cuenta escribinos a ayuda@alamos.capital.",
  },
];

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [open, setOpen] = useState<string | null>(null);

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
        <Text style={[s.headerTitle, { color: c.text }]}>Ayuda</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Text style={[s.heroTitle, { color: c.text }]}>
            ¿En qué podemos ayudarte?
          </Text>
          <Text style={[s.heroSub, { color: c.textMuted }]}>
            Respondemos en el día hábil. Para consultas operativas urgentes usá
            el chat.
          </Text>
        </View>

        <View style={s.channelsRow}>
          <ChannelCard
            icon="message-circle"
            label="Chat"
            hint="Lun a vie · 9 a 18"
          />
          <ChannelCard
            icon="mail"
            label="Email"
            hint="ayuda@alamos.capital"
          />
        </View>

        <View style={s.faqBlock}>
          <Text style={[s.eyebrow, { color: c.textMuted }]}>
            Preguntas frecuentes
          </Text>
          <View
            style={[
              s.faqCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {faqs.map((faq, i) => {
              const isOpen = open === faq.id;
              return (
                <Pressable
                  key={faq.id}
                  onPress={() => setOpen(isOpen ? null : faq.id)}
                  style={[
                    s.faqRow,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                  ]}
                >
                  <View style={s.faqHead}>
                    <Text style={[s.faqQ, { color: c.text }]}>
                      {faq.question}
                    </Text>
                    <Feather
                      name={isOpen ? "minus" : "plus"}
                      size={18}
                      color={c.textMuted}
                    />
                  </View>
                  {isOpen ? (
                    <Text style={[s.faqA, { color: c.textSecondary }]}>
                      {faq.answer}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            s.contactCard,
            { backgroundColor: c.surfaceHover, borderColor: c.border },
          ]}
        >
          <Text style={[s.contactTitle, { color: c.text }]}>
            ¿No encontraste la respuesta?
          </Text>
          <Text style={[s.contactBody, { color: c.textMuted }]}>
            Escribinos a{" "}
            <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
              ayuda@alamos.capital
            </Text>{" "}
            y te respondemos dentro de las 24hs hábiles.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ChannelCard({
  icon,
  label,
  hint,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      style={[
        s.channel,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={[s.channelIcon, { backgroundColor: c.surfaceHover }]}>
        <Feather name={icon} size={18} color={c.text} />
      </View>
      <Text style={[s.channelLabel, { color: c.text }]}>{label}</Text>
      <Text style={[s.channelHint, { color: c.textMuted }]}>{hint}</Text>
    </Pressable>
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
  hero: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroTitle: {
    fontFamily: fontFamily[700],
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1,
    marginBottom: 8,
  },
  heroSub: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    maxWidth: 320,
  },
  channelsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  channel: {
    flex: 1,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  channelLabel: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  channelHint: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  faqBlock: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  faqCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  faqRow: {
    paddingHorizontal: 16,
    paddingVertical: spacing.md + 4,
  },
  faqHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  faqQ: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  faqA: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
    marginTop: 10,
  },
  contactCard: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  contactTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  contactBody: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
});
