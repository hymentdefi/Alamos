import { useRef, useState } from "react";
import {
  View, Text, Pressable, FlatList, Dimensions, StyleSheet, Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

const { width } = Dimensions.get("window");

interface Slide {
  icon: string;
  title: string;
  body: string;
}

const slides: Slide[] = [
  {
    icon: "📈",
    title: "Invertir lleva tiempo",
    body: "Invertir requiere paciencia. Construir riqueza es un proceso gradual — los inversores más exitosos piensan a largo plazo.",
  },
  {
    icon: "🎯",
    title: "El mercado es lo que vos hagas",
    body: "Podés usarlo para construir patrimonio a largo plazo o para operar activamente. La estrategia la definís vos.",
  },
  {
    icon: "💸",
    title: "Invertir es más accesible que nunca",
    body: "Con internet y tu celular, invertir es más fácil y económico. En Álamos podés empezar con lo que quieras, sin comisiones.",
  },
  {
    icon: "🔓",
    title: "Tu plata no queda atrapada",
    body: "Cuando invertís, tu plata se convierte en otro activo. Podés vender y retirar tus fondos cuando quieras.",
  },
];

const RECAP_INDEX = slides.length;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatlistRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isRecap = currentIndex === RECAP_INDEX;
  const totalPages = slides.length + 1; // slides + recap

  const goNext = () => {
    const next = currentIndex + 1;
    if (next < totalPages) {
      flatlistRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  };

  const goBack = () => {
    const prev = currentIndex - 1;
    if (prev >= 0) {
      flatlistRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrentIndex(prev);
    }
  };

  const finish = () => {
    router.replace("/(app)");
  };

  const renderSlide = ({ item, index }: { item: Slide | null; index: number }) => {
    if (index === RECAP_INDEX) {
      return (
        <View style={[s.slide, { width }]}>
          <View style={s.recapIconWrap}>
            <Text style={{ fontSize: 56 }}>✅</Text>
          </View>
          <View style={s.slideContent}>
            <Text style={s.recapTitle}>¡Listo!</Text>
            <Text style={s.recapBody}>
              Aprendiste lo básico sobre invertir. Acá un resumen:
            </Text>
            {slides.map((sl, i) => (
              <View key={i} style={s.recapItem}>
                <Text style={s.recapBullet}>•</Text>
                <Text style={s.recapText}>{sl.title}</Text>
              </View>
            ))}
            <Text style={s.riskNote}>
              Todas las inversiones implican riesgo.
            </Text>
          </View>
        </View>
      );
    }
    return (
      <View style={[s.slide, { width }]}>
        <View style={s.emojiArea}>
          <Text style={s.emoji}>{item!.icon}</Text>
        </View>
        <View style={s.slideContent}>
          <Text style={s.slideTitle}>{item!.title}</Text>
          <Text style={s.slideBody}>{item!.body}</Text>
        </View>
      </View>
    );
  };

  const data = [...slides, null]; // null = recap

  return (
    <View style={s.container}>
      {/* Close button */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={finish} style={s.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatlistRef}
        data={data}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
      />

      {/* Bottom controls */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {!isRecap ? (
          <>
            {/* Progress bar */}
            <View style={s.progressBar}>
              {data.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.progressDot,
                    i <= currentIndex && s.progressDotActive,
                    { flex: 1 },
                  ]}
                />
              ))}
            </View>

            {/* Navigation arrows */}
            <View style={s.navRow}>
              <Pressable
                onPress={goBack}
                style={[s.arrowBtn, currentIndex === 0 && { opacity: 0.3 }]}
                disabled={currentIndex === 0}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
              </Pressable>
              <Pressable onPress={goNext} style={[s.arrowBtn, s.arrowBtnNext]}>
                <Ionicons name="arrow-forward" size={20} color={colors.text.primary} />
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable onPress={finish} style={s.doneBtn}>
            <Text style={s.doneBtnText}>Empezar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface[0],
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  slide: {
    flex: 1,
  },
  emojiArea: {
    height: "35%",
    backgroundColor: "#1a3a2a",
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  emoji: {
    fontSize: 72,
  },
  slideContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  slideBody: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  recapIconWrap: {
    height: "30%",
    backgroundColor: "#1a3a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  recapTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 12,
  },
  recapBody: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  recapItem: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  recapBullet: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  recapText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  riskNote: {
    fontSize: 13,
    color: colors.brand[500],
    marginTop: 24,
  },
  bottom: {
    paddingHorizontal: 28,
  },
  progressBar: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 20,
  },
  progressDot: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.text.primary,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  arrowBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface[100],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBtnNext: {
    backgroundColor: colors.text.primary,
  },
  doneBtn: {
    backgroundColor: colors.text.primary,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnText: {
    color: colors.surface[0],
    fontWeight: "700",
    fontSize: 16,
  },
});
