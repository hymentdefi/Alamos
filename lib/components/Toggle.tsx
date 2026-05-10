import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme";

interface Props {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  /** Override del color "ON" del track. Default: c.brand. */
  onColor?: string;
}

/**
 * Toggle compacto con dimensiones alineadas a la tipografía body.
 * Sustituto del Switch nativo cuando importa el sizing exacto (rows
 * con texto chico al lado donde el Switch nativo se ve grande o
 * descentrado).
 *
 * Track: 40 × 22 (radius pill). Thumb: 18 × 18 con shadow sutil.
 * Animaciones del thumb (translateX) y del bg del track con timing
 * suave (160 ms cubic). Haptic light al tap.
 */
export function Toggle({ value, onValueChange, disabled, onColor }: Props) {
  const { c } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, progress]);

  const trackOn = onColor ?? c.brand;
  const trackOff = c.surfaceHover;

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [trackOff, trackOn],
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: 2 + progress.value * 18,
      },
    ],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onValueChange(!value);
      }}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={({ pressed }) => [
        s.wrap,
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}
    >
      <Animated.View style={[s.track, trackStyle]}>
        <Animated.View style={[s.thumb, thumbStyle]}>
          <View style={s.thumbInner} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: 40,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: 40,
    height: 22,
    borderCurve: "continuous",
    borderRadius: 11,
    justifyContent: "center",
  },
  thumb: {
    width: 18,
    height: 18,
    borderCurve: "continuous",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbInner: {
    flex: 1,
  },
});
