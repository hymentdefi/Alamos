import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user } = useAuth();

  const rows: {
    group: string;
    items: { label: string; value: string; locked?: boolean }[];
  }[] = [
    {
      group: "Datos personales",
      items: [
        { label: "Nombre completo", value: user?.fullName ?? "Martín García", locked: true },
        { label: "DNI", value: "40.•••.•••", locked: true },
        { label: "CUIL", value: "20-••••••••-9", locked: true },
        { label: "Fecha de nacimiento", value: "03/1996", locked: true },
      ],
    },
    {
      group: "Contacto",
      items: [
        { label: "Email", value: user?.email ?? "martin@alamos.capital" },
        { label: "Teléfono", value: "+54 9 11 ••••-4523" },
      ],
    },
    {
      group: "Domicilio",
      items: [
        { label: "Dirección", value: "Av. Santa Fe 1234, piso 5" },
        { label: "Ciudad", value: "CABA" },
        { label: "Código postal", value: "C1059" },
      ],
    },
    {
      group: "Situación tributaria",
      items: [
        { label: "Condición AFIP", value: "Monotributista", locked: true },
        { label: "Categoría", value: "B", locked: true },
      ],
    },
  ];

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Datos personales</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            s.kycCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={s.kycHead}>
            <View style={[s.kycIcon, { backgroundColor: c.greenDim }]}>
              <Feather name="check" size={16} color={c.greenDark} />
            </View>
            <Text style={[s.kycLabel, { color: c.text }]}>
              Identidad verificada
            </Text>
          </View>
          <Text style={[s.kycText, { color: c.textMuted }]}>
            Los campos marcados con{" "}
            <Feather name="lock" size={11} color={c.textMuted} /> se sincronizan
            con AFIP y no se pueden editar. Si necesitás cambiar algo, escribinos.
          </Text>
        </View>

        {rows.map((group) => (
          <View key={group.group} style={s.groupBlock}>
            <Text style={[s.eyebrow, { color: c.textMuted }]}>
              {group.group.toUpperCase()}
            </Text>
            <View
              style={[
                s.groupCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              {group.items.map((item, i) => (
                <View
                  key={item.label}
                  style={[
                    s.fieldRow,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fieldLabel, { color: c.textMuted }]}>
                      {item.label}
                    </Text>
                    <Text style={[s.fieldValue, { color: c.text }]}>
                      {item.value}
                    </Text>
                  </View>
                  {item.locked ? (
                    <Feather name="lock" size={14} color={c.textFaint} />
                  ) : (
                    <Pressable hitSlop={8}>
                      <Feather name="edit-2" size={14} color={c.text} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  kycCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  kycHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  kycIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  kycLabel: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  kycText: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  groupBlock: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  groupCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: spacing.md + 2,
    gap: 12,
  },
  fieldLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  fieldValue: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
