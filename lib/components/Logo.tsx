import { Image, type ImageStyle, type StyleProp } from "react-native";

type Variant = "mark" | "lockup" | "lockupShort";
type Tone = "light" | "dark";

interface LogoProps {
  variant?: Variant;
  tone?: Tone;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

const sources = {
  mark: {
    light: require("../../assets/brand-assets/empresa/png/brand-isotipo-1024.png"),
    dark: require("../../assets/brand-assets/empresa/png/brand-isotipo-dark-1024.png"),
  },
  lockup: {
    light: require("../../assets/brand-assets/empresa/png/brand-lockup-1024.png"),
    dark: require("../../assets/brand-assets/empresa/png/brand-lockup-dark-1024.png"),
  },
  lockupShort: {
    light: require("../../assets/brand-assets/empresa/png/brand-lockup-short-1024.png"),
    dark: require("../../assets/brand-assets/empresa/png/brand-lockup-short-dark-1024.png"),
  },
} as const;

const aspectRatio: Record<Variant, number> = {
  mark: 1,
  lockup: 4.4,
  lockupShort: 2.6,
};

export function AlamosLogo({
  variant = "mark",
  tone = "light",
  size = 32,
  style,
}: LogoProps) {
  const isMark = variant === "mark";
  const width = isMark ? size : size * aspectRatio[variant];
  const height = isMark ? size : size;

  return (
    <Image
      source={sources[variant][tone]}
      style={[{ width, height }, style]}
      resizeMode="contain"
    />
  );
}
