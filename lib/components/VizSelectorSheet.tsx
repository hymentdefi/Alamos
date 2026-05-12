import { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../theme";

export type VizKey = "treemap" | "brick" | "pie" | "ranking";

interface Props {
  visible: boolean;
  viz: VizKey;
  onChangeViz: (next: VizKey) => void;
  onClose: () => void;
  /** Glyphs renderers — los pasa el caller para evitar acoplar el sheet
   *  con la implementación SVG específica de los íconos de Cartera. */
  glyphs: Record<VizKey, (props: { color: string; size: number }) => JSX.Element>;
  /** Tono de acento (verde si el día va arriba, naranja si abajo). El
   *  check de la opción activa y el borde de su row toman este color. */
  tone: string;
}

const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

interface Option {
  key: VizKey;
}

const OPTIONS: Option[] = [
  { key: "pie" },
  { key: "treemap" },
  { key: "brick" },
  { key: "ranking" },
];

/**
 * Sheet para elegir la viz del chart de Cartera. Mismo patrón que el
 * ChartSettingsSheet del Inicio: hero arriba + lista de opciones con
 * glyph + label + descripción + check del seleccionado. Se cierra
 * deslizando hacia abajo. Tap a una opción cambia el viz y cierra.
 */
export function VizSelectorSheet({
  visible,
  viz,
  onChangeViz,
  onClose,
  glyphs,
  tone,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();

  const translateY = useSharedValue(windowH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    translateY.value = withTiming(
      windowH,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished) runOnJS(onClose)();
      },
    );
    backdropOpacity.value = withTiming(0, { duration: 240 });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      "worklet";
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        backdropOpacity.value = Math.max(
          0,
          1 - e.translationY / windowH,
        );
      }
    })
    .onEnd((e) => {
      "worklet";
      const shouldDismiss =
        e.translationY > DISMISS_TRANSLATE ||
        e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(
          windowH,
          { duration: 240, easing: Easing.in(Easing.cubic) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(onClose)();
          },
        );
        backdropOpacity.value = withTiming(0, { duration: 240 });
      } else {
        translateY.value = withTiming(0, {
          duration: 220,
          easing: Easing.out(Easing.cubic),
        });
        backdropOpacity.value = withTiming(1, { duration: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const select = (key: VizKey) => {
    Haptics.selectionAsync().catch(() => {});
    if (key !== viz) onChangeViz(key);
    dismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: c.bg,
              borderColor: c.border,
              paddingBottom: insets.bottom + 24,
            },
            sheetStyle,
          ]}
        >
          <View style={s.grabber}>
            <View
              style={[s.grabberPill, { backgroundColor: c.borderStrong }]}
            />
          </View>

          <View style={s.hero}>
            <Text style={[s.title, { color: c.text }]}>
              Cómo ver tu cartera
            </Text>
          </View>

          <View style={s.tilesRow}>
            {OPTIONS.map((opt) => {
              const selected = opt.key === viz;
              const Glyph = glyphs[opt.key];
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => select(opt.key)}
                  style={({ pressed }) => [
                    s.tile,
                    {
                      backgroundColor: selected ? c.surface : c.surfaceHover,
                      borderColor: selected ? tone : "transparent",
                      borderWidth: selected ? 1.6 : 0,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Glyph color={c.text} size={28} />
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    alignItems: "center",
    paddingVertical: 8,
  },
  grabberPill: {
    width: 40,
    height: 4,
    borderCurve: "continuous",
    borderRadius: 2,
  },
  hero: {
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 24,
    letterSpacing: -0.8,
  },
  /* Row de 4 tiles, gap chico, todos del mismo ancho (flex: 1). El
   * tile seleccionado lleva borde brand + bg c.surface; los demás
   * quedan en c.surfaceHover plano sin borde. */
  tilesRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 8,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: radius.lg,
  },
});
