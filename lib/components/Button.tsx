import { Pressable, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors } from "../theme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  style?: ViewStyle;
}

export default function Button({ title, onPress, variant = "primary", style }: Props) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.base,
        isPrimary ? s.primary : s.secondary,
        pressed && { opacity: 0.9 },
        style,
      ]}
    >
      <Text style={[s.text, isPrimary ? s.textPrimary : s.textSecondary]}>
        {title}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.brand[500],
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
  textPrimary: {
    color: "#000",
  },
  textSecondary: {
    color: colors.text.primary,
  },
});
