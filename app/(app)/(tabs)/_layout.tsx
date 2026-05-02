import { useEffect, useState } from "react";
import { Tabs, useRouter, useSegments } from "expo-router";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { DrawingIcon, tabPaths } from "../../../lib/components/DrawingIcon";

const ISLAND_HEIGHT = 64;
const ISLAND_SIDE_GAP = 16;
// Mini-fade DENTRO del backdrop, contado desde el top hacia abajo.
// El backdrop arranca exactamente en el top del nav (no se extiende
// arriba) — pero un edge perfecto se ve brusco. Esos primeros pixels
// hacen el alpha ramp transparente → opaco para que la transición
// sea suave en las franjas laterales (donde el blur es visible
// directamente, sin la pill encima).
const BACKDROP_TOP_FADE = 14;

const ACTIVE_COLOR = "#5ac43e";

type TabRoute = {
  name: string;
  href: string;
  title: string;
  path: (typeof tabPaths)[keyof typeof tabPaths];
};

const TAB_ROUTES: TabRoute[] = [
  { name: "index",   href: "/(app)/",        title: "Inicio",  path: tabPaths.home },
  { name: "explore", href: "/(app)/explore", title: "Mercado", path: tabPaths.markets },
  { name: "news",    href: "/(app)/news",    title: "Noticias",path: tabPaths.news },
  { name: "alamo",   href: "/(app)/alamo",   title: "Tu Álamo",path: tabPaths.alamo },
];

/**
 * Nav bar flotante glassmorphism con backdrop blur extendido.
 *
 * Layers (bottom to top):
 *   1. Backdrop blur — cubre desde BACKDROP_FADE_HEIGHT arriba del nav
 *      hasta el bottom del teléfono. Hace el efecto "el contenido
 *      detrás del nav está borroso". Tiene un fade-in suave en el
 *      borde superior (LinearGradient como mask) para que el inicio
 *      del blur no sea brusco.
 *   2. Floating island — la pill propia con su propio blur (más
 *      intenso) y los tab items adentro.
 *
 * Tab activa: pill verde brand atrás del icono+label que aparece con
 * fade al focusear.
 */
// Padding interno horizontal de la island — el pill respeta este
// margen, igual que los tab items. Coincide con styles.island
// `paddingHorizontal: 4` y con styles.activePill `inset: 6`.
const PILL_INSET_X = 4;
const PILL_INSET_Y = 6;

