import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Polygon,
  Rect,
} from "react-native-svg";
import { fontFamily } from "../theme";

/* ─── MarketFlag — bandera circular para los 3 mercados de Álamos.
 *
 * Mismo componente que se usa en la sección "Mercados" del Portfolio
 * y en el segmented selector del Mercado. Tres variantes:
 *
 *   AR     → Argentina bold (celeste profundo + Sol de Mayo).
 *   US     → Old Glory (13 stripes + canton azul con estrellas).
 *   CRYPTO → Brand verde Álamos + ₿ blanco tilteada 14°.
 *
 * Forma circular (no squircle) — coherente con cómo Robinhood y
 * Coinbase muestran países / assets.
 */

type MarketKey = "AR" | "US" | "CRYPTO";

interface Props {
  marketKey: MarketKey;
  size?: number;
}

export function MarketFlag({ marketKey, size = 40 }: Props) {
  if (marketKey === "AR") {
    return <ArgentinaBoldFlag size={size} />;
  }
  if (marketKey === "US") {
    return <BetsyRossFlag size={size} />;
  }
  return <BitcoinFlag size={size} />;
}

/** Bandera AR — celeste profundo + Sol de Mayo CHICO al centro
 *  (rayos cortos, disco compacto). El sol acompaña, no domina. */
function ArgentinaBoldFlag({ size }: { size: number }) {
  const CELESTE = "#3F8CC9";
  const WHITE = "#FFFFFF";
  const SUN_RAY = "#F4B400";
  const SUN_DISC = "#FFC72C";
  return (
    <View
      style={[
        s.flagCircle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Defs>
          <ClipPath id="arBoldClip">
            <Circle cx={20} cy={20} r={20} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#arBoldClip)">
          {/* Bandas — 12 / 16 / 12 (banda blanca un poco más ancha
              para que el sol respire). */}
          <Rect x={0} y={0} width={40} height={12} fill={CELESTE} />
          <Rect x={0} y={12} width={40} height={16} fill={WHITE} />
          <Rect x={0} y={28} width={40} height={12} fill={CELESTE} />

          {/* Sol de Mayo compacto — 16 rayos cortos (de y=15 a y=18,
              triángulos angostos) + disco r=2.4. Total radius ~5,
              chico y centrado dentro de la banda blanca. */}
          {Array.from({ length: 16 }).map((_, i) => {
            const deg = (i * 360) / 16;
            return (
              <Polygon
                key={i}
                points="20,15 20.55,18 19.45,18"
                fill={SUN_RAY}
                transform={`rotate(${deg} 20 20)`}
              />
            );
          })}
          <Circle cx={20} cy={20} r={2.4} fill={SUN_DISC} />
        </G>
        {/* Borde sutil para definir el círculo sobre fondos claros */}
        <Circle
          cx={20}
          cy={20}
          r={19.7}
          fill="none"
          stroke="rgba(0,0,0,0.10)"
          strokeWidth={0.6}
        />
      </Svg>
    </View>
  );
}

/** Bandera US estándar — 13 stripes rojo/blanco + canton navy con
 *  estrellas distribuidas en grilla alternada (Old Glory style),
 *  no en círculo. Cromática bold: Old Glory red + true navy. */
function BetsyRossFlag({ size }: { size: number }) {
  const RED = "#BF0A30";
  const WHITE = "#FFFFFF";
  const NAVY = "#002868";
  const stripeH = 40 / 13;
  const cantonW = 40 * 0.4;
  const cantonH = stripeH * 7;
  // Grilla alternada de estrellas — 5 filas / 4-3-4-3-4 estrellas,
  // simulando el pattern de Old Glory (que en el original son 9
  // filas alternadas de 6 y 5 estrellas). Acá compactado para 40 px.
  const cols = [4, 3, 4, 3, 4];
  const rows = cols.length;
  const rowGap = cantonH / (rows + 1);
  const stars: { cx: number; cy: number }[] = [];
  cols.forEach((count, rowIdx) => {
    const colGap = cantonW / (count + 1);
    for (let i = 0; i < count; i++) {
      stars.push({
        cx: colGap * (i + 1),
        cy: rowGap * (rowIdx + 1),
      });
    }
  });
  return (
    <View
      style={[
        s.flagCircle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Defs>
          <ClipPath id="usFlagClip">
            <Circle cx={20} cy={20} r={20} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#usFlagClip)">
          <Rect x={0} y={0} width={40} height={40} fill={WHITE} />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <Rect
              key={i}
              x={0}
              y={i * stripeH}
              width={40}
              height={stripeH}
              fill={RED}
            />
          ))}
          <Rect x={0} y={0} width={cantonW} height={cantonH} fill={NAVY} />
          {/* Estrellas como puntos blancos distribuidos en grilla
              alternada — a 40 px los polígonos de 5 puntas no leen,
              los círculos sí. La distribución (4-3-4-3-4) replica
              el feel del Old Glory. */}
          {stars.map((p, i) => (
            <Circle key={i} cx={p.cx} cy={p.cy} r={0.7} fill={WHITE} />
          ))}
        </G>
        <Circle
          cx={20}
          cy={20}
          r={19.7}
          fill="none"
          stroke="rgba(0,0,0,0.10)"
          strokeWidth={0.6}
        />
      </Svg>
    </View>
  );
}

/** Bandera Crypto — campo full brand verde de Álamos con ₿ blanco
 *  grande tilteado 14° (mismo lenguaje que el logo de Bitcoin pero
 *  en la cromática de la app, no naranja). */
function BitcoinFlag({ size }: { size: number }) {
  const ALAMOS_GREEN = "#00C805";
  return (
    <View
      style={[
        s.flagCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: ALAMOS_GREEN,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fontFamily[800],
          fontSize: size * 0.62,
          color: "#FFFFFF",
          letterSpacing: -0.5,
          marginTop: -size * 0.04,
          transform: [{ rotate: "-14deg" }],
        }}
      >
        ₿
      </Text>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: size / 2,
          borderWidth: 0.6,
          borderColor: "rgba(0,0,0,0.10)",
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  /* Círculo base de los MarketFlags. Overflow hidden para que el
   * SVG se clipee al círculo (las banderas se rendean rectangulares
   * y se cortan por la wrap circular). */
  flagCircle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
