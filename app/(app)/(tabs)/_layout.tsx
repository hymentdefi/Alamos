import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { useTheme, fontFamily } from "../../../lib/theme";
import { AnimatedTabIcon } from "../../../lib/components/AnimatedTabIcon";

export default function TabsLayout() {
  const { c } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? 22 : 10,
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
            <AnimatedTabIcon
              outline="home-outline"
              filled="home"
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
            <AnimatedTabIcon
              outline="stats-chart-outline"
              filled="stats-chart"
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
            <AnimatedTabIcon
              outline="newspaper-outline"
              filled="newspaper"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ focused, color }) => (
            <AnimatedTabIcon
              outline="person-outline"
              filled="person"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
