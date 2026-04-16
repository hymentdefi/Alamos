import { useEffect, useState, useMemo } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, Animated } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth/context";
import { ThemeContext, themes, type ThemeMode } from "../lib/theme";

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const scale = useState(new Animated.Value(0.8))[0];
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
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1200),
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
        source={require("../assets/logo-mark.png")}
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
  const [mode, setMode] = useState<ThemeMode>("dark");

  const themeValue = useMemo(() => ({
    mode,
    c: themes[mode],
    toggle: () => setMode((m) => (m === "dark" ? "light" : "dark")),
  }), [mode]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <AuthProvider>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <AuthGate />
      </AuthProvider>
    </ThemeContext.Provider>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 80,
    height: 80,
  },
});
