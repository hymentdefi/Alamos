import { useState, useMemo } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { assets, categories, type Asset } from "../../lib/data/assets";
import AssetItem from "../../lib/components/AssetItem";

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = useMemo(() => {
    let list = assets;
    if (activeCategory !== "all") list = list.filter((a) => a.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.ticker.toLowerCase().includes(q));
    }
    return list;
  }, [search, activeCategory]);

  const openDetail = (asset: Asset) => {
    router.push({ pathname: "/(app)/detail", params: { ticker: asset.ticker } });
  };

  return (
    <View style={s.container}>
      <View style={[s.topNav, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Explorar</Text>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Buscar activos..."
          placeholderTextColor={colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContent}>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            style={[s.tab, activeCategory === c.id && s.tabActive]}
            onPress={() => setActiveCategory(c.id)}
          >
            <Text style={[s.tabText, activeCategory === c.id && s.tabTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Asset list */}
      <ScrollView contentContainerStyle={s.listContent}>
        {filtered.length > 0 ? (
          filtered.map((a) => (
            <AssetItem key={a.ticker} asset={a} onPress={openDetail} />
          ))
        ) : (
          <Text style={s.empty}>No se encontraron activos</Text>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },
  topNav: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface[0],
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text.primary },
  searchBox: {
    marginHorizontal: 20,
    marginBottom: 16,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  tabsScroll: { maxHeight: 44, marginBottom: 16 },
  tabsContent: { paddingHorizontal: 20, gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  tabTextActive: { color: colors.surface[0] },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: {
    textAlign: "center",
    paddingVertical: 40,
    color: colors.text.muted,
    fontSize: 14,
  },
});
