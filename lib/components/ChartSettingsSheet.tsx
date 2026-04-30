import { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
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
import { MiniSparkline, seriesFromSeed } from "./Sparkline";
import { ChartSettingsIllustration } from "./illustrations/ChartSettingsIllustration";

interface Props {
  visible: boolean;
  /** Si el chart considera ingresos/egresos al calcular la curva. */
  considerCashflow: boolean;
  onChangeConsiderCashflow: (next: boolean) => void;
  /** Privacy mode — oculta los montos del home con `••••.•••`. */
  hideAmounts: boolean;
  onChangeHideAmounts: (next: boolean) => void;
  /** Línea de referencia horizontal en el inicio del periodo. */
  referenceLine: boolean;
  onChangeReferenceLine: (next: boolean) => void;
  /** Suavizado del trazo del chart (smooth bezier vs stepped). */
  smoothChart: boolean;
  onChangeSmoothChart: (next: boolean) => void;
  onClose: () => void;
}

// Threshold para considerar el swipe como dismiss.
const DISMISS_TRANSLATE = 110;
const DISMISS_VELOCITY = 600;

/**
 * Sheet de ajustes del chart — sin botones de cerrar. Se cierra
 * deslizando hacia abajo (swipe gesture en el sheet entero, smooth
 * con reanimated en UI thread).
 */
export function ChartSettingsSheet({
  visible,
  considerCashflow,
  onChangeConsiderCashflow,
  hideAmounts,
  onChangeHideAmounts,
  referenceLine,
  onChangeReferenceLine,
  smoothChart,
  onChangeSmoothChart,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();

  // translateY del sheet — empieza fuera de pantalla y entra animado
  // cuando visible=true. El usuario también lo arrastra con el pan.
  const translateY = useSharedValue(windowH);
  // Backdrop opacity — fadea con el progreso del sheet.
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
    // No animamos al cerrar acá — el cierre lo dispara el dismiss().
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
      // Sólo permitimos arrastrar hacia abajo (translationY positivo).
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        // Backdrop opacity se atenúa con el progreso del drag.
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
        // Snap back — vuelve a su posición.
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

  const selectCashflow = (next: boolean) => {
    if (next === considerCashflow) return;
    Haptics.selectionAsync().catch(() => {});
    onChangeConsiderCashflow(next);
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
              paddingBottom: insets.bottom + 18,
            },
            sheetStyle,
          ]}
        >
          {/* Grabber — visualmente sugiere "deslizable hacia abajo". */}
          <View style={s.grabber}>
            <View
              style={[s.grabberPill, { backgroundColor: c.borderStrong }]}
            />
          </View>

          {/* Hero — ilustración on-brand + título display. Sin
              subtítulo: el título lo dice todo. */}
          <View style={s.hero}>
            <ChartSettingsIllustration size={200} />
            <Text style={[s.title, { color: c.text }]}>
              Ajustes del chart
            </Text>
          </View>

          {/* Eyebrow + cards visuales del setting principal. */}
          <Text style={[s.eyebrow, { color: c.textMuted }]}>
            MOVIMIENTOS DE DINERO
          </Text>
          <View style={s.cardsRow}>
            <OptionCard
              selected={considerCashflow}
              onPress={() => selectCashflow(true)}
              label="Considerar"
              description="Sube cuando ingresás · Baja cuando egresás"
              previewSeed="cashflow-on"
              previewTrend="up"
            />
            <OptionCard
              selected={!considerCashflow}
              onPress={() => selectCashflow(false)}
              label="Ignorar"
              description="Solo el rendimiento puro de los activos"
              previewSeed="cashflow-off"
              previewTrend="flat"
            />
          </View>

          {/* Toggles compactos — el resto de los settings. */}
          <Text style={[s.eyebrow, { color: c.textMuted, marginTop: 18 }]}>
            PREFERENCIAS
          </Text>
          <View
            style={[
              s.toggleList,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <ToggleRow
              label="Modo privacidad"
              description="Oculta los montos como ••••"
              value={hideAmounts}
              onChange={onChangeHideAmounts}
              divider
            />
            <ToggleRow
              label="Línea de referencia"
              description="Horizontal al inicio del periodo"
              value={referenceLine}
              onChange={onChangeReferenceLine}
              divider
            />
            <ToggleRow
              label="Suavizar el trazo"
              description="Curva continua en vez de líneas filosas"
              value={smoothChart}
              onChange={onChangeSmoothChart}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

function OptionCard({
  selected,
  onPress,
  label,
  description,
  previewSeed,
  previewTrend,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  description: string;
  previewSeed: string;
  previewTrend: "up" | "flat";
}) {
  const { c } = useTheme();
  const accent = c.action;
  const series = seriesFromSeed(previewSeed, 24, previewTrend);

  return (
    <Pressable
      onPress={onPress}
      style={[
        cs.card,
        {
          backgroundColor: c.surface,
          borderColor: selected ? accent : c.border,
          borderWidth: selected ? 1.6 : 1,
        },
      ]}
    >
      <View style={cs.previewWrap}>
        <MiniSparkline
          series={series}
          color={selected ? accent : c.textFaint}
          width={120}
          height={48}
          strokeWidth={2.4}
        />
      </View>
      <View style={cs.labelRow}>
        <Text
          style={[
            cs.label,
            { color: selected ? c.text : c.textSecondary },
          ]}
        >
          {label}
        </Text>
        {selected ? (
          <View style={[cs.checkBubble, { backgroundColor: accent }]}>
            <Text style={cs.checkText}>✓</Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[
          cs.description,
          { color: selected ? c.textMuted : c.textFaint },
        ]}
        numberOfLines={2}
      >
        {description}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  divider,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
  divider?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        ts.row,
        divider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[ts.label, { color: c.text }]}>{label}</Text>
        <Text style={[ts.description, { color: c.textMuted }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          Haptics.selectionAsync().catch(() => {});
          onChange(next);
        }}
        trackColor={{ false: c.surfaceSunken, true: c.action }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={c.surfaceSunken}
      />
    </View>
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
    borderRadius: 2,
  },
  hero: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 18,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 24,
    letterSpacing: -0.7,
    marginTop: 6,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.3,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleList: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
});

const cs = StyleSheet.create({
  card: {
    flex: 1,
    padding: 14,
    borderRadius: radius.lg,
  },
  previewWrap: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
  },
  checkBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 13,
  },
  description: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: -0.05,
  },
});

const ts = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  description: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.05,
  },
});
