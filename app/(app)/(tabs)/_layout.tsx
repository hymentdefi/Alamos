import { Tabs, usePathname, useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

// Geometría del nav bar flotante.
const ISLAND_HEIGHT = 66;
const ISLAND_SIDE_GAP = 28;
const ISLAND_TOP_GAP = 28;
const BACKDROP_FADE = 28;

const ACTIVE_COLOR = "#5ac43e";

type TabRoute = {
  /** Pathname que devuelve usePathname() cuando esta tab está activa. */
  pathname: string;
  /** Ruta para navegar via router.navigate(). En expo-router, mismo
   *  que pathname. */
  href: string;
  title: string;
  path: (typeof tabPaths)[keyof typeof tabPaths];
};

// Los grupos `(app)` y `(tabs)` son segmentos "silenciosos" en
// expo-router — no aparecen en el pathname. Así que `index.tsx` es "/"
// y los demás usan su nombre directo.
const TAB_ROUTES: TabRoute[] = [
  { pathname: "/", href: "/", title: "Inicio", path: tabPaths.home },
  {
    pathname: "/explore",
    href: "/explore",
    title: "Mercado",
    path: tabPaths.markets,
  },
  {
    pathname: "/news",
    href: "/news",
    title: "Noticias",
    path: tabPaths.news,
  },
  {
    pathname: "/alamo",
    href: "/alamo",
    title: "Tu Alamo",
    path: tabPaths.alamo,
  },
];

/**
 * Nav bar flotante. Vive como SIBLING de <Tabs>, no como su tabBar.
 *
 * Historia: nada de lo que intentamos a través del pipeline de
 * @react-navigation/bottom-tabs funcionó. El último intento
 * (tabBar={} prop con state/descriptors/navigation) tampoco, por
 * motivos que no llegamos a diagnosticar del todo — probablemente el
 * wrapper de bottom-tabs en expo-router mete algo en el medio que
 * rompe la propagación de focused aunque lo calculemos nosotros.
 *
 * Solución: sacar la barra ENTERA del árbol de <Tabs>. <Tabs> sigue
 * ahí para manejar navegación y preservar el estado de cada pantalla
 * (las 4 quedan montadas), pero pasamos tabBar={() => null} para que
 * no renderice nada visible. El FloatingTabBar se renderiza como
 * hermano, consume el pathname global de expo-router con
 * usePathname() — un hook React normal que triggerea re-render cuando
 * la ruta cambia — y navega con router.navigate().
 *
 * No hay intermediarios: pathname cambia → FloatingTabBar re-renderiza
 * → DrawingIcon recibe focused nuevo → Reanimated anima.
 */
function FloatingTabBar() {
  const pathname = usePathname();
  const router = useRouter();
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
        style={[
          styles.backdrop,
          { top: ISLAND_TOP_GAP, backgroundColor: backdropBg },
        ]}
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
        {TAB_ROUTES.map((route) => {
          const focused = pathname === route.pathname;
          const color = focused ? ACTIVE_COLOR : c.textSecondary;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            if (!focused) {
              router.navigate(route.href);
            }
          };

          return (
            <Pressable
              key={route.pathname}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={route.title}
              onPress={onPress}
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
