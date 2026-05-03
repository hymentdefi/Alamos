import { Stack } from "expo-router";
import { useTheme } from "../../lib/theme";

export default function AppLayout() {
  const { c } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: "slide_from_right",
        animationDuration: 260,
        gestureEnabled: true,
        gestureDirection: "horizontal",
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
      {/* Detail: fullscreen gesture OFF para que pasar el dedo sobre el
          chart (scrubbing del sparkline) no dispare el swipe-back. El
          swipe desde el borde izquierdo sigue andando como back. */}
      <Stack.Screen
        name="detail"
        options={{ fullScreenGestureEnabled: false }}
      />
      <Stack.Screen name="trade" />
      {/* Buy: fullscreen gesture OFF para que arrastrar el slider no
          dispare el swipe-back. El swipe desde el borde izquierdo sigue
          andando como back. */}
      <Stack.Screen
        name="buy"
        options={{ fullScreenGestureEnabled: false }}
      />
      <Stack.Screen
        name="confirm"
        options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
      <Stack.Screen
        name="success"
        options={{ animation: "slide_from_bottom", gestureEnabled: false }}
      />
      <Stack.Screen name="activity" />
      <Stack.Screen name="notifications" />
      {/* Convert: misma protección que transfer — el slider/keypad
          puede confundirse con un swipe-from-anywhere. */}
      <Stack.Screen
        name="convert"
        options={{ fullScreenGestureEnabled: false }}
      />
      {/* Transfer: fullscreen gesture OFF (el slider de % se
          confundía con el swipe-from-anywhere). El edge-swipe-back
          desde el borde izquierdo sigue habilitado para volver. */}
      <Stack.Screen
        name="transfer"
        options={{ fullScreenGestureEnabled: false }}
      />
      <Stack.Screen name="settings" />
      <Stack.Screen name="security" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="support" />
      <Stack.Screen name="about" />
      <Stack.Screen name="account" />
      <Stack.Screen
        name="onboarding"
        options={{ animation: "fade", gestureEnabled: false }}
      />
    </Stack>
  );
}
