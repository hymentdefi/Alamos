import { useEffect, useRef, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

const ISLAND_HEIGHT = 68;
const ISLAND_SIDE_GAP = 16;

const ACTIVE_COLOR = "#5ac43e";

type TabRoute = {
  name: string;
  href: string;
  title: string;
  path: (typeof tabPaths)[keyof typeof tabPaths];
};

const TAB_ROUTES: TabRoute[] = [
  { name: "index",   href: "/(app)/",        title: "Inicio",  path: tabPaths.home },
  { name: "explore", href: "/(app)/explore", title: "Mercado", path: tabPaths.markets },
  { name: "news",    href: "/(app)/news",    title: "Noticias",path: tabPaths.news },
  { name: "alamo",   href: "/(app)/alamo",   title: "Tu Alamo",path: tabPaths.alamo },
];

/**
 * Nav bar flotante estilo glassmorphism (inspirada en Naranja X).
 *
 * - Base: <BlurView> para el efecto vidrio real — deja pasar el
 *   contenido de atrás difuminado. Sin backdrop sólido debajo: la
 *   isla flota encima del contenido.
 * - Tab activa: rounded pill semi-opaco detrás del icono+label, que
 *   aparece con fade/scale al focusear. Ese es el "menos translúcido
 *   en la sección activa".
 * - Sin marker verde arriba del icono (el pill lo reemplaza).
 */
function FloatingTabBar() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const { mode, c } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === "dark";
  const bottomGap = Math.max(Platform.OS === "ios" ? 24 : 14, insets.bottom);

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
        { bottom: bottomGap, left: ISLAND_SIDE_GAP, right: ISLAND_SIDE_GAP },
      ]}
    >
      <BlurView
        tint={isDark ? "dark" : "light"}
        intensity={Platform.OS === "ios" ? 60 : 90}
        style={[
          styles.island,
          {
            height: ISLAND_HEIGHT,
            // Con bg blanco puro (light) o negro puro (dark) el glass
            // necesita un tinte que lo distinga del bg. Blanco-sobre-
            // blanco y negro-sobre-negro desaparecen.
            backgroundColor: isDark
              ? "rgba(18, 18, 18, 0.70)"
              : "rgba(250, 250, 250, 0.78)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.06)",
          },
        ]}
      >
        {TAB_ROUTES.map((route, index) => {
          const focused = index === activeIndex;
          return (
            <TabItem
              key={route.name}
              route={route}
              focused={focused}
              isDark={isDark}
              inactiveColor={c.textSecondary}
              onPress={() => onPressTab(route, index)}
            />
          );
        })}
      </BlurView>
    </View>
  );
}

interface TabItemProps {
  route: TabRoute;
  focused: boolean;
  isDark: boolean;
  inactiveColor: string;
  onPress: () => void;
}

function TabItem({ route, focused, isDark, inactiveColor, onPress }: TabItemProps) {
  // pillOpacity: 0 inactivo, 1 activo. Drivea el highlight detrás del
  // icono+label (el "menos translúcido" de Naranja X).
  const pillOpacity = useRef(
    new Animated.Value(focused ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(pillOpacity, {
      toValue: focused ? 1 : 0,
      duration: focused ? 260 : 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [focused, pillOpacity]);

  const color = focused ? ACTIVE_COLOR : inactiveColor;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={route.title}
      onPress={onPress}
      style={styles.tabItem}
      hitSlop={6}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.activePill,
          {
            opacity: pillOpacity,
            // Tinte verde brand en la pill activa — sobre glass neutra
            // el verde firma "este es el tab activo" on-brand. En
            // trading apps es más informativo que un blanco más
            // opaco (white-on-white no lee).
            backgroundColor: isDark
              ? "rgba(14, 203, 129, 0.14)"
              : "rgba(0, 200, 5, 0.10)",
            borderColor: isDark
              ? "rgba(14, 203, 129, 0.20)"
              : "rgba(0, 200, 5, 0.16)",
          },
        ]}
      />
      <DrawingIcon path={route.path} focused={focused} color={color} />
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {route.title}
      </Text>
    </Pressable>
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
  },
  island: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    // overflow:"hidden" es clave con BlurView — sin esto los bordes
    // redondeados del blur se recortan cuadrados en Android.
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 14,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
  },
  activePill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 6,
    right: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.15,
  },
});
