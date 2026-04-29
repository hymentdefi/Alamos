import { useEffect, useRef } from "react";
import { Tabs, useRouter, useSegments } from "expo-router";
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
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

const ISLAND_HEIGHT = 64;
const ISLAND_SIDE_GAP = 16;
// Mini-fade DENTRO del backdrop, contado desde el top hacia abajo.
// El backdrop arranca exactamente en el top del nav (no se extiende
// arriba) — pero un edge perfecto se ve brusco. Esos primeros pixels
// hacen el alpha ramp transparente → opaco para que la transición
// sea suave en las franjas laterales (donde el blur es visible
// directamente, sin la pill encima).
const BACKDROP_TOP_FADE = 14;

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
  { name: "alamo",   href: "/(app)/alamo",   title: "Tu Álamo",path: tabPaths.alamo },
];

/**
 * Nav bar flotante glassmorphism con backdrop blur extendido.
 *
 * Layers (bottom to top):
 *   1. Backdrop blur — cubre desde BACKDROP_FADE_HEIGHT arriba del nav
 *      hasta el bottom del teléfono. Hace el efecto "el contenido
 *      detrás del nav está borroso". Tiene un fade-in suave en el
 *      borde superior (LinearGradient como mask) para que el inicio
 *      del blur no sea brusco.
 *   2. Floating island — la pill propia con su propio blur (más
 *      intenso) y los tab items adentro.
 *
 * Tab activa: pill verde brand atrás del icono+label que aparece con
 * fade al focusear.
 */
function FloatingTabBar() {
  const router = useRouter();
  const segments = useSegments();
  // El active index se deriva de los segments de Expo Router para que
  // cualquier navegación (botones internos, deep links, etc.) sincronice
  // la pill activa con la ruta real. Antes era state local y se
  // desincronizaba al navegar desde fuera del tab bar.
  const tabSegment = (segments[2] as string | undefined) ?? "index";
  const segIdx = TAB_ROUTES.findIndex((r) => r.name === tabSegment);
  const activeIndex = segIdx >= 0 ? segIdx : 0;
  const { mode, c } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === "dark";
  const bottomGap = Math.max(Platform.OS === "ios" ? 24 : 14, insets.bottom);

  const onPressTab = (route: TabRoute, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (index === activeIndex) return;
    router.navigate(route.href as never);
  };

  // Backdrop empieza EXACTAMENTE en el top del nav (no se extiende
  // por arriba) y baja hasta el bottom del teléfono.
  const totalBackdropHeight = ISLAND_HEIGHT + bottomGap;

  return (
    <View pointerEvents="box-none" style={styles.container}>
      {/* Layer 1: backdrop blur full-width. Arranca en el top del nav
          y cubre hasta el piso. El alpha mask hace un mini-fade en
          los primeros BACKDROP_TOP_FADE pixels (yendo hacia abajo)
          para que la transición no se vea como una línea horizontal
          dura — visible en las franjas laterales donde no hay pill
          tapando. */}
      <MaskedView
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: totalBackdropHeight,
        }}
        maskElement={
          <LinearGradient
            colors={["transparent", "black"]}
            locations={[0, BACKDROP_TOP_FADE / totalBackdropHeight]}
            style={{ flex: 1 }}
          />
        }
      >
        <BlurView
          tint={isDark ? "dark" : "light"}
          intensity={Platform.OS === "ios" ? 28 : 50}
          style={{
            flex: 1,
            // Tinte muy sutil para reforzar el efecto vidrio sin
            // tapar tanto el contenido detrás.
            backgroundColor: isDark
              ? "rgba(0, 0, 0, 0.20)"
              : "rgba(255, 255, 255, 0.25)",
          }}
        />
      </MaskedView>

      {/* Layer 2: floating island sobre el backdrop */}
      <View
        style={{
          position: "absolute",
          bottom: bottomGap,
          left: ISLAND_SIDE_GAP,
          right: ISLAND_SIDE_GAP,
        }}
      >
        <BlurView
          tint={isDark ? "dark" : "light"}
          intensity={Platform.OS === "ios" ? 60 : 90}
          style={[
            styles.island,
            {
              height: ISLAND_HEIGHT,
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
        screenOptions={{
          headerShown: false,
          // Slide direccional en X axis nativo de bottom-tabs v7. No es
          // un slide full-page como Stack, pero al menos hay movimiento.
          animation: "shift",
        }}
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
    paddingVertical: 7,
    gap: 3,
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
