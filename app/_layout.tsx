import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  View,
  StyleSheet,
  Animated,
  Text,
  Appearance,
  type ColorSchemeName,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SecureStore from "expo-secure-store";

const THEME_STORAGE_KEY = "theme_mode";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { AuthProvider, useAuth } from "../lib/auth/context";
import { FavoritesProvider } from "../lib/favorites/context";
import { ProProvider } from "../lib/pro/context";
import { LegalConsentProvider } from "../lib/legal/context";
import { GreetingOverlay } from "../lib/components/GreetingOverlay";
import {
  ThemeContext,
  themes,
  type ThemeMode,
  type ThemeModePref,
  brand,
  fontFamily,
} from "../lib/theme";

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const scale = useState(new Animated.Value(0.85))[0];
  const opacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(900),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <View style={splash.container}>
      <Animated.Image
        source={require("../assets/brand-assets/empresa/png/brand-isotipo-1024.png")}
        style={[splash.logo, { opacity, transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  // Saludo personalizado: se muestra una vez por cold start después del
  // splash, sólo si el usuario está autenticado. Persiste en un ref para
  // que no se vuelva a mostrar al volver del background o al re-render.
  const [showGreeting, setShowGreeting] = useState(false);
  const greetingShownRef = useRef(false);

  useEffect(() => {
    if (isLoading || showSplash) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) router.replace("/(auth)/welcome");
    else if (isAuthenticated && inAuthGroup) router.replace("/(app)");
  }, [isAuthenticated, isLoading, segments, showSplash]);

  useEffect(() => {
    if (showSplash || isLoading) return;
    if (!isAuthenticated) return;
    if (greetingShownRef.current) return;
    greetingShownRef.current = true;
    setShowGreeting(true);
  }, [showSplash, isLoading, isAuthenticated]);

  if (showSplash || isLoading) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <>
      <Slot />
      {showGreeting ? (
        <GreetingOverlay onEnd={() => setShowGreeting(false)} />
      ) : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    // JetBrains Mono — fuente monoespaciada del brand-kit. Para
    // eyebrows técnicos, IDs/CBUs, microcopy data tipo "T+1", "0,02%".
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const [pref, setPrefState] = useState<ThemeModePref>("light");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? "light",
  );

  // Cargar preferencia persistida al iniciar la app.
  useEffect(() => {
    SecureStore.getItemAsync(THEME_STORAGE_KEY)
      .then((v) => {
        if (v === "dark" || v === "light" || v === "system") setPrefState(v);
      })
      .catch(() => {});
  }, []);

  // Escuchar cambios del color scheme del sistema.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? "light");
    });
    return () => sub.remove();
  }, []);

  const setPref = useCallback((p: ThemeModePref) => {
    setPrefState(p);
    SecureStore.setItemAsync(THEME_STORAGE_KEY, p).catch(() => {});
  }, []);

  // Modo efectivo: si pref es 'system', seguimos el device; si no, es
  // el pref mismo.
  const mode: ThemeMode = pref === "system"
    ? systemScheme === "dark" ? "dark" : "light"
    : pref;

  const toggle = useCallback(() => {
    setPref(mode === "light" ? "dark" : "light");
  }, [mode, setPref]);

  const themeValue = useMemo(
    () => ({ mode, pref, c: themes[mode], toggle, setPref }),
    [mode, pref, toggle, setPref],
  );

  if (!fontsLoaded) {
    return <View style={splash.container} />;
  }

  const defaultText = Text as unknown as { defaultProps?: { style?: unknown } };
  if (!defaultText.defaultProps?.style) {
    defaultText.defaultProps = {
      ...(defaultText.defaultProps ?? {}),
      style: { fontFamily: fontFamily[500] },
    };
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContext.Provider value={themeValue}>
        <AuthProvider>
          <LegalConsentProvider>
            <FavoritesProvider>
              <ProProvider>
                <StatusBar style={mode === "light" ? "dark" : "light"} />
                <AuthGate />
              </ProProvider>
            </FavoritesProvider>
          </LegalConsentProvider>
        </AuthProvider>
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 96,
    height: 96,
  },
});
