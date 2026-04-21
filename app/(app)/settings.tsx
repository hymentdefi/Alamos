import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode, toggle } = useTheme();

  const [pushOrders, setPushOrders] = useState(true);
  const [pushPrices, setPushPrices] = useState(true);
  const [pushNews, setPushNews] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);

  const prefs = [
    {
      group: "Apariencia",
      items: [
        {
          type: "toggle" as const,
          icon: "moon",
          label: "Modo oscuro",
          hint: "Experimental · Alamos Pro",
          value: mode === "dark",
          onChange: () => toggle(),
        },
        {
          type: "value" as const,
          icon: "type",
          label: "Tamaño de texto",
          value: "Normal",
        },
      ],
    },
    {
      group: "Notificaciones",
      items: [
        {
          type: "toggle" as const,
          icon: "bell",
          label: "Órdenes y ejecuciones",
          value: pushOrders,
          onChange: setPushOrders,
        },
        {
          type: "toggle" as const,
          icon: "trending-up",
          label: "Alertas de precio",
          value: pushPrices,
          onChange: setPushPrices,
        },
        {
          type: "toggle" as const,
          icon: "file-text",
          label: "Novedades del mercado",
          value: pushNews,
          onChange: setPushNews,
        },
        {
          type: "toggle" as const,
          icon: "mail",
          label: "Emails de marketing",
          value: marketingEmails,
          onChange: setMarketingEmails,
        },
      ],
    },
    {
      group: "Experiencia",
      items: [
        {
          type: "toggle" as const,
          icon: "volume-2",
          label: "Sonidos y hápticos",
          value: soundEffects,
          onChange: setSoundEffects,
        },
        {
          type: "value" as const,
          icon: "globe",
          label: "Idioma",
          value: "Español (AR)",
        },
        {
          type: "value" as const,
          icon: "dollar-sign",
          label: "Moneda",
          value: "Pesos argentinos",
        },
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
        <Text style={[s.headerTitle, { color: c.text }]}>Preferencias</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {prefs.map((group) => (
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
                    s.row,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: c.border,
                    },
                  ]}
                >
                  <View style={[s.rowIcon, { backgroundColor: c.surfaceHover }]}>
                    <Feather
                      name={item.icon as keyof typeof Feather.glyphMap}
                      size={16}
                      color={c.text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowLabel, { color: c.text }]}>
                      {item.label}
                    </Text>
                    {"hint" in item && item.hint ? (
                      <Text style={[s.rowHint, { color: c.textMuted }]}>
                        {item.hint}
                      </Text>
                    ) : null}
                  </View>
                  {item.type === "toggle" ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onChange}
                      trackColor={{ false: c.surfaceSunken, true: c.ink }}
                      thumbColor={c.bg}
                      ios_backgroundColor={c.surfaceSunken}
                    />
                  ) : (
                    <View style={s.valueWrap}>
                      <Text style={[s.rowValue, { color: c.textMuted }]}>
                        {item.value}
                      </Text>
                      <Feather
                        name="chevron-right"
                        size={16}
                        color={c.textFaint}
                      />
                    </View>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: 14,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
    letterSpacing: -0.1,
  },
  valueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowValue: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.15,
  },
});
