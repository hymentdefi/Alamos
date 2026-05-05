import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { fontFamily, radius, useTheme } from "../theme";

/**
 * Sistema de toasts global. Pensado para confirmaciones rápidas tipo
 * "Agregado a favoritos" o "Alerta creada" — NO para errores
 * complejos (esos se muestran inline en su flow).
 *
 * Diseño:
 *   - Aparece arriba (debajo del notch) — flota sobre el contenido,
 *     no empuja layout.
 *   - Desaparece solo después de `durationMs` (default 2400ms).
 *   - Si llega otro toast mientras hay uno activo, lo reemplaza
 *     (no encolamos — confunde más que ayuda en una app simple).
 *   - Variantes:
 *       success → verde brand (subtle)
 *       error   → rojo/naranja (token c.red)
 *       neutral → bg surface neutro
 *
 * Uso:
 *   const { show } = useToast();
 *   show("Agregado a favoritos", { variant: "success" });
 */

type ToastVariant = "success" | "error" | "neutral";

interface ToastOptions {
  variant?: ToastVariant;
  /** ms en pantalla. Default 2400. */
  durationMs?: number;
}

interface ToastState {
  message: string;
  variant: ToastVariant;
  /** ID monotonic — usado como key para forzar remount al
   *  reemplazar un toast por otro con mismo mensaje pero
   *  distinto variant. */
  id: number;
}

interface ToastContextValue {
  show: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  const show = useCallback(
    (message: string, opts?: ToastOptions) => {
      const variant = opts?.variant ?? "neutral";
      const duration = opts?.durationMs ?? 2400;
      idRef.current += 1;
      setToast({ message, variant, id: idRef.current });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, duration);
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

/* ─── Vista del toast ─────────────────────────────────────────── */

function ToastView({ toast }: { toast: ToastState }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  // Animación in/out — slide desde arriba 24px + fade.
  const translateY = useSharedValue(-24);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const palette = paletteFor(toast.variant, c);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.wrap,
        {
          top: insets.top + 12,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[
          s.pill,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
          },
        ]}
      >
        <Text
          style={[s.text, { color: palette.text }]}
          numberOfLines={2}
        >
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}

interface Palette {
  bg: string;
  border: string;
  text: string;
}

function paletteFor(
  variant: ToastVariant,
  c: ReturnType<typeof useTheme>["c"],
): Palette {
  switch (variant) {
    case "success":
      return {
        bg: c.surface,
        border: c.brand,
        text: c.text,
      };
    case "error":
      return {
        bg: c.surface,
        border: c.red,
        text: c.text,
      };
    case "neutral":
    default:
      return {
        bg: c.surface,
        border: c.border,
        text: c.text,
      };
  }
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  pill: {
    maxWidth: 360,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  text: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
    textAlign: "center",
  },
});
