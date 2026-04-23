import { Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

export default function TabsLayout() {
  const { mode, c } = useTheme();
  const isDark = mode === "dark";
  // Fondo casi sólido con un hint de translucidez para que se sienta vivo
  // sin perder legibilidad.
  const islandBg = isDark
    ? "rgba(18, 22, 27, 0.96)"
    : "rgba(255, 255, 255, 0.96)";

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
          <View
            style={{
              flex: 1,
              backgroundColor: islandBg,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: c.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.14,
              shadowRadius: 24,
              elevation: 16,
              overflow: "hidden",
            }}
          />
        ),
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Platform.OS === "ios" ? 22 : 16,
          height: 76,
          paddingTop: 0,
          paddingBottom: 12,
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
        name="support"
        options={{
          title: "Soporte",
          tabBarIcon: ({ focused, color }) => (
            <DrawingIcon
              path={tabPaths.support}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
