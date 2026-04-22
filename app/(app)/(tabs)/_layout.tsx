import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { useTheme, fontFamily } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

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
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ focused, color }) => (
            <DrawingIcon
              key={`profile-${focused}`}
              path={tabPaths.profile}
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
