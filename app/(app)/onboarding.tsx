import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { AlamosLogo } from "../../lib/components/Logo";

const { width } = Dimensions.get("window");

interface Slide {
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  icon: keyof typeof Feather.glyphMap;
}

const slides: Slide[] = [
  {
    eyebrow: "Mercado local",
    title: "CEDEARs, bonos y\nfondos",
    accent: "argentinos",
    body:
      "Acceso directo a las inversiones del mercado argentino. Sin intermediarios, sin vueltas.",
    icon: "trending-up",
  },
  {
    eyebrow: "Transparencia",
    title: "Comisión clara de\n0,5% por operación",
    accent: "sin sorpresas",
    body:
      "Sin costo de mantenimiento, sin comisiones ocultas. Lo que ves es lo que pagás.",
    icon: "eye",
  },
  {
    eyebrow: "En minutos",
    title: "Abrí tu cuenta con\nDNI y CUIL",
    accent: "100% online",
    body:
      "Validamos tu identidad en el momento. Ingresás fondos y empezás a invertir el mismo día.",
    icon: "zap",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const next = () => {
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
      setIndex(index + 1);
    } else {
      router.replace("/(auth)/register");
    }
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <AlamosLogo variant="mark" tone="light" size={26} />
        <Pressable onPress={() => router.replace("/(auth)/register")}>
          <Text style={[s.skip, { color: c.textMuted }]}>Saltar</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onScroll={onScroll}
        renderItem={({ item }) => <SlideView slide={item} />}
      />

      <View style={s.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              {
                backgroundColor: i === index ? c.ink : c.surfaceSunken,
                width: i === index ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[s.cta, { backgroundColor: c.ink }]}
          onPress={next}
        >
          <Text style={[s.ctaText, { color: c.bg }]}>
            {index === slides.length - 1 ? "Crear cuenta" : "Siguiente"}
          </Text>
          <Feather name="arrow-right" size={16} color={c.bg} />
        </Pressable>
        <Pressable
          style={s.loginLink}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={[s.loginText, { color: c.textMuted }]}>
            ¿Ya tenés cuenta?{" "}
            <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
              Iniciar sesión
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  const { c } = useTheme();
  return (
    <View style={[s.slide, { width }]}>
      <View style={[s.iconBlock, { backgroundColor: c.surfaceHover }]}>
        <Feather name={slide.icon} size={32} color={c.ink} />
      </View>
      <Text style={[s.eyebrow, { color: c.textMuted }]}>
        {slide.eyebrow.toUpperCase()}
      </Text>
      <Text style={[s.title, { color: c.text }]}>
        {slide.title}{" "}
        <Text style={[s.titleAccent, { backgroundColor: c.green }]}>
          {slide.accent}
        </Text>
        .
      </Text>
      <Text style={[s.body, { color: c.textMuted }]}>{slide.body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  skip: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    gap: 16,
  },
  iconBlock: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.8,
  },
  titleAccent: {
    fontFamily: fontFamily[700],
    paddingHorizontal: 2,
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.2,
    maxWidth: 360,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottom: {
    paddingHorizontal: 24,
  },
  cta: {
    height: 52,
    borderRadius: radius.btn,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: 14,
  },
  loginText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
  },
});
