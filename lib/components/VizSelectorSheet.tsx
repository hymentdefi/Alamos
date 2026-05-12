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
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    key: "pie",
    label: "Torta",
    description: "Distribución circular del portfolio",
  },
  {
    key: "treemap",
    label: "Mosaico",
    description: "Bloques proporcionales al peso de cada categoría",
  },
  {
    key: "brick",
    label: "Ladrillo",
    description: "Vista horizontal en una sola barra apilada",
  },
  {
    key: "ranking",
    label: "Pila",
    description: "Monedas apiladas según el tamaño de cada categoría",
  },
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
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              Elegí la forma que más te guste para ver el peso de cada
              categoría sobre el total.
            </Text>
          </View>

          <View style={s.list}>
            {OPTIONS.map((opt) => {
              const selected = opt.key === viz;
              const Glyph = glyphs[opt.key];
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => select(opt.key)}
                  style={({ pressed }) => [
                    s.row,
                    {
                      backgroundColor: c.surface,
                      borderColor: selected ? tone : c.border,
                      borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      s.glyphWrap,
                      { backgroundColor: c.surfaceHover },
                    ]}
                  >
                    <Glyph color={c.text} size={20} />
                  </View>
                  <View style={s.rowText}>
                    <Text style={[s.rowLabel, { color: c.text }]}>
                      {opt.label}
                    </Text>
                    <Text
                      style={[s.rowDesc, { color: c.textMuted }]}
                      numberOfLines={2}
                    >
                      {opt.description}
                    </Text>
                  </View>
                  {selected ? (
                    <View
                      style={[s.checkBubble, { backgroundColor: tone }]}
                    >
                      <Text style={[s.checkText, { color: c.onColor }]}>
                        ✓
                      </Text>
                    </View>
                  ) : (
                    <View style={s.checkPlaceholder} />
                  )}
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
    paddingBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 24,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
  },
  glyphWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: radius.md,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  rowDesc: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  checkBubble: {
    width: 22,
    height: 22,
    borderCurve: "continuous",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  checkPlaceholder: {
    width: 22,
    height: 22,
  },
  checkText: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 14,
  },
});
