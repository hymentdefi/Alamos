import { Tabs } from "expo-router";
import { Platform, View, StyleSheet } from "react-native";
import { useTheme, brand } from "../../lib/theme";
import { Feather } from "@expo/vector-icons";

export default function AppLayout() {
  const { c } = useTheme();

  const iconWrap = { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 22 : 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) => (
            <View style={iconWrap}>
              <Feather name="home" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Mercado",
          tabBarIcon: ({ color }) => (
            <View style={iconWrap}>
              <Feather name="search" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: "Portfolio",
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => (
            <View style={st.centerTab}>
              <View style={[st.centerCircle, { backgroundColor: focused ? brand.green : c.surfaceHover }]}>
                <Feather name="pie-chart" size={24} color={focused ? "#000000" : c.text} />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "News",
          tabBarIcon: ({ color }) => (
            <View style={iconWrap}>
              <Feather name="file-text" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => (
            <View style={iconWrap}>
              <Feather name="user" size={22} color={color} />
            </View>
          ),
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: "none" } }} />
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
      <Tabs.Screen name="transfer" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="about" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="cash" options={{ href: null }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  centerTab: {
    alignItems: "center",
    justifyContent: "center",
    top: -14,
  },
  centerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00E676",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
});
