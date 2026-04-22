import { forwardRef, useCallback, useRef } from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

type HapticKind = "selection" | "light" | "medium" | "heavy" | "none";

interface Props extends Omit<PressableProps, "style" | "onPressIn" | "onPressOut"> {
  style?: StyleProp<ViewStyle>;
  /** Qué tan fuerte el feedback háptico (default "selection"). */
  haptic?: HapticKind;
  /** Cuánto se achica al pressIn. Default 0.96. */
  pressScale?: number;
  /** Color del ripple en Android (default suave gris). */
  rippleColor?: string;
  /** Si true, no aplica ripple borderless en Android. */
  rippleContained?: boolean;
  children?: React.ReactNode;
}

/**
 * Botón táctil con feedback multi-sensorial:
 * – Scale down al press (spring suave).
 * – Haptic inmediato al press (selección, light, medium, heavy).
 * – Ripple nativo en Android.
 *
 * Drop-in replacement de Pressable para acciones interactivas. La idea es
 * que cada tap se sienta preciso y sólido, no suelto. Inspirado en la
 * tactilidad de NaranjaX, Revolut y Robinhood.
 */
export const Tap = forwardRef<unknown, Props>(function Tap(
  {
    style,
    haptic = "selection",
    pressScale = 0.96,
    rippleColor = "rgba(14,15,12,0.08)",
    rippleContained = true,
    onPress,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: pressScale,
      tension: 380,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [scale, pressScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 380,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (haptic !== "none") fireHaptic(haptic);
      onPress?.(e);
    },
    [haptic, onPress],
  );

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        // @ts-expect-error — ref forwarding sobre Pressable acepta cualquier host ref.
        ref={ref}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{
          color: rippleColor,
          borderless: !rippleContained,
        }}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
});

function fireHaptic(kind: Exclude<HapticKind, "none">) {
  switch (kind) {
    case "selection":
      Haptics.selectionAsync().catch(() => {});
      return;
    case "light":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    case "medium":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    case "heavy":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      return;
  }
}
