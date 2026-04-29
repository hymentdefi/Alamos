import React from "react";
import Svg, { Path, Rect, Circle } from "react-native-svg";

/**
 * Set core de iconografía Alamos — 24 íconos line-style del brand-kit
 * (`brand-kit/13-icons/`). Reglas oficiales:
 *
 *   - Grid 24×24, stroke 1.6 (escala proporcional con size)
 *   - Round caps + round joins, radius mínimo 1.5
 *   - Monocromo, hereda el color del padre (currentColor / prop `color`)
 *   - Highlight container verde 15% + ícono dark cuando son protagónicos
 *
 * Cuando un ícono concreto no esté acá, caer a Feather sigue siendo
 * válido — el set core cubre lo más usado, no todo lo posible.
 */

export type AlamosIconName =
  | "cartera"
  | "trending-up"
  | "trending-down"
  | "pendiente"
  | "peso"
  | "bono"
  | "stats"
  | "eye"
  | "lock"
  | "check"
  | "close"
  | "alert"
  | "mail"
  | "phone"
  | "global"
  | "shield"
  | "user"
  | "settings"
  | "edit"
  | "arrow"
  | "refresh"
  | "download"
  | "upload"
  | "search";

interface Props {
  name: AlamosIconName;
  size?: number;
  /** Color stroke + fill para shapes protagónicas (ej: el dot del CBU
   *  en `cartera`, el triángulo central de `pendiente`). */
  color?: string;
  /** Stroke width override. Si no se pasa, escala proporcional al
   *  size (1.6 en 24). */
  strokeWidth?: number;
}

export function AlamosIcon({
  name,
  size = 22,
  color = "#0E0F0C",
  strokeWidth,
}: Props) {
  const sw = strokeWidth ?? (size / 24) * 1.6;
  const Shape = ICONS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Shape stroke={color} fill={color} strokeWidth={sw} />
    </Svg>
  );
}

interface ShapeProps {
  stroke: string;
  fill: string;
  strokeWidth: number;
}

/** Helper: stroke-only path (la mayoría de los íconos del set). */
const strokePath = (d: string) =>
  React.memo(function StrokePath({ stroke, strokeWidth }: ShapeProps) {
    return (
      <Path
        d={d}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  });

const ICONS: Record<AlamosIconName, React.FC<ShapeProps>> = {
  cartera: ({ stroke, fill, strokeWidth }) => (
    <>
      <Rect
        x={3}
        y={6}
        width={18}
        height={14}
        rx={2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M3 10h18"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={17} cy={15} r={1.4} fill={fill} />
    </>
  ),

  "trending-up": strokePath("M3 17l5-5 4 4 9-9 M14 7h7v7"),
  "trending-down": strokePath("M3 7l5 5 4-4 9 9 M14 17h7v-7"),

  pendiente: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={9}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M12 7v5l3 2"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  peso: strokePath("M12 2v20M5 8h11a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11"),

  bono: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={9}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M9 9h4.5a2.5 2.5 0 0 1 0 5H9zM9 14h5a2.5 2.5 0 0 1 0 5H9V9"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  stats: strokePath("M3 20V8m6 12V4m6 16v-9m6 9V12"),

  eye: ({ stroke, strokeWidth }) => (
    <>
      <Path
        d="M3 12c2-3 5-5 9-5s7 2 9 5"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 12c2 3 5 5 9 5s7-2 9-5"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={12}
        cy={12}
        r={3}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
    </>
  ),

  lock: ({ stroke, strokeWidth }) => (
    <>
      <Rect
        x={3}
        y={11}
        width={18}
        height={11}
        rx={2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  check: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={9}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M9 12l2 2 4-4"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  close: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={9}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M9 9l6 6M15 9l-6 6"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),

  alert: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={9}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M12 8v5M12 16v.5"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),

  mail: strokePath("M3 6l9 7 9-7M3 6v12h18V6"),

  phone: strokePath(
    "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  ),

  global: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={9}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M12 3v18M3 12h18M5 7c4 2 10 2 14 0M5 17c4-2 10-2 14 0"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),

  shield: strokePath("M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z"),

  user: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={12}
        cy={8}
        r={4}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M4 21c0-4 4-7 8-7s8 3 8 7"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),

  settings: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={12}
        cy={12}
        r={3}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  edit: strokePath(
    "M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5 M18 2l4 4-11 11H7v-4z",
  ),

  arrow: strokePath("M5 12h14M13 5l7 7-7 7"),

  refresh: strokePath("M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5"),

  download: strokePath("M12 4v12M6 10l6 6 6-6 M4 20h16"),

  upload: strokePath("M12 20V8M6 14l6-6 6 6 M4 4h16"),

  search: ({ stroke, strokeWidth }) => (
    <>
      <Circle
        cx={11}
        cy={11}
        r={7}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Path
        d="M16 16l5 5"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
};
