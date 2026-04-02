import { Tabs } from "expo-router";
import { StyleSheet, Platform } from "react-native";
import { colors } from "../../lib/theme";
import { Ionicons } from "@expo/vector-icons";

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: s.tabBar,
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "analytics" : "analytics-outline"} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "aperture" : "aperture-outline"} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transfer"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "infinite" : "infinite-outline"} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "camera" : "camera-outline"} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={26} color={color} />
          ),
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="portfolio" options={{ href: null }} />
      <Tabs.Screen name="detail" options={{ href: null }} />
      <Tabs.Screen name="confirm" options={{ href: null }} />
      <Tabs.Screen name="success" options={{ href: null }} />
      <Tabs.Screen name="options" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="buy" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="crypto" options={{ href: null }} />
      <Tabs.Screen name="crypto-detail" options={{ href: null }} />
      <Tabs.Screen name="account" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="security" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="margin" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="lending" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="about" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface[0],
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    height: Platform.OS === "ios" ? 82 : 64,
    paddingTop: 8,
    elevation: 0,
    shadowOpacity: 0,
  },
});
