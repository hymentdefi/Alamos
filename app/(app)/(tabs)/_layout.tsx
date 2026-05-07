import { Tabs } from "expo-router";
import {
  Dimensions,
  Easing as RNEasing,
  StyleSheet,
  View,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

/**
 * Layout de las tabs internas. El FloatingTabBar NO se renderea acá
 * — vive en el parent (app)/_layout.tsx para quedar fijo durante
 * las transiciones del Stack hacia screens hijo (market-category,
 * detail, etc.).
 */
export default function TabsLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        backBehavior="none"
        screenOptions={{
          headerShown: false,
          // Pre-montar TODAS las tabs al boot. Sin esto, cada tab
          // se monta lazy en su primera visita — eso hace que el
          // shift de transición se trabe (el screen destino tiene
          // que reconciliar su árbol entero mientras la animación
          // ya empezó). Con lazy: false, el shift navega entre
          // pantallas que ya están listas en memoria → fluido.
          lazy: false,
          // Transición full-screen-slide custom — el preset 'shift'
          // de bottom-tabs solo desliza 50px y fadea. Override:
          //   - slide horizontal de ANCHO COMPLETO
          //   - duración 720ms
          //   - easing out-quart: arranca rápido, desacelera mucho
          //     hacia el final. Sin overshoot.
          // Sin opacity fade — el slide solo lleva la lectura visual.
          animation: "shift",
          transitionSpec: {
            animation: "timing",
            config: {
              duration: 720,
              easing: RNEasing.bezier(0.16, 1, 0.3, 1),
            },
          },
          sceneStyleInterpolator: ({ current }) => ({
            sceneStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-SCREEN_W, 0, SCREEN_W],
                  }),
                },
              ],
            },
          }),
        }}
        tabBar={() => null}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="portfolio" />
        <Tabs.Screen name="news" />
        <Tabs.Screen name="alamo" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