function FloatingTabBar() {
  const router = useRouter();
  const segments = useSegments();
  // El active index se deriva de los segments de Expo Router para que
  // cualquier navegación (botones internos, deep links, etc.) sincronice
  // la pill activa con la ruta real. Antes era state local y se
  // desincronizaba al navegar desde fuera del tab bar.
  const tabSegment =
    ((segments as readonly string[])[2] as string | undefined) ?? "index";
  const segIdx = TAB_ROUTES.findIndex((r) => r.name === tabSegment);
  const activeIndex = segIdx >= 0 ? segIdx : 0;
  const { mode, c } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === "dark";
  const bottomGap = Math.max(Platform.OS === "ios" ? 24 : 14, insets.bottom);

  // Ancho real de la island — lo medimos con onLayout para calcular
  // la posición exacta del pill (flex no nos da las coordenadas).
  const [islandWidth, setIslandWidth] = useState(0);

  // Posición animada del pill — un único elemento que se desliza
  // entre tabs. Esta es la diferencia clave vs el patrón anterior:
  // antes cada item tenía su propio pill que hacía fade; ahora el
  // pill es compartido y se traslada en X. Trigger: cambia
  // activeIndex, withTiming + cubic out → slide smooth en UI thread.
  const pillIndex = useSharedValue(activeIndex);
  // Pulse del pill — squash & stretch estilo Zoho Mail. Durante el
  // viaje el pill se ESTIRA en X (rubber-band, leading edge tira al
  // pill hacia adelante) y se aplasta en Y; al aterrizar pega un
  // bounce inverso (X comprimido, Y expandido) y vuelve al tamaño
  // real. Es lo que da el feel "vivo" al cambio de sección.
  const pillScaleX = useSharedValue(1);
  const pillScaleY = useSharedValue(1);
  useEffect(() => {
    pillIndex.value = withTiming(activeIndex, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
    pillScaleX.value = withSequence(
      withTiming(1.22, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0.94, {
        duration: 130,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: 110,
        easing: Easing.out(Easing.quad),
      }),
    );
    pillScaleY.value = withSequence(
      withTiming(0.84, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1.08, {
        duration: 130,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: 110,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [activeIndex, pillIndex, pillScaleX, pillScaleY]);

  const itemWidth =
    islandWidth > 0 ? (islandWidth - PILL_INSET_X * 2) / TAB_ROUTES.length : 0;

  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: PILL_INSET_X + pillIndex.value * itemWidth },
      { scaleX: pillScaleX.value },
      { scaleY: pillScaleY.value },
    ],
    width: itemWidth,
  }));

  const onPressTab = (route: TabRoute, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (index === activeIndex) return;
    router.navigate(route.href as never);
  };

  // Backdrop empieza EXACTAMENTE en el top del nav (no se extiende
  // por arriba) y baja hasta el bottom del teléfono.
  const totalBackdropHeight = ISLAND_HEIGHT + bottomGap;

  return (
    <View pointerEvents="box-none" style={styles.container}>
      {/* Layer 1: backdrop blur full-width. Arranca en el top del nav
          y cubre hasta el piso. El alpha mask hace un mini-fade en
          los primeros BACKDROP_TOP_FADE pixels (yendo hacia abajo)
          para que la transición no se vea como una línea horizontal
          dura — visible en las franjas laterales donde no hay pill
          tapando. */}
      <MaskedView
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: totalBackdropHeight,
        }}
        maskElement={
          <LinearGradient
            colors={["transparent", "black"]}
            locations={[0, BACKDROP_TOP_FADE / totalBackdropHeight]}
            style={{ flex: 1 }}
          />
        }
      >
        <BlurView
          tint={isDark ? "dark" : "light"}
          intensity={Platform.OS === "ios" ? 28 : 50}
          style={{
            flex: 1,
            // Tinte muy sutil para reforzar el efecto vidrio sin
            // tapar tanto el contenido detrás.
            backgroundColor: isDark
              ? "rgba(0, 0, 0, 0.20)"
              : "rgba(255, 255, 255, 0.25)",
          }}
        />
      </MaskedView>

      {/* Layer 2: floating island sobre el backdrop */}
      <View
        style={{
          position: "absolute",
          bottom: bottomGap,
          left: ISLAND_SIDE_GAP,
          right: ISLAND_SIDE_GAP,
        }}
        onLayout={(e) => setIslandWidth(e.nativeEvent.layout.width)}
      >
        <BlurView
          tint={isDark ? "dark" : "light"}
          intensity={Platform.OS === "ios" ? 60 : 90}
          style={[
            styles.island,
            {
              height: ISLAND_HEIGHT,
              backgroundColor: isDark
                ? "rgba(18, 18, 18, 0.70)"
                : "rgba(250, 250, 250, 0.78)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : "rgba(0, 0, 0, 0.06)",
            },
          ]}
        >
          {/* Pill compartido — se desliza entre items en lugar de
              fadear por item (estilo Zoho Mail). Vive en el container
              de la island, debajo de los tab items. */}
          {itemWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.slidingPill,
                {
                  top: PILL_INSET_Y,
                  bottom: PILL_INSET_Y,
                  backgroundColor: isDark
                    ? "rgba(14, 203, 129, 0.14)"
                    : "rgba(0, 200, 5, 0.10)",
                  borderColor: isDark
                    ? "rgba(14, 203, 129, 0.20)"
                    : "rgba(0, 200, 5, 0.16)",
                },
                pillStyle,
              ]}
            />
          ) : null}

          {TAB_ROUTES.map((route, index) => {
            const focused = index === activeIndex;
            return (
              <TabItem
                key={route.name}
                route={route}
                focused={focused}
                inactiveColor={c.textSecondary}
                onPress={() => onPressTab(route, index)}
              />
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

interface TabItemProps {
  route: TabRoute;
  focused: boolean;
  inactiveColor: string;
  onPress: () => void;
}

function TabItem({ route, focused, inactiveColor, onPress }: TabItemProps) {
  // El pill ahora vive en el padre y se desliza — el item solo
  // alterna el color de icon+label entre activo/inactivo. El swap es
  // instantáneo en el destino (igual que Zoho Mail) mientras el pill
  // viaja por debajo.
  const color = focused ? ACTIVE_COLOR : inactiveColor;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={route.title}
      onPress={onPress}
      style={styles.tabItem}
      hitSlop={6}
    >
      <DrawingIcon path={route.path} focused={focused} color={color} />
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {route.title}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        backBehavior="none"
        screenOptions={{
          headerShown: false,
          // Slide direccional en X axis nativo de bottom-tabs v7. No es
          // un slide full-page como Stack, pero al menos hay movimiento.
          animation: "shift",
        }}
        tabBar={() => null}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="news" />
        <Tabs.Screen name="alamo" />
      </Tabs>
      <FloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  island: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    // overflow:"hidden" es clave con BlurView — sin esto los bordes
    // redondeados del blur se recortan cuadrados en Android.
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 14,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    gap: 3,
  },
  slidingPill: {
    position: "absolute",
    left: 0,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.15,
  },
});
