import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { useTheme, fontFamily } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

export default function TabsLayout() {
  const { c } = useTheme();

  return (
    <Tabs
      // Nunca retroceder a una tab "anterior" con el back gesture:
      // dentro de cada tab el usuario navega con push/back, pero entre
      // tabs solo se mueve vía el nav bar.
      backBehavior="none"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
          height: Platform.OS === "ios" ? 92 : 78,
          paddingTop: 12,
          paddingBottom: Platform.OS === "ios" ? 30 : 18,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textFaint,
        tabBarLabelStyle: {
          fontFamily: fontFamily[600],
          fontSize: 11,
          letterSpacing: -0.1,
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
              key={`home-${focused}`}
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
              key={`markets-${focused}`}
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
              key={`news-${focused}`}
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
              key={`support-${focused}`}
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
