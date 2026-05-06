import { Stack, useSegments } from "expo-router";
import { StyleSheet, View } from "react-native";
import { FloatingTabBar } from "../../lib/components/FloatingTabBar";
import { useTheme } from "../../lib/theme";

/**
 * Layout root del área autenticada. El nav bar (FloatingTabBar) se
 * renderea acá como sibling del Stack — así queda fijo a la pantalla
 * y NO se desliza con las transiciones de Stack hacia screens hijo.
 *
 * Visibilidad del nav bar:
 *   - (tabs) — siempre visible (es la home base)
 *   - market-category — visible (es continuación del flow de Mercado)
 *   - resto (detail, buy, transfer, settings, etc.) — oculto
 *
 * Cuando aparece en market-category, le pasamos contextTab="explore"
 * para que la pill activa marque Mercado (sino el FloatingTabBar
 * defaultea a Inicio porque segments[2] no matchea ningún tab name).
 */
export default function AppLayout() {
  const { c } = useTheme();
  const segments = useSegments();
  // segments[0] = "(app)", segments[1] = lo que sigue: "(tabs)" o
  // "market-category" o "detail" o lo que fuere.
  const second = (segments as readonly string[])[1] ?? "";
  const showNav = second === "(tabs)" || second === "market-category";
  const navContextTab = second === "market-category" ? "explore" : undefined;

  return (
    <View style={styles.root}>
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
        <Stack.Screen name="alerts" />
        <Stack.Screen name="queued-orders" />
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
        {/* Sub-rutas del flow de Ingresar — cada una es su propio
            screen para que el swipe-back nativo de iOS popee
            naturalmente al stack anterior (hub → detalle → from
            account). */}
        <Stack.Screen
          name="transfer-deposit"
          options={{ fullScreenGestureEnabled: false }}
        />
        <Stack.Screen
          name="transfer-deposit-from"
          options={{ fullScreenGestureEnabled: false }}
        />
        {/* Sub-rutas del flow de Enviar — mismo patrón. El slider de %
            y el keypad necesitan fullScreenGestureEnabled=false para
            que no se confundan con el swipe-from-anywhere. */}
        <Stack.Screen
          name="transfer-send-amount"
          options={{ fullScreenGestureEnabled: false }}
        />
        <Stack.Screen
          name="transfer-send-destination"
          options={{ fullScreenGestureEnabled: false }}
        />
        <Stack.Screen
          name="transfer-send-success"
          options={{
            animation: "slide_from_bottom",
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
      {showNav ? <FloatingTabBar contextTab={navContextTab} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
