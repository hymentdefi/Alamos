import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme, type ThemeModePref } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface Option {
  value: ThemeModePref;
  label: string;
  hint?: string;
  icon: keyof typeof Feather.glyphMap;
}

const options: Option[] = [
  { value: "light", label: "Light mode", icon: "sun" },
  { value: "dark", label: "Dark mode", icon: "moon" },
  {
    value: "system",
    label: "Device settings",
    hint: "Seguí la configuración del celular",
    icon: "smartphone",
  },
];

export function AppearanceSheet({ visible, onClose }: Props) {
  const { c, pref, setPref } = useTheme();
  const insetsBottom = 32;
  const { height: screenH } = Dimensions.get("window");
  const translateY = useRef(new Animated.Value(screenH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenH,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity, screenH]);

  // Pan para arrastrar hacia abajo y cerrar.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.8) {
          onClose();
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 12,
          }).start();
        }
      },
    }),
  ).current;

  const select = (v: ThemeModePref) => {
    Haptics.selectionAsync().catch(() => {});
    setPref(v);
    // Pequeña pausa para que el usuario vea el cambio antes de cerrar.
    setTimeout(onClose, 180);
  };

  const sheetTx = Animated.add(translateY, dragY);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <Animated.View
          style={[
            s.backdrop,
            { opacity: backdropOpacity, backgroundColor: "rgba(0,0,0,0.44)" },
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            s.sheet,
            {
              backgroundColor: c.bg,
              paddingBottom: insetsBottom,
              transform: [{ translateY: sheetTx }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={s.handleWrap}>
            <View style={[s.handle, { backgroundColor: c.border }]} />
          </View>

          <Text style={[s.title, { color: c.text }]}>Apariencia</Text>

          {options.map((opt, i) => {
            const selected = pref === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => select(opt.value)}
                style={[
                  s.row,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.border,
                  },
                ]}
              >
                <View
                  style={[s.iconWrap, { backgroundColor: c.surfaceHover }]}
                >
                  <Feather name={opt.icon} size={16} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowLabel, { color: c.text }]}>
                    {opt.label}
                  </Text>
                  {opt.hint ? (
                    <Text style={[s.rowHint, { color: c.textMuted }]}>
                      {opt.hint}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    s.radio,
                    {
                      borderColor: selected ? c.greenDark : c.border,
                      backgroundColor: selected ? c.greenDark : "transparent",
                    },
                  ]}
                >
                  {selected ? (
                    <Feather name="check" size={14} color={c.bg} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: 6,
    marginBottom: 10,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
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
    letterSpacing: -0.05,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
