import { useEffect, useRef } from "react";
import { useRouter, useSegments } from "expo-router";
import {
  Animated,
  Dimensions,
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

// Importamos cada tab como componente directo. Esto bypassa el
// `<Tabs>` de expo-router (que sólo monta una a la vez sin slide
// horizontal) y nos permite renderizar las 4 simultáneas en un
// horizontal Animated.View para hacer el slide smooth full-screen.
// Trade-off: `useIsFocused` y el evento `tabPress` ya no funcionan
// en los screens (las 4 están "focuseadas" siempre). Las animaciones
// internas siguen corriendo en las 4 — perf cost menor en devices
// modernos.
import IndexScreen from "./index";
import ExploreScreen from "./explore";
import NewsScreen from "./news";
import AlamoScreen from "./alamo";

const { width: SCREEN_W } = Dimensions.get("window");

const ISLAND_HEIGHT = 68;
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
  Component: React.ComponentType;
};

const TAB_ROUTES: TabRoute[] = [
  { name: "index",   href: "/(app)/",        title: "Inicio",  path: tabPaths.home,    Component: IndexScreen },
  { name: "explore", href: "/(app)/explore", title: "Mercado", path: tabPaths.markets, Component: ExploreScreen },
  { name: "news",    href: "/(app)/news",    title: "Noticias",path: tabPaths.news,    Component: NewsScreen },
  { name: "alamo",   href: "/(app)/alamo",   title: "Tu Alamo",path: tabPaths.alamo,   Component: AlamoScreen },
];

/**
 * Pager horizontal que monta las 4 tabs y desliza entre ellas.
 *
 * `activeIndex` se deriva de `useSegments()` — cualquier navegación
 * (tap en pill, deep link, router.navigate desde un botón) actualiza
 * la URL primero y el pager reacciona animando el translateX.
 *
 * Duración 320ms con ease-out cubic — se siente smooth y rápido sin
 * ser brusco.
 */
function TabPager() {
  const segments = useSegments();
  const tabSegment = (segments[2] as string | undefined) ?? "index";
  const segIdx = TAB_ROUTES.findIndex((r) => r.name === tabSegment);
  const activeIndex = segIdx >= 0 ? segIdx : 0;

  const translateX = useRef(
    new Animated.Value(-activeIndex * SCREEN_W),
  ).current;
  const lastIndexRef = useRef(activeIndex);

  useEffect(() => {
    if (lastIndexRef.current === activeIndex) return;
    lastIndexRef.current = activeIndex;
    Animated.timing(translateX, {
      toValue: -activeIndex * SCREEN_W,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, translateX]);

  return (
    <Animated.View
      style={[
        styles.pager,
        {
          width: SCREEN_W * TAB_ROUTES.length,
          transform: [{ translateX }],
        },
      ]}
    >
      {TAB_ROUTES.map((r) => {
        const Comp = r.Component;
        return (
          <View key={r.name} style={styles.page}>
            <Comp />
          </View>
        );
      })}
    </Animated.View>
  );
}

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
      <TabPager />
      <FloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: {
    flex: 1,
    flexDirection: "row",
  },
  page: {
    width: SCREEN_W,
    flex: 1,
  },
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
