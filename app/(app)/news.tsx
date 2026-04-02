import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";

const mockNews = [
  {
    id: "1",
    source: "Bloomberg Línea",
    time: "Hace 2h",
    title: "El Merval alcanza máximos históricos impulsado por el sector energético",
  },
  {
    id: "2",
    source: "Ámbito Financiero",
    time: "Hace 3h",
    title: "El dólar CCL retrocede y se ubica por debajo de los $1.350",
  },
  {
    id: "3",
    source: "Infobae",
    time: "Hace 5h",
    title: "YPF reporta resultados trimestrales por encima de las expectativas del mercado",
  },
  {
    id: "4",
    source: "Reuters",
    time: "Hace 6h",
    title: "Apple presenta nuevos productos y sus acciones suben en el pre-market",
  },
  {
    id: "5",
    source: "El Cronista",
    time: "Hace 8h",
    title: "Los bonos soberanos argentinos extienden su rally con rendimientos en baja",
  },
  {
    id: "6",
    source: "Bloomberg Línea",
    time: "Hace 10h",
    title: "Pampa Energía anuncia plan de inversión de USD 500M para los próximos 3 años",
  },
];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      <View style={[s.topNav, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Noticias</Text>
      </View>
      <ScrollView contentContainerStyle={s.list}>
        {mockNews.map((item) => (
          <View key={item.id} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.source}>{item.source}</Text>
              <Text style={s.time}>{item.time}</Text>
            </View>
            <Text style={s.headline}>{item.title}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  topNav: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text.primary },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  card: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  source: { fontSize: 12, fontWeight: "600", color: colors.brand[500] },
  time: { fontSize: 11, color: colors.text.muted },
  headline: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    lineHeight: 21,
  },
});
