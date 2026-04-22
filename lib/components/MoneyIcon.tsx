import Svg, { Rect, Text as SvgText, Circle } from "react-native-svg";

type Variant = "ars" | "usd";

interface Props {
  variant: Variant;
  size?: number;
}

/**
 * Ícono cuadrado redondeado para monedas — celeste argentino para pesos,
 * verde billete para dólares. Pensado para reemplazarse por logos reales
 * cuando conectemos el backend.
 */
export function MoneyIcon({ variant, size = 40 }: Props) {
  const r = size * 0.25;

  if (variant === "ars") {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {/* Fondo celeste patrio */}
        <Rect x="0" y="0" width="40" height="40" rx={r} ry={r} fill="#74ACDF" />
        {/* Franja blanca central (bandera AR simplificada) */}
        <Rect x="0" y="14" width="40" height="12" fill="#FFFFFF" />
        {/* Sol de mayo minimal */}
        <Circle cx="20" cy="20" r="3.4" fill="#F6B40E" />
        {/* Símbolo $ apenas visible sobre el sol */}
        <SvgText
          x="20"
          y="23.6"
          fontSize="7"
          fontWeight="bold"
          fill="#0E0F0C"
          textAnchor="middle"
        >
          $
        </SvgText>
      </Svg>
    );
  }

  // USD — verde billete con doble rayita
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect x="0" y="0" width="40" height="40" rx={r} ry={r} fill="#1A6B4A" />
      {/* Líneas diagonales decorativas sutiles */}
      <Rect x="-4" y="11" width="48" height="1" fill="rgba(255,255,255,0.12)" />
      <Rect x="-4" y="28" width="48" height="1" fill="rgba(255,255,255,0.12)" />
      <SvgText
        x="20"
        y="25"
        fontSize="15"
        fontWeight="bold"
        fill="#FFFFFF"
        textAnchor="middle"
      >
        US$
      </SvgText>
    </Svg>
  );
}
