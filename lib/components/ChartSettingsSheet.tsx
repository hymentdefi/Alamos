import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../theme";
import { GearIcon } from "./GearIcon";
import { MiniSparkline, seriesFromSeed } from "./Sparkline";

interface Props {
  visible: boolean;
  /** Si el chart considera ingresos/egresos al calcular la curva. */
  considerCashflow: boolean;
  onChangeConsiderCashflow: (next: boolean) => void;
  onClose: () => void;
}

/**
 * Sheet de ajustes del chart — formato visual interactivo en vez de
 * un toggle plano. Cada opción es una card con su preview de cómo se
 * vería el chart, el user tappea la que quiere y la card seleccionada
 * queda con accent verde brand. Más entretenido y claro que un Switch
 * binario.
 */
export function ChartSettingsSheet({
  visible,
  considerCashflow,
  onChangeConsiderCashflow,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const select = (next: boolean) => {
    if (next === considerCashflow) return;
    Haptics.selectionAsync().catch(() => {});
    onChangeConsiderCashflow(next);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose} />
      <View
        style={[
          s.sheet,
          {
            backgroundColor: c.bg,
            borderColor: c.border,
            paddingBottom: insets.bottom + 18,
          },
        ]}
      >
        {/* Grabber */}
        <View style={s.grabber}>
          <View style={[s.grabberPill, { backgroundColor: c.borderStrong }]} />
        </View>

        {/* Hero — gear icon verde brand grande dentro de un círculo
            pillow + título display + subtítulo. */}
        <View style={s.hero}>
          <View style={[s.gearWrap, { backgroundColor: c.brandDim }]}>
            <GearIcon size={28} color={c.action} />
          </View>
          <Text style={[s.title, { color: c.text }]}>Ajustes del chart</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>
            ¿Cómo querés ver tu portfolio?
          </Text>
        </View>

        {/* Eyebrow */}
        <Text style={[s.eyebrow, { color: c.textMuted }]}>
          MOVIMIENTOS DE DINERO
        </Text>

        {/* Dos cards lado a lado — cada una con preview, label y check
            si está seleccionada. Tappable. */}
        <View style={s.cardsRow}>
          <OptionCard
            selected={considerCashflow}
            onPress={() => select(true)}
            label="Considerar"
            description="Sube cuando ingresás · Baja cuando egresás"
            previewSeed="cashflow-on"
            previewTrend="up"
          />
          <OptionCard
            selected={!considerCashflow}
            onPress={() => select(false)}
            label="Ignorar"
            description="Solo el rendimiento puro de los activos"
            previewSeed="cashflow-off"
            previewTrend="flat"
          />
        </View>

        {/* CTA cerrar — el cambio aplica al instante, esto es para
            confirmar y volver. */}
        <Pressable
          onPress={onClose}
          style={[s.cta, { backgroundColor: c.text }]}
        >
          <Text style={[s.ctaText, { color: c.bg }]}>Listo</Text>
        </Pressable>
      </View>
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
      {/* Preview — sparkline del color accent cuando es la opción
          seleccionada, gris muted cuando no. Da un vistazo del
          comportamiento. */}
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
            <Feather name="check" size={11} color="#FFFFFF" />
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

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
    paddingTop: 12,
    paddingBottom: 22,
  },
  gearWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 24,
    letterSpacing: -0.7,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
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
    marginBottom: 18,
  },
  cta: {
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
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
  description: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: -0.05,
  },
});
