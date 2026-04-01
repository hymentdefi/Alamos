import { Tabs } from "expo-router";
import { colors } from "../../lib/theme";

export default function AppLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.surface[50] },
      headerTintColor: colors.text.primary,
      tabBarStyle: { backgroundColor: colors.surface[50], borderTopColor: colors.surface[200] },
      tabBarActiveTintColor: colors.brand[500],
      tabBarInactiveTintColor: colors.text.muted,
    }}>
      <Tabs.Screen name="index" options={{ title: "Portfolio" }} />
      <Tabs.Screen name="market" options={{ title: "Mercado" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}