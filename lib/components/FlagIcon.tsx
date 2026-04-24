import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
} from "react-native-svg";

type FlagCode = "AR" | "US";

interface Props {
  code: FlagCode;
  size?: number;
}

/**
 * Círculo con la bandera del país — dibujado en SVG, no emoji. Las
 * proporciones están simplificadas para que se vean claras a tamaños
 * chicos (24–48px). Se usa para las monedas en el Inicio/Dinero.
 */
export function FlagIcon({ code, size = 36 }: Props) {
  return (
    <View style={[s.wrap, { width: size, height: size }]}>
      {code === "AR" ? <ArgentinaFlag size={size} /> : <UsaFlag size={size} />}
    </View>
  );
}

/* ─── Argentina ─── */
// Bandas horizontales: celeste, blanco, celeste, con sol dorado al centro.
function ArgentinaFlag({ size }: { size: number }) {
  const CELESTE = "#74ACDF";
  const WHITE = "#FFFFFF";
  const SUN = "#F6B40E";
  const SUN_CENTER = "#FCBF49";
  const r = size / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Defs>
        <ClipPath id="arClip">
          <Circle cx="18" cy="18" r="18" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#arClip)">
        <Rect x="0" y="0" width="36" height="12" fill={CELESTE} />
        <Rect x="0" y="12" width="36" height="12" fill={WHITE} />
        <Rect x="0" y="24" width="36" height="12" fill={CELESTE} />
        {/* Sol estilizado: círculo dorado con pequeño halo. Se ve
            bien hasta ~28px; más chico queda como un punto y listo. */}
        <Circle
          cx="18"
          cy="18"
          r="4.2"
          fill="none"
          stroke={SUN}
          strokeWidth="1.2"
        />
        <Circle cx="18" cy="18" r="2.6" fill={SUN_CENTER} />
      </G>
      <Circle
        cx="18"
        cy="18"
        r={r - 0.3}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="0.6"
      />
    </Svg>
  );
}

/* ─── Estados Unidos ─── */
// 6 franjas rojas + 7 blancas (simplificado), canton azul arriba-izq.
function UsaFlag({ size }: { size: number }) {
  const RED = "#B22234";
  const WHITE = "#FFFFFF";
  const BLUE = "#3C3B6E";
  const r = size / 2;
  const stripeH = 36 / 13;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Defs>
        <ClipPath id="usClip">
          <Circle cx="18" cy="18" r="18" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#usClip)">
        <Rect x="0" y="0" width="36" height="36" fill={WHITE} />
        {/* 7 bandas rojas (0, 2, 4, 6, 8, 10, 12). */}
        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
          <Rect
            key={i}
            x="0"
            y={i * stripeH}
            width="36"
            height={stripeH}
            fill={RED}
          />
        ))}
        {/* Canton azul: 40% ancho × ~55% alto. */}
        <Rect x="0" y="0" width="14.4" height={stripeH * 7} fill={BLUE} />
        {/* Estrellas simplificadas: 4 puntos blancos en el canton. */}
        {[
          [3.6, 3],
          [9, 3],
          [3.6, 8],
          [9, 8],
          [3.6, 13],
          [9, 13],
        ].map(([cx, cy], i) => (
          <Circle key={i} cx={cx} cy={cy} r="0.9" fill={WHITE} />
        ))}
      </G>
      <Circle
        cx="18"
        cy="18"
        r={r - 0.3}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth="0.6"
      />
    </Svg>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 999,
    overflow: "hidden",
  },
});
