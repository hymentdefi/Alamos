import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  View,
  StyleSheet,
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
import { PrivacyProvider } from "../lib/privacy/context";
import { LegalConsentProvider } from "../lib/legal/context";
import { GreetingOverlay } from "../lib/components/GreetingOverlay";
import { ConfettiPortal } from "../lib/hooks/useConfetti";
import {
  ThemeContext,
  themes,
  type ThemeMode,
  type ThemeModePref,
  brand,
  fontFamily,
} from "../lib/theme";

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Greeting overlay: se muestra una vez por cold start después del
  // splash nativo, sólo si el usuario está autenticado. Persiste en un
  // ref para que no se vuelva a mostrar al volver del background.
  const [showGreeting, setShowGreeting] = useState(false);
  const greetingShownRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) router.replace("/(auth)/welcome");
    else if (isAuthenticated && inAuthGroup) router.replace("/(app)");
  }, [isAuthenticated, isLoading, segments]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (greetingShownRef.current) return;
    greetingShownRef.current = true;
    setShowGreeting(true);
  }, [isLoading, isAuthenticated]);

  // Mientras la auth carga, mostramos un View vacío con bg blanco —
  // visualmente continuo con el splash nativo de Expo, sin segundo
  // splash JS que pisaba el logo mix por 1.7s extra. Apenas el JS
  // está listo y el user autenticado, arranca el GreetingOverlay.
  if (isLoading) {
    return <View style={splash.container} />;
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
                <PrivacyProvider>
                  <StatusBar style={mode === "light" ? "dark" : "light"} />
                  <AuthGate />
                  {/* Confetti portal — UNA sola instancia montada en
                      el root. Cualquier pantalla puede llamar
                      `useConfetti().burst()` y la animación renderea
                      acá, encima de todo. */}
                  <ConfettiPortal />
                </PrivacyProvider>
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
  },
});
