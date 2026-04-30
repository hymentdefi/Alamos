import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { fontFamily, radius, useTheme } from "../theme";

interface Props {
  visible: boolean;
  /** Si el chart considera ingresos/egresos al calcular la curva. */
  considerCashflow: boolean;
  onChangeConsiderCashflow: (next: boolean) => void;
  onClose: () => void;
}

/**
 * Bottom sheet con preferencias del chart del Inicio. Por ahora una
 * sola opción — si la curva refleja movimientos de dinero
 * (ingresos/egresos) o solo el rendimiento puro de los activos.
 */
export function ChartSettingsSheet({
  visible,
  considerCashflow,
  onChangeConsiderCashflow,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

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
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={s.grabber}>
          <View style={[s.grabberPill, { backgroundColor: c.borderStrong }]} />
        </View>

        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: c.text }]}>Ajustes del chart</Text>
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              Cómo se calcula la curva de tu portfolio.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={[s.closeBtn, { backgroundColor: c.surfaceHover }]}
          >
            <Feather name="x" size={16} color={c.text} />
          </Pressable>
        </View>

        {/* Toggle: considerar movimientos. */}
        <View
          style={[
            s.row,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[s.rowLabel, { color: c.text }]}>
              Considerar movimientos de dinero
            </Text>
            <Text style={[s.rowDesc, { color: c.textMuted }]}>
              Si está activo, los ingresos y egresos suben o bajan la
              curva. Si lo desactivás, solo se ve el rendimiento puro
              de los activos.
            </Text>
          </View>
          <Switch
            value={considerCashflow}
            onValueChange={onChangeConsiderCashflow}
            trackColor={{ false: c.surfaceSunken, true: c.action }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={c.surfaceSunken}
          />
        </View>
      </View>
    </Modal>
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
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 4,
    marginBottom: 18,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowLabel: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  rowDesc: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.05,
  },
});
