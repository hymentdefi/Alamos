import {
  Text,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { useTheme, fontFamily, radius } from "../theme";
import { Tap } from "./Tap";
import { Squircle } from "./Squircle";

type Variant = "primary" | "secondary" | "accent" | "ghost";
type Size = "md" | "lg";

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  right?: React.ReactNode;
  left?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "lg",
  disabled,
  right,
  left,
  style,
}: Props) {
  const { c } = useTheme();

  const bg =
    variant === "primary" || variant === "accent"
      ? c.brand
      : variant === "secondary"
      ? c.surfaceHover
      : "transparent";
  const fg =
    variant === "primary" || variant === "accent"
      ? c.onColor /* texto sobre verde brand: blanco en light, negro en dark */
      : variant === "ghost"
      ? c.text
      : c.ink;
  const hasBorder = variant === "secondary";
  const border = hasBorder ? c.border : undefined;

  const height = size === "lg" ? 52 : 44;
  const padH = size === "lg" ? 22 : 18;

  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      haptic={variant === "primary" || variant === "accent" ? "light" : "selection"}
      style={[
        s.base,
        {
          height,
          paddingHorizontal: padH,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Squircle
        style={StyleSheet.absoluteFill}
        radius={radius.btn}
        backgroundColor={bg}
        borderColor={border}
        borderWidth={hasBorder ? 1 : undefined}
      />
      {left ? <View style={{ marginRight: 8 }}>{left}</View> : null}
      <Text style={[s.text, { color: fg }]}>{title}</Text>
      {right ? <View style={{ marginLeft: 8 }}>{right}</View> : null}
    </Tap>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
