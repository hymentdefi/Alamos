import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, fontFamily, radius, spacing } from "../../../lib/theme";

interface NewsItem {
  id: string;
  category: "mercado" | "cedears" | "bonos" | "macro" | "fci";
  categoryLabel: string;
  source: string;
  time: string;
  title: string;
  summary: string;
  featured?: boolean;
}

const feed: NewsItem[] = [
  {
    id: "1",
    category: "mercado",
    categoryLabel: "Mercado",
    source: "Ámbito",
    time: "hace 1h",
    title: "Bonos en dólares suben fuerte y el riesgo país perfora los 750 pb",
    summary:
      "El Bonar 2030 avanzó más de 2% en la rueda. Inversores interpretan los datos de reservas como señal de recompra futura.",
    featured: true,
  },
  {
    id: "2",
    category: "cedears",
    categoryLabel: "CEDEARs",
    source: "Reuters",
    time: "hace 3h",
    title: "NVIDIA cierra en máximos históricos, NASDAQ arriba casi 2%",
    summary:
      "La expectativa por los resultados del próximo trimestre impulsó al sector tecnológico. Los CEDEARs locales replicaron la suba.",
  },
  {
    id: "3",
    category: "macro",
    categoryLabel: "Macro",
    source: "Clarín",
    time: "hace 5h",
    title: "La inflación de marzo se ubicaría por debajo del 3% según privados",
    summary:
      "Consultoras como Eco Go y Orlando Ferreres proyectan IPC entre 2,6% y 2,9%. Sería el menor registro desde diciembre.",
  },
  {
    id: "4",
    category: "bonos",
    categoryLabel: "Bonos",
    source: "El Cronista",
    time: "hace 8h",
    title: "Licitación del Tesoro: qué instrumentos ofrecen mejor rendimiento",
    summary:
      "LECAPs de corto plazo pagan entre 36% y 38% TNA. Analistas recomiendan diversificar con bonos CER en carteras conservadoras.",
  },
  {
    id: "5",
    category: "fci",
    categoryLabel: "Fondos",
    source: "iProfesional",
    time: "ayer",
    title: "Los fondos money market mantienen flujo positivo por cuarto mes",
    summary:
      "Los FCI de pesos líquidos superaron los $12 billones en patrimonio administrado. Siguen siendo el instrumento preferido para el ahorro de corto plazo.",
  },
  {
    id: "6",
    category: "mercado",
    categoryLabel: "Mercado",
    source: "La Nación",
    time: "ayer",
    title: "MERVAL en pesos vuelve a máximos con fuerte volumen",
    summary:
      "El índice líder subió 1,8% impulsado por bancos y energéticas. El volumen operado superó los $120.000 millones.",
  },
];

type Filter = "todas" | NewsItem["category"];

const filters: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "mercado", label: "Mercado" },
  { id: "cedears", label: "CEDEARs" },
  { id: "bonos", label: "Bonos" },
  { id: "fci", label: "Fondos" },
  { id: "macro", label: "Macro" },
];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [filter, setFilter] = useState<Filter>("todas");

  const visible = useMemo(
    () =>
      filter === "todas" ? feed : feed.filter((n) => n.category === filter),
    [filter],
  );

  const featured = visible.find((n) => n.featured);
  const rest = visible.filter((n) => !n.featured);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[s.title, { color: c.text }]}>Noticias</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterContent}
          style={s.filterRow}
        >
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[
                  s.filterPill,
                  {
                    backgroundColor: active ? c.ink : c.surfaceHover,
                    borderColor: active ? c.ink : c.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.filterLabel,
                    { color: active ? c.bg : c.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {featured ? (
          <Pressable
            style={[s.featuredCard, { backgroundColor: c.ink }]}
          >
            <View style={s.featuredBadges}>
              <View
                style={[
                  s.featuredTag,
                  { backgroundColor: "rgba(0,230,118,0.2)" },
                ]}
              >
                <Text style={[s.featuredTagText, { color: c.green }]}>
                  {featured.categoryLabel}
                </Text>
              </View>
              <Text style={[s.featuredMeta, { color: "rgba(250,250,247,0.6)" }]}>
                {featured.source} · {featured.time}
              </Text>
            </View>
            <Text style={[s.featuredTitle, { color: c.bg }]}>
              {featured.title}
            </Text>
            <Text
              style={[s.featuredSummary, { color: "rgba(250,250,247,0.72)" }]}
            >
              {featured.summary}
            </Text>
          </Pressable>
        ) : null}

        <View style={s.list}>
          {rest.map((n, i) => (
            <Pressable
              key={n.id}
              style={[
                s.item,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.border,
                },
              ]}
            >
              <View style={s.itemMeta}>
                <Text style={[s.itemCategory, { color: c.textSecondary }]}>
                  {n.categoryLabel.toUpperCase()}
                </Text>
                <Text style={[s.itemSource, { color: c.textMuted }]}>
                  {n.source} · {n.time}
                </Text>
              </View>
              <Text style={[s.itemTitle, { color: c.text }]}>{n.title}</Text>
              <Text style={[s.itemSummary, { color: c.textMuted }]}>
                {n.summary}
              </Text>
            </Pressable>
          ))}
        </View>

        {visible.length === 0 ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: c.text }]}>Sin novedades</Text>
            <Text style={[s.emptySub, { color: c.textMuted }]}>
              Cambiá de categoría para ver más.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    marginBottom: 16,
  },
  filterRow: {
    marginHorizontal: -20,
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  filterLabel: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  featuredCard: {
    marginHorizontal: 20,
    borderRadius: radius.xl,
    padding: 20,
    marginTop: 16,
  },
  featuredBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  featuredTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  featuredTagText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.2,
  },
  featuredMeta: {
    fontFamily: fontFamily[500],
    fontSize: 12,
  },
  featuredTitle: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  featuredSummary: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  list: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
  item: {
    paddingVertical: spacing.lg,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  itemCategory: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 1,
  },
  itemSource: {
    fontFamily: fontFamily[500],
    fontSize: 11,
  },
  itemTitle: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  itemSummary: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: fontFamily[500],
    fontSize: 14,
  },
});
