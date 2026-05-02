import { memo } from "react";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import type { AccountId } from "../data/accounts";

/**
 * Avatar de cuenta — squircle estilo iOS con la bandera/símbolo de la
 * moneda. Reemplaza al `AccountAvatar` original (círculo con pin
 * chiquito) por el set unificado de assets/flags/{ars,usd-ar,usd-us,
 * usdt}.svg que el usuario subió. Vienen los 4 a 64×64 con el mismo
 * clip-path squircle para mantener coherencia visual.
 *
 * Diseños:
 *   - ars      → bandera AR (celeste/blanco/celeste + sol)
 *   - usd-ar   → bandera US como base con un mini-squircle AR
 *                stamped abajo-derecha (denota "USD argentino")
 *   - usd-us   → bandera US pura
 *   - usdt     → cuadrado verde Tether con símbolo ₮
 */

// Clip-path squircle 64×64 — mismo que el SVG original.
const SQUIRCLE_64 =
  "M 16.64 0 H 47.36 Q 64 0 64 16.64 V 47.36 Q 64 64 47.36 64 H 16.64 Q 0 64 0 47.36 V 16.64 Q 0 0 16.64 0 Z";
// Squircle 30×30 — usado por el badge AR del flag usd-ar.
const SQUIRCLE_30 =
  "M 7.8 0 H 22.2 Q 30 0 30 7.8 V 22.2 Q 30 30 22.2 30 H 7.8 Q 0 30 0 22.2 V 7.8 Q 0 0 7.8 0 Z";

// Posiciones de las "estrellas" simplificadas del canton de USA —
// 4 columnas × 4 filas. Hardcodeadas a partir del SVG original.
const US_STARS: [number, number][] = [];
for (const cy of [5.7, 12.5, 19.3, 26]) {
  for (const cx of [4.5, 11.5, 18.5, 25.5]) {
    US_STARS.push([cx, cy]);
  }
}

const US_STRIPE_YS = [0, 9.84, 19.68, 29.52, 39.36, 49.2, 59.04];

function ArsBody() {
  return (
    <>
      <Rect width={64} height={21.33} fill="#74ACDF" />
      <Rect y={21.33} width={64} height={21.33} fill="#FFFFFF" />
      <Rect y={42.66} width={64} height={21.34} fill="#74ACDF" />
      <Circle cx={32} cy={32} r={4.4} fill="#F6B40E" />
    </>
  );
}

function UsBody() {
  return (
    <>
      <Rect width={64} height={64} fill="#FFFFFF" />
      {US_STRIPE_YS.map((y) => (
        <Rect key={y} y={y} width={64} height={4.92} fill="#B22234" />
      ))}
      <Rect width={29.5} height={34.4} fill="#3C3B6E" />
      {US_STARS.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={1} fill="#FFFFFF" />
      ))}
    </>
  );
}

function UsdtBody() {
  return (
    <>
      <Rect width={64} height={64} fill="#26A17B" />
      <SvgText
        x={32}
        y={44}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize={32}
        fontWeight="700"
      >
        ₮
      </SvgText>
    </>
  );
}

interface Props {
  /** Cuenta a renderizar — define qué squircle se muestra. */
  accountId: AccountId;
  size?: number;
  /** Color del backing del badge de USD-AR. Por default usa el bg
   *  cálido del light mode; podés override en dark para que matchee
   *  la surface del card. */
  badgeBackingColor?: string;
}

export const AccountFlag = memo(function AccountFlag({
  accountId,
  size = 40,
  badgeBackingColor = "#FAFAF7",
}: Props) {
  // ID único por instancia para evitar colisiones entre múltiples
  // flags renderizándose en simultáneo (RN-svg comparte ids globales
  // si no se aíslan).
  const clipId = `flag-clip-${accountId}`;
  const innerClipId = `flag-inner-${accountId}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <ClipPath id={clipId}>
          <Path d={SQUIRCLE_64} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        {accountId === "ars-ar" && <ArsBody />}
        {accountId === "usd-ar" && <UsBody />}
        {accountId === "usd-us" && <UsBody />}
        {accountId === "usdt-crypto" && <UsdtBody />}
      </G>
      {accountId === "usd-ar" ? (
        // Badge AR encima del flag US, abajo-derecha. Backing
        // rounded-square + bandera AR clipeada con squircle chiquito.
        <Svg x={32} y={32} width={32} height={32} viewBox="0 0 32 32">
          <Rect
            width={32}
            height={32}
            fill={badgeBackingColor}
            rx={9}
            ry={9}
          />
          <Svg x={1} y={1} width={30} height={30} viewBox="0 0 30 30">
            <Defs>
              <ClipPath id={innerClipId}>
                <Path d={SQUIRCLE_30} />
              </ClipPath>
            </Defs>
            <G clipPath={`url(#${innerClipId})`}>
              <Rect width={30} height={10} fill="#74ACDF" />
              <Rect y={10} width={30} height={10} fill="#FFFFFF" />
              <Rect y={20} width={30} height={10} fill="#74ACDF" />
              <Circle cx={15} cy={15} r={2.5} fill="#F6B40E" />
            </G>
          </Svg>
        </Svg>
      ) : null}
    </Svg>
  );
});
