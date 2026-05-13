import { Stack, useSegments } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
 * Importante: el FloatingTabBar SIEMPRE está montado. La visibilidad
 * se anima vía opacity + translateY (Reanimated, UI thread). Sin un
 * mount/unmount evitamos el lag perceptible que pasaba al volver con
 * swipe-back desde detail — los segments cambian post-commit del
 * gesto y montar el bar desde cero tomaba unos frames; con la barra
 * ya en árbol, el fade/slide de 200 ms cubre esa transición.
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

  // Visibilidad del nav bar — asimétrico: APARICIÓN instantánea
  // (sin fade) para que al volver con swipe-back no haya el delay
  // perceptible del withTiming. OCULTAR sí va animado para que la
  // salida hacia detail/buy/etc se sienta smooth (no un cut seco).
  const navOpacity = useSharedValue(showNav ? 1 : 0);
  useEffect(() => {
    if (showNav) {
      // Set inmediato — sin withTiming. Reanimated escribe el valor
      // en el siguiente frame, sin lag de animación.
      navOpacity.value = 1;
    } else {
      navOpacity.value = withTiming(0, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [showNav, navOpacity]);

  const navStyle = useAnimatedStyle(() => ({
    opacity: navOpacity.value,
  }));

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
        <Stack.Screen name="briefing" />
        {/* Rendimiento: misma protección que detail — tiene Sparkline con
            scrub + bar chart de Cobros con tap-on-bar. El swipe vertical
            se confunde con back desde cualquier parte. Edge-swipe del
            borde izquierdo sigue habilitado. */}
        <Stack.Screen
          name="rendimiento"
          options={{ fullScreenGestureEnabled: false }}
        />
        {/* Cobros (calendario): grid de días + month picker modal con
            interacciones que se confundían con swipe-from-anywhere. */}
        <Stack.Screen
          name="cobros"
          options={{ fullScreenGestureEnabled: false }}
        />
        {/* Estadísticas (Tier 2): tabla con scroll horizontal + bottom
            sheets, mismo riesgo de confundir scroll con swipe-back. */}
        <Stack.Screen
          name="estadisticas"
          options={{ fullScreenGestureEnabled: false }}
        />
        {/* Proyección (Monte Carlo): fan chart + horizon pills.
            Misma protección que el resto. */}
        <Stack.Screen
          name="proyeccion"
          options={{ fullScreenGestureEnabled: false }}
        />
        {/* ADN (Factor Exposure): barras horizontales 0-100 con
            marker de benchmark. Misma protección. */}
        <Stack.Screen
          name="adn"
          options={{ fullScreenGestureEnabled: false }}
        />
        {/* Asset alerts — pantalla full-screen con la lista de
            alertas custom del activo. Slide_from_bottom para
            que se sienta deep-dive. */}
        <Stack.Screen
          name="asset-alerts"
          options={{ animation: "slide_from_bottom" }}
        />
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
        <Stack.Screen name="conditional-orders" />
        {/* Limit order: misma protección que buy/confirm — el keypad
            no debe disparar swipe-back. */}
        <Stack.Screen
          name="limit-order"
          options={{ fullScreenGestureEnabled: false }}
        />
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
      {/* FloatingTabBar siempre montado. Su visibilidad se controla
          vía opacity+translateY animados — el cambio de showNav se
          dispara cuando los segments cambian, y la transición de
          200ms cubre el frame-gap entre commit del gesto y re-render
          de React. */}
      <Animated.View
        pointerEvents={showNav ? "box-none" : "none"}
        style={[styles.navContainer, navStyle]}
      >
        <FloatingTabBar contextTab={navContextTab} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
