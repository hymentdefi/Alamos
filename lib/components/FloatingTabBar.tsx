import { useEffect, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import {
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
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../theme";
import { DrawingIcon, tabPaths } from "./DrawingIcon";

const BAR_CONTENT_HEIGHT = 60;
const ACTIVE_COLOR = "#5ac43e";
const PILL_INSET_X = 6;
const PILL_INSET_Y = 6;
const ROW_PADDING_X = 6;

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
 * Helper para reservar espacio al final del scroll en screens que
 * coexisten con el nav bar (ej: detail, market-category) — devuelve
 * altura del contenido + safe-area inset bottom.
 */
export function useFloatingTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return BAR_CONTENT_HEIGHT + insets.bottom;
}

interface Props {
  /**
   * Tab "contextual" para resaltar cuando el nav se monta fuera del
   * (tabs) layout (ej: detail, market-category). Como segments[2] no
   * devuelve nombre de tab en esos casos, sin override siempre se
   * prendía Inicio. Acá indicamos cuál tab "originó" el flow.
   */
  contextTab?: string;
}

/**
 * Bottom nav pegado al piso — edge-to-edge, fondo sólido del theme,
 * hairline arriba, safe-area inset adentro. Mantiene la sliding pill
 * animada para el tab activo (squash & stretch en el viaje).
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

  const [rowWidth, setRowWidth] = useState(0);

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
    rowWidth > 0 ? (rowWidth - ROW_PADDING_X * 2) / TAB_ROUTES.length : 0;

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ROW_PADDING_X + PILL_INSET_X + pillIndex.value * itemWidth },
      { scaleX: pillScaleX.value },
      { scaleY: pillScaleY.value },
    ],
    width: Math.max(0, itemWidth - PILL_INSET_X * 2),
  }));

  const onPressTab = (route: TabRoute, index: number) => {
    Haptics.selectionAsync().catch(() => {});
    if (index === activeIndex) return;
    router.navigate(route.href as never);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View
        style={[styles.row, { height: BAR_CONTENT_HEIGHT }]}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingHorizontal: ROW_PADDING_X,
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
    borderRadius: radius.lg,
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.15,
  },
});
