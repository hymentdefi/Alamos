import { useEffect, useMemo, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, Animated, Text } from "react-native";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { AuthProvider, useAuth } from "../lib/auth/context";
import { FavoritesProvider } from "../lib/favorites/context";
import { ProProvider } from "../lib/pro/context";
import { ThemeContext, themes, type ThemeMode, brand, fontFamily } from "../lib/theme";

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

  useEffect(() => {
    if (isLoading || showSplash) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) router.replace("/(auth)/welcome");
    else if (isAuthenticated && inAuthGroup) router.replace("/(app)");
  }, [isAuthenticated, isLoading, segments, showSplash]);

  if (showSplash || isLoading) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [mode, setMode] = useState<ThemeMode>("light");

  const themeValue = useMemo(() => ({
    mode,
    c: themes[mode],
    toggle: () => setMode((m) => (m === "light" ? "dark" : "light")),
  }), [mode]);

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
    <ThemeContext.Provider value={themeValue}>
      <AuthProvider>
        <FavoritesProvider>
          <ProProvider>
            <StatusBar style={mode === "light" ? "dark" : "light"} />
            <AuthGate />
          </ProProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ThemeContext.Provider>
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
