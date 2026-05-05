import { useEffect, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../theme";
import { DrawingIcon, tabPaths } from "./DrawingIcon";

const { width: SCREEN_W } = Dimensions.get("window");
void SCREEN_W;

export const ISLAND_HEIGHT = 64;
export const ISLAND_SIDE_GAP = 16;
const BACKDROP_TOP_FADE = 14;
const ACTIVE_COLOR = "#5ac43e";
const PILL_INSET_X = 4;
const PILL_INSET_Y = 6;

type TabRoute = {
  name: string;
  href: string;
  title: string;
  path: (typeof tabPaths)[keyof typeof tabPaths];
};

const TAB_ROUTES: TabRoute[] = [
  { name: "index",     href: "/(app)/",          title: "Inicio",    path: tabPaths.home },
  { name: "explore",   href: "/(app)/explore",   title: "Mercado",   path: tabPaths.markets },
  { name: "portfolio", href: "/(app)/portfolio", title: "Portfolio", path: tabPaths.portfolio },
  { name: "news",      href: "/(app)/news",      title: "Noticias",  path: tabPaths.news },
  { name: "alamo",     href: "/(app)/alamo",     title: "Tu Álamo",  path: tabPaths.alamo },
];

/**
 * Helper para calcular la altura visible del nav bar — útil cuando
 * un screen no-tab quiere reservar espacio en su scroll/bottomBar
 * para no quedar tapado por la pill flotante.
 */
export function useFloatingTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  const bottomGap = Math.max(Platform.OS === "ios" ? 24 : 14, insets.bottom);
  return ISLAND_HEIGHT + bottomGap;
}

interface Props {
  /**
   * Tab "contextual" para resaltar cuando el FloatingTabBar se
   * monta fuera del (tabs) layout (ej: detail, market-category).
   * Como segments[2] no devuelve nombre de tab en esos casos, el
   * segmento se cae al default — sin override, siempre se prendía
   * Inicio. Acá indicamos cuál tab "originó" el flow para que el
   * pill marque la procedencia (ej: 'explore' para market-category
   * y detail, que casi siempre vienen desde Mercado).
   */
  contextTab?: string;
}

/**
 * Nav bar flotante glassmorphism con backdrop blur extendido.
 *
 * Diseño preservado del (tabs)/_layout original:
 *
 *   1. Backdrop blur — cubre desde el top del nav hasta el bottom
 *      del teléfono. Mini-fade en el borde superior (LinearGradient
 *      como mask) para que el inicio del blur no sea brusco.
 *   2. Floating island — la pill propia con su propio blur (más
 *      intenso) y los tab items adentro.
 *   3. Sliding pill — un único elemento que se desliza entre tabs
 *      (estilo Zoho Mail), con squash & stretch en X/Y durante el
 *      viaje para feel rubber-band.
 *
 * Reusable en cualquier screen — basta con renderearlo como sibling
 * del contenido principal. El navigate usa router.navigate(href) que
 * pop-pea el Stack y vuelve a la tab destino si estás en un screen
 * fuera del (tabs).
 */
export function FloatingTabBar({ contextTab }: Props = {}) {
  const router = useRouter();
  const segments = useSegments();
  const tabSegment =
    ((segments as readonly string[])[2] as string | undefined) ??
    contextTab ??
    "index";
  const segIdx = TAB_ROUTES.findIndex((r) => r.name === tabSegment);
  const activeIndex = segIdx >= 0 ? segIdx : 0;
  const { mode, c } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === "dark";
  const bottomGap = Math.max(Platform.OS === "ios" ? 24 : 14, insets.bottom);

  const [islandWidth, setIslandWidth] = useState(0);

  const pillIndex = useSharedValue(activeIndex);
  const pillScaleX = useSharedValue(1);
  const pillScaleY = useSharedValue(1);
  useEffect(() => {
    pillIndex.value = withTiming(activeIndex, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    pillScaleX.value = withSequence(
      withTiming(1.32, {
        duration: 110,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0.88, {
        duration: 90,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: 80,
        easing: Easing.out(Easing.quad),
      }),
    );
    pillScaleY.value = withSequence(
      withTiming(0.74, {
        duration: 110,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1.16, {
        duration: 90,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: 80,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [activeIndex, pillIndex, pillScaleX, pillScaleY]);

  const itemWidth =
    islandWidth > 0 ? (islandWidth - PILL_INSET_X * 2) / TAB_ROUTES.length : 0;

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: PILL_INSET_X + pillIndex.value * itemWidth },
      { scaleX: pillScaleX.value },
      { scaleY: pillScaleY.value },
    ],
    width: itemWidth,
  }));

  const onPressTab = (route: TabRoute, index: number) => {
    Haptics.selectionAsync().catch(() => {});
    if (index === activeIndex) return;
    router.navigate(route.href as never);
  };

  const totalBackdropHeight = ISLAND_HEIGHT + bottomGap;

  return (
    <View pointerEvents="box-none" style={styles.container}>
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
            backgroundColor: isDark
              ? "rgba(0, 0, 0, 0.20)"
              : "rgba(255, 255, 255, 0.25)",
          }}
        />
      </MaskedView>

      <View
        style={{
          position: "absolute",
          bottom: bottomGap,
          left: ISLAND_SIDE_GAP,
          right: ISLAND_SIDE_GAP,
        }}
        onLayout={(e) => setIslandWidth(e.nativeEvent.layout.width)}
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
          {itemWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.slidingPill,
                {
                  top: PILL_INSET_Y,
                  bottom: PILL_INSET_Y,
                  backgroundColor: isDark
                    ? "rgba(14, 203, 129, 0.14)"
                    : "rgba(0, 200, 5, 0.10)",
                  borderColor: isDark
                    ? "rgba(14, 203, 129, 0.20)"
                    : "rgba(0, 200, 5, 0.16)",
                },
                pillStyle,
              ]}
            />
          ) : null}

          {TAB_ROUTES.map((route, index) => {
            const focused = index === activeIndex;
            return (
              <TabItem
                key={route.name}
                route={route}
                focused={focused}
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
  inactiveColor: string;
  onPress: () => void;
}

function TabItem({ route, focused, inactiveColor, onPress }: TabItemProps) {
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
      <DrawingIcon path={route.path} focused={focused} color={color} />
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {route.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1,
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
  slidingPill: {
    position: "absolute",
    left: 0,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.15,
  },
});
