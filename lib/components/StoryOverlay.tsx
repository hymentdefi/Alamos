import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { fontFamily } from "../theme";

export interface StorySlide {
  /** Emoji / símbolo grande arriba. */
  emoji: string;
  /** Headline corto y punchy. */
  title: string;
  /** Cuerpo explicativo (1-2 líneas). */
  body: string;
}

export interface StoryConfig {
  id: string;
  /** Color de fondo principal (top del gradient). */
  bgTop: string;
  /** Color de fondo secundario (bottom del gradient). */
  bgBottom: string;
  /** Color del accent (progress bars activas, título). */
  accent: string;
  slides: StorySlide[];
}

interface Props {
  visible: boolean;
  story: StoryConfig | null;
  onClose: () => void;
}

const SLIDE_DURATION_MS = 4200;

/**
 * Overlay full-screen estilo Instagram Stories. Educa al usuario sobre
 * un segmento nuevo (crypto, USA, etc.) la primera vez que lo activa.
 *
 * Controles:
 *   - Tap a la derecha → siguiente slide (o cierra en el último)
 *   - Tap a la izquierda → slide anterior (no-op si es el primero)
 *   - Tap & hold cualquier lado → pausa el auto-advance (no implementado MVP)
 *   - X arriba a la derecha → cierra inmediatamente
 *
 * Auto-advance: el progress bar de la slide activa se llena en
 * SLIDE_DURATION_MS; al completarse pasa a la siguiente automáticamente.
 */
export function StoryOverlay({ visible, story, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Reset cuando se abre / cambia story.
  useEffect(() => {
    if (visible) {
      setIdx(0);
    }
  }, [visible, story?.id]);

  // Animación del progress bar de la slide activa.
  useEffect(() => {
    if (!visible || !story) return;
    progress.setValue(0);
    animRef.current?.stop();
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: SLIDE_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      if (!finished) return;
      // Al completarse, avanzar.
      if (idx < story.slides.length - 1) {
        setIdx(idx + 1);
      } else {
        onClose();
      }
    });
    return () => {
      anim.stop();
    };
  }, [visible, idx, story, onClose, progress]);

  if (!visible || !story) return null;
  const slide = story.slides[idx];

  const next = () => {
    Haptics.selectionAsync().catch(() => {});
    if (idx < story.slides.length - 1) setIdx(idx + 1);
    else onClose();
  };
  const prev = () => {
    Haptics.selectionAsync().catch(() => {});
    if (idx > 0) setIdx(idx - 1);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <LinearGradient
          colors={[story.bgTop, story.bgBottom]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Progress bars arriba — una por slide. La activa se llena
            en sync con el auto-advance. Las anteriores quedan completas. */}
        <View style={[s.progressRow, { paddingTop: insets.top + 10 }]}>
          {story.slides.map((_, i) => {
            const isPast = i < idx;
            const isActive = i === idx;
            return (
              <View key={i} style={s.progressTrack}>
                {isActive ? (
                  <Animated.View
                    style={[
                      s.progressFill,
                      {
                        backgroundColor: story.accent,
                        width: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      s.progressFill,
                      {
                        backgroundColor: isPast
                          ? story.accent
                          : "transparent",
                        width: isPast ? "100%" : "0%",
                      },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Botón cerrar arriba a la derecha. */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[s.closeBtn, { top: insets.top + 10 }]}
        >
          <Feather name="x" size={22} color="#FFFFFF" />
        </Pressable>

        {/* Tap zones invisibles — left previous, right next. */}
        <Pressable style={s.leftZone} onPress={prev} />
        <Pressable style={s.rightZone} onPress={next} />

        {/* Contenido del slide — centrado vertical. */}
        <View
          style={[
            s.content,
            { paddingBottom: insets.bottom + 40 },
          ]}
          pointerEvents="none"
        >
          <Text style={s.emoji}>{slide.emoji}</Text>
          <Text style={[s.title, { color: story.accent }]}>
            {slide.title}
          </Text>
          <Text style={s.body}>{slide.body}</Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  progressRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 4,
    zIndex: 10,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    zIndex: 20,
  },
  leftZone: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "33%",
    zIndex: 5,
  },
  rightZone: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "67%",
    zIndex: 5,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  emoji: {
    fontSize: 76,
    lineHeight: 84,
    marginBottom: 28,
    textAlign: "center",
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    textAlign: "center",
    marginBottom: 16,
  },
  body: {
    fontFamily: fontFamily[500],
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.85)",
  },
});
