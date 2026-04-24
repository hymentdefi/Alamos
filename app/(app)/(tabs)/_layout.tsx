import { useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

const ISLAND_HEIGHT = 66;
const ISLAND_SIDE_GAP = 28;
const ISLAND_TOP_GAP = 28;
const BACKDROP_FADE = 28;

const ACTIVE_COLOR = "#5ac43e";

type TabRoute = {
  name: string;
  href: string;
  title: string;
  path: (typeof tabPaths)[keyof typeof tabPaths];
};

// Paths de navegación con el grupo `(app)/` prefijado — así navega el
// resto del código del proyecto (ver transfer.tsx, ProHome.tsx, etc).
const TAB_ROUTES: TabRoute[] = [
  { name: "index",   href: "/(app)/",        title: "Inicio",  path: tabPaths.home },
  { name: "explore", href: "/(app)/explore", title: "Mercado", path: tabPaths.markets },
  { name: "news",    href: "/(app)/news",    title: "Noticias",path: tabPaths.news },
  { name: "alamo",   href: "/(app)/alamo",   title: "Tu Alamo",path: tabPaths.alamo },
];

/**
 * Nav bar flotante. Vive como SIBLING de <Tabs>, no como su tabBar.
 *
 * Estado local (useState) maneja qué tab está visualmente activo. El
 * router se usa sólo para disparar la navegación efectiva; la UI no
 * depende de leer pathname/segments de expo-router (que tiene
 * comportamiento inconsistente con groups). Desacople total.
 */
function FloatingTabBar() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const { mode, c } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === "dark";
  const bottomGap = Math.max(Platform.OS === "ios" ? 24 : 14, insets.bottom);

  const backdropBg = isDark
    ? "rgba(18, 22, 27, 0.92)"
    : "rgba(250, 250, 247, 0.92)";
  const islandBg = isDark
    ? "rgba(28, 33, 40, 0.98)"
    : "rgba(255, 255, 255, 0.98)";
  const backdropBgTransparent = backdropBg.replace(/[\d.]+\)$/, "0)");

  const onPressTab = (route: TabRoute, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (index === activeIndex) return;
    setActiveIndex(index);
    router.navigate(route.href as never);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { height: ISLAND_TOP_GAP + ISLAND_HEIGHT + bottomGap },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[backdropBgTransparent, backdropBg]}
        style={styles.fadeGradient}
      />
      <View
        pointerEvents="none"
        style={[styles.backdrop, { top: ISLAND_TOP_GAP, backgroundColor: backdropBg }]}
      />
      <View
        style={[
          styles.island,
          {
            top: ISLAND_TOP_GAP,
            left: ISLAND_SIDE_GAP,
            right: ISLAND_SIDE_GAP,
            height: ISLAND_HEIGHT,
            backgroundColor: islandBg,
            borderColor: c.border,
          },
        ]}
      >
        {TAB_ROUTES.map((route, index) => {
          const focused = index === activeIndex;
          const color = focused ? ACTIVE_COLOR : c.textSecondary;
          return (
            <Pressable
              key={route.name}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={route.title}
              onPress={() => onPressTab(route, index)}
              style={styles.tabItem}
              hitSlop={8}
            >
              <DrawingIcon
                path={route.path}
                focused={focused}
                color={color}
              />
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {route.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        backBehavior="none"
        screenOptions={{ headerShown: false }}
        tabBar={() => null}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="news" />
        <Tabs.Screen name="alamo" />
      </Tabs>
      <FloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  fadeGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BACKDROP_FADE,
  },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  island: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.15,
    marginTop: 2,
  },
});
