import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

// Geometría del nav bar flotante.
// El tabBar ocupa el ancho completo desde el borde superior del island
// hasta el piso, así todo lo que esté abajo del island queda cubierto
// por el backdrop traslúcido. El island se posiciona por dentro con
// absolute usando estas constantes.
const ISLAND_HEIGHT = 66;
const ISLAND_SIDE_GAP = 28;
const ISLAND_TOP_GAP = 10;

export default function TabsLayout() {
  const { mode, c } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === "dark";
  // Gap entre el bottom del island y el piso. Mínimo 14 en android,
  // o el safe area inset (home indicator) en ios — lo que sea más alto.
  const bottomGap = Math.max(Platform.OS === "ios" ? 24 : 14, insets.bottom);
  // Backdrop que cubre full-width desde arriba del island hasta el piso.
  // Casi sólido para que 'tape' el contenido que pase por abajo.
  const backdropBg = isDark
    ? "rgba(18, 22, 27, 0.92)"
    : "rgba(250, 250, 247, 0.92)";
  // Island en sí: sólido al 98% para que se despegue del backdrop.
  const islandBg = isDark
    ? "rgba(28, 33, 40, 0.98)"
    : "rgba(255, 255, 255, 0.98)";

  return (
    <Tabs
      // Nunca retroceder a una tab "anterior" con el back gesture:
      // dentro de cada tab el usuario navega con push/back, pero entre
      // tabs solo se mueve vía el nav bar.
      backBehavior="none"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFillObject}>
            {/* Backdrop semi-opaco que arranca EXACTAMENTE donde arranca
                el island — no un píxel más arriba. Cubre toda la franja
                inferior del island hacia abajo (incluido el gap hasta
                el piso del celular). */}
            <View
              style={{
                position: "absolute",
                top: ISLAND_TOP_GAP,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: backdropBg,
              }}
            />
            {/* Island centrado adentro, con forma stadium (pill). */}
            <View
              style={{
                position: "absolute",
                top: ISLAND_TOP_GAP,
                left: ISLAND_SIDE_GAP,
                right: ISLAND_SIDE_GAP,
                height: ISLAND_HEIGHT,
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
            />
          </View>
        ),
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          // Alto total = top gap + island + gap hasta el piso. Los tab
          // items se acomodan solos dentro de paddingTop/Bottom.
          height: ISLAND_TOP_GAP + ISLAND_HEIGHT + bottomGap,
          paddingTop: ISLAND_TOP_GAP,
          paddingBottom: bottomGap + 8,
          paddingHorizontal: ISLAND_SIDE_GAP,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: "#5ac43e",
        tabBarInactiveTintColor: c.textSecondary,
        tabBarLabelStyle: {
          fontFamily: fontFamily[700],
          fontSize: 12,
          letterSpacing: -0.15,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ focused, color }) => (
            <DrawingIcon
              path={tabPaths.home}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Mercado",
          tabBarIcon: ({ focused, color }) => (
            <DrawingIcon
              path={tabPaths.markets}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "Noticias",
          tabBarIcon: ({ focused, color }) => (
            <DrawingIcon
              path={tabPaths.news}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="alamo"
        options={{
          title: "Tu Alamo",
          tabBarIcon: ({ focused, color }) => (
            <DrawingIcon
              path={tabPaths.alamo}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
