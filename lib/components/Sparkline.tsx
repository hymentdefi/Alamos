import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

interface Props {
  color: string;
  /** Path 'd' attribute sobre viewBox 0 0 260 90. Si no se pasa, usa una curva de ejemplo ascendente. */
  path?: string;
  /** Alto visible (ancho 100%). */
  height?: number;
  /** Si es false, no pinta el area de abajo. */
  withFill?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_PATH =
  "M0,68 C20,62 38,70 58,58 C78,46 92,54 110,42 C128,30 150,40 170,28 C188,18 206,24 224,14 C240,8 252,12 260,10";

export function Sparkline({
  color,
  path = DEFAULT_PATH,
  height = 110,
  withFill = true,
  style,
}: Props) {
  const filledPath = `${path} L260,90 L0,90 Z`;
  const gradId = `spark-${color.replace("#", "")}`;

  return (
    <View style={[{ height, marginHorizontal: -4 }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 260 90" preserveAspectRatio="none">
        {withFill ? (
          <>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={filledPath} fill={`url(#${gradId})`} />
          </>
        ) : null}
        <Path
          d={path}
          stroke={color}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** Genera un path SVG aleatorio determinístico a partir de un seed (ej: ticker). */
export function pathFromSeed(seed: string, trend: "up" | "down" | "flat" = "up"): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };

  const points: { x: number; y: number }[] = [];
  const steps = 12;
  const drift = trend === "up" ? -4 : trend === "down" ? 4 : 0;
  let y = trend === "up" ? 70 : trend === "down" ? 20 : 45;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 260;
    const jitter = (rand() - 0.5) * 22;
    y = Math.max(8, Math.min(82, y + drift + jitter));
    points.push({ x, y });
  }

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const cx = (prev.x + p.x) / 2;
    d += ` C${cx},${prev.y} ${cx},${p.y} ${p.x},${p.y}`;
  }
  return d;
}
