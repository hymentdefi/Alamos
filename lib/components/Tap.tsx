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
  haptic?: HapticKind;
  pressScale?: number;
  rippleColor?: string;
  rippleContained?: boolean;
  children?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
    <AnimatedPressable
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
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
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
