import {
  View, Text, Pressable, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
        </Pressable>
      </View>

      {/* ── Support section ── */}
      <Text style={s.sectionTitle}>Soporte Álamos</Text>

      <Pressable style={s.row}>
        <Text style={s.rowLabel}>Centro de ayuda</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      <Pressable style={s.row}>
        <Text style={s.rowLabel}>Contactanos 24/7</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      <Pressable style={s.row}>
        <Text style={s.rowLabel}>Tus chats de soporte</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      {/* ── Disclosures section ── */}
      <Text style={[s.sectionTitle, { marginTop: 32 }]}>Divulgaciones</Text>

      <Pressable style={s.row}>
        <Text style={s.rowLabel}>Términos de Álamos</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      <Pressable style={s.row}>
        <Text style={s.rowLabel}>Privacidad</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      <Pressable style={s.row}>
        <Text style={s.rowLabel}>Resumen de relación con el cliente</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      <Pressable style={s.row} onPress={() => router.push("/(app)/about")}>
        <Text style={s.rowLabel}>Licencias</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </Pressable>

      {/* Version */}
      <Text style={s.version}>Versión v2026.4.1 (54001)</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.primary,
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "400",
    color: colors.text.primary,
  },

  version: {
    fontSize: 13,
    color: colors.text.muted,
    paddingHorizontal: 20,
    marginTop: 20,
  },
});
