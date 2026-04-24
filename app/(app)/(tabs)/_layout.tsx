import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
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

// Ruta (file-based) → TabPath del DrawingIcon.
const pathsByRoute: Record<string, (typeof tabPaths)[keyof typeof tabPaths]> = {
  index: tabPaths.home,
  explore: tabPaths.markets,
  news: tabPaths.news,
  alamo: tabPaths.alamo,
};

/**
 * TabBar custom. Renderizamos los tab items nosotros en vez de dejarle
 * el render a @react-navigation/bottom-tabs via tabBarIcon.
 *
 * Por qué custom: con tabBarIcon la animación del DrawingIcon se
 * congelaba después del primer mount — ni el useEffect de focused ni
 * los updates de Reanimated/SVG se propagaban al Path nativo. Probé 7
 * approaches distintos (Animated overlay, strokeDashoffset con 3 APIs
 * distintas, withSequence, force-remount con key, MaskedView) y todos
 * morían en el mismo síntoma. El denominador común era que el icon
 * vivía dentro del render pipeline de React Navigation.
 *
 * Moviendo el render a un componente que controlamos nosotros, el
 * árbol de React es vanilla: cuando state.index cambia, el TabBar
 * re-renderiza, cada DrawingIcon recibe el nuevo focused, useEffect
 * corre, Reanimated anima. Sin memoización oculta en el medio.
 */
function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
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
      style={[
        styles.container,
        { height: ISLAND_TOP_GAP + ISLAND_HEIGHT + bottomGap },
      ]}
    >
      {/* Fade gradient arriba — evita la línea divisoria entre
          contenido y nav bar. */}
      <LinearGradient
        pointerEvents="none"
        colors={[backdropBgTransparent, backdropBg]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: BACKDROP_FADE,
        }}
      />
      {/* Backdrop sólido desde donde arranca el island hasta el piso. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ISLAND_TOP_GAP,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: backdropBg,
        }}
      />
      {/* Island flotante con los tab items adentro. */}
      <View
        style={{
          position: "absolute",
          top: ISLAND_TOP_GAP,
          left: ISLAND_SIDE_GAP,
          right: ISLAND_SIDE_GAP,
          height: ISLAND_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          paddingHorizontal: 8,
          backgroundColor: islandBg,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: c.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.14,
          shadowRadius: 24,
          elevation: 16,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const tabPath = pathsByRoute[route.name];
          const color = focused ? ACTIVE_COLOR : c.textSecondary;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              style={styles.tabItem}
              hitSlop={8}
            >
              {tabPath ? (
                <DrawingIcon
                  key={`${route.name}-${focused}`}
                  path={tabPath}
                  focused={focused}
                  color={color}
                />
              ) : null}
              <Text
                numberOfLines={1}
                style={[styles.label, { color }]}
              >
                {label}
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
    <Tabs
      backBehavior="none"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="explore" options={{ title: "Mercado" }} />
      <Tabs.Screen name="news" options={{ title: "Noticias" }} />
      <Tabs.Screen name="alamo" options={{ title: "Tu Alamo" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
