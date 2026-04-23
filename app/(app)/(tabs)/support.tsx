import { useEffect, useRef } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { Tap } from "../../../lib/components/Tap";

/* ─── Data ─── */

interface Article {
  id: string;
  title: string;
  subtitle: string;
  /** Categoría visual para la pill superior de la card. */
  tag: string;
  /** Minutos estimados de lectura. */
  readMins: number;
  /** Slug para formar la URL (https://alamos.capital/academy/:slug). */
  slug: string;
}

const articles: Article[] = [
  {
    id: "a1",
    title: "¿Qué son los CEDEARs?",
    subtitle: "Cómo tener acciones del exterior en pesos, paso a paso.",
    tag: "Guía",
    readMins: 6,
    slug: "que-son-los-cedears",
  },
  {
    id: "a2",
    title: "Cómo comprar dólar MEP",
    subtitle: "La alternativa legal al dólar oficial y cuándo conviene.",
    tag: "Tutorial",
    readMins: 4,
    slug: "comprar-dolar-mep",
  },
  {
    id: "a3",
    title: "FCI: dónde poner tu efectivo",
    subtitle: "Money market, renta fija y mixtos — diferencias y cuándo usar cada uno.",
    tag: "Finanzas",
    readMins: 8,
    slug: "fci-money-market",
  },
  {
    id: "a4",
    title: "Impuestos para inversores",
    subtitle: "Bienes personales, ganancias y retenciones. Lo que tenés que saber.",
    tag: "Impuestos",
    readMins: 10,
    slug: "impuestos-inversores",
  },
];

const ACADEMY_URL = "https://alamos.capital/academy";

/* ─── Screen ─── */

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);

  // Scroll-top al tapear la tab Soporte estando ya en Soporte.
  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as never, () => {
      if (!isFocused) return;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation, isFocused]);

  const openArticle = (slug?: string) => {
    const url = slug ? `${ACADEMY_URL}/${slug}` : ACADEMY_URL;
    Linking.openURL(url).catch(() => {});
  };

  const openChatAI = () => {
    router.push({ pathname: "/(app)/chat", params: { mode: "ai" } });
  };

  const openChatHuman = () => {
    router.push({ pathname: "/(app)/chat", params: { mode: "human" } });
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[s.title, { color: c.text }]}>Soporte</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── ALAMOS ACADEMY ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.eyebrow, { color: c.textMuted }]}>
                ALAMOS ACADEMY
              </Text>
              <Text style={[s.sectionTitle, { color: c.text }]}>
                Aprendé a invertir
              </Text>
            </View>
            <Tap
              onPress={() => openArticle()}
              hitSlop={8}
              style={[
                s.seeAllPill,
                { backgroundColor: c.surfaceHover, borderColor: c.border },
              ]}
            >
              <Text style={[s.seeAllText, { color: c.text }]}>Ver todos</Text>
              <Feather name="arrow-up-right" size={12} color={c.text} />
            </Tap>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.articlesRow}
          >
            {articles.map((art) => (
              <Tap
                key={art.id}
                onPress={() => openArticle(art.slug)}
                haptic="selection"
                style={[
                  s.articleCard,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                <View
                  style={[
                    s.articleTag,
                    { backgroundColor: c.surfaceHover },
                  ]}
                >
                  <Text style={[s.articleTagText, { color: c.textSecondary }]}>
                    {art.tag}
                  </Text>
                </View>
                <Text
                  style={[s.articleTitle, { color: c.text }]}
                  numberOfLines={2}
                >
                  {art.title}
                </Text>
                <Text
                  style={[s.articleSubtitle, { color: c.textMuted }]}
                  numberOfLines={3}
                >
                  {art.subtitle}
                </Text>
                <View style={s.articleFoot}>
                  <Feather name="clock" size={11} color={c.textFaint} />
                  <Text style={[s.articleMeta, { color: c.textFaint }]}>
                    {art.readMins} min de lectura
                  </Text>
                </View>
              </Tap>
            ))}
          </ScrollView>
        </View>

        {/* ── CHAT DE SOPORTE ── */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.eyebrow, { color: c.textMuted }]}>
                CHAT DE SOPORTE
              </Text>
              <Text style={[s.sectionTitle, { color: c.text }]}>
                ¿Necesitás una mano?
              </Text>
            </View>
          </View>

          {/* Opción 1: IA — inmediata */}
          <Tap
            onPress={openChatAI}
            haptic="medium"
            style={[s.chatCta, { backgroundColor: c.ink }]}
          >
            <View style={s.chatCtaLeft}>
              <View
                style={[s.chatCtaIcon, { backgroundColor: c.green }]}
              >
                <Feather name="zap" size={18} color={c.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.chatCtaTitle, { color: c.bg }]}>
                  Hablar con la IA
                </Text>
                <Text
                  style={[
                    s.chatCtaSub,
                    { color: "rgba(250,250,247,0.64)" },
                  ]}
                >
                  Respuestas al instante, 24/7
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={c.bg} />
          </Tap>

          {/* Opción 2: persona — escalamiento */}
          <Tap
            onPress={openChatHuman}
            haptic="selection"
            style={[
              s.chatCtaSecondary,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <View style={s.chatCtaLeft}>
              <View
                style={[s.chatCtaIcon, { backgroundColor: c.surfaceHover }]}
              >
                <Feather name="user" size={18} color={c.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.chatCtaTitle, { color: c.text }]}>
                  Hablar con una persona
                </Text>
                <Text style={[s.chatCtaSub, { color: c.textMuted }]}>
                  Si la IA no alcanza, te conectamos con alguien del equipo
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={c.textFaint} />
          </Tap>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─── */

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

  /* Section */
  section: {
    marginTop: 24,
  },
  sectionHead: {
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.6,
  },
  seeAllPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  seeAllText: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* Academy articles */
  articlesRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  articleCard: {
    width: 240,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 10,
  },
  articleTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  articleTagText: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  articleTitle: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.4,
  },
  articleSubtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  articleFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  articleMeta: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },

  /* Chat CTAs */
  chatCta: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    marginBottom: 10,
  },
  chatCtaSecondary: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  chatCtaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  chatCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chatCtaTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  chatCtaSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
    lineHeight: 16,
  },
});
