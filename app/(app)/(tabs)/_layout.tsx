import { Tabs } from "expo-router";
import { Platform, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme, fontFamily } from "../../../lib/theme";

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
          tabBarIcon: ({ color }) => (
            <View style={st.iconWrap}>
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
            <View style={st.iconWrap}>
              <Feather name="trending-up" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "Noticias",
          tabBarIcon: ({ color }) => (
            <View style={st.iconWrap}>
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
            <View style={st.iconWrap}>
              <Feather name="user" size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const st = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
