import { useRouter, useSegments } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily } from "../theme";
import { DrawingIcon, tabPaths } from "./DrawingIcon";
import { dispatchActiveTabTap } from "../tabs/activeTap";

const BAR_CONTENT_HEIGHT = 68;
/* Verde brand canónico — el tab activo lleva la identidad
 * Alamos (#00C805 idéntico en light + dark). Antes usábamos
 * #5ac43e (data green) acá; lo reemplazamos por brand para que
 * el tab bar matche el isotipo del logo. */
const ACTIVE_COLOR = "#00C805";

type TabRoute = {
  name: string;
  href: string;
  title: string;
  path: (typeof tabPaths)[keyof typeof tabPaths];
};

const TAB_ROUTES: TabRoute[] = [
  { name: "index",     href: "/(app)/",          title: "Inicio",    path: tabPaths.home },
  { name: "explore",   href: "/(app)/explore",   title: "Invertir",  path: tabPaths.markets },
  { name: "portfolio", href: "/(app)/portfolio", title: "Portfolio", path: tabPaths.portfolio },
  { name: "tarjeta",   href: "/(app)/tarjeta",   title: "Tarjeta",   path: tabPaths.tarjeta },
  { name: "news",      href: "/(app)/news",      title: "Noticias",  path: tabPaths.news },
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
 * hairline arriba, safe-area inset adentro. El tab activo se distingue
 * solo por color (action green) y por el pop-scale del icono — sin
 * pill de fondo. Diseño minimal, álamos-styled.
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
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  const onPressTab = (route: TabRoute, index: number) => {
    Haptics.selectionAsync().catch(() => {});
    if (index === activeIndex) {
      /* Tap on the already-active tab → delega al handler registrado
       * por la screen (scroll-to-top si no está arriba; refresh si ya
       * está). Patrón estándar de las apps mobile (Instagram, X). */
      dispatchActiveTabTap(route.name);
      return;
    }
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
      <View style={[styles.row, { height: BAR_CONTENT_HEIGHT }]}>
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
      <DrawingIcon
        path={route.path}
        focused={focused}
        color={color}
        size={28}
      />
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
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    gap: 3,
  },
  /* fontSize 11 (era 12) — con 5 tabs el ancho por slot cae a ~72 px
   * en pantallas chicas (iPhone SE), y "Portfolio" / "Noticias" se
   * cortaban a 12. */
  label: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.15,
  },
});
