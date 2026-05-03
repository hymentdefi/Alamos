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
      {/* Transfer: gestos nativos OFF.
          - fullScreenGestureEnabled: el slider de % se confundía
            con el swipe-back y se salía de la pantalla.
          - gestureEnabled: el flow tiene 3 sub-steps internos
            (currency → amount → destination → success). Si
            permitimos el edge-swipe-back, iOS pop-ea toda la screen
            y se va al home en vez de al sub-step anterior. Con el
            gesture OFF, el botón de back del header se encarga de
            la navegación entre steps de manera consistente. */}
      <Stack.Screen
        name="transfer"
        options={{
          fullScreenGestureEnabled: false,
          gestureEnabled: false,
        }}
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
