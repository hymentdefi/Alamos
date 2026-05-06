import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { brand, useTheme } from "../theme";
import type { MarketSession } from "../market/hours";
import { MarketClosedSheet } from "./MarketClosedSheet";

interface Props {
  /** Sesión del mercado del activo o del market en foco. Si está
   *  abierta, el icono no se renderiza (devuelve null). */
  session: MarketSession;
  /** Override del label del instrumento que muestra el sheet. Si no
   *  se pasa, se usa session.instrumentLabel. */
  instrumentLabel?: string;
  /** Tamaño del icono SVG en px. Default 22. */
  size?: number;
}

/**
 * Icono "mercado cerrado" — reloj con un dot ámbar de aviso. Pequeño
 * (22 px default), pensado para inline al lado de un título o nombre
 * de activo. Tap → abre el bottom sheet `MarketClosedSheet` con la
 * ilustración de Alamos + candado y el horario del mercado.
 *
 * Geometría 1:1 con assets/iconos-acciones/exports-disclaimer/{light,dark}/
 * mercado-cerrado.svg (viewBox 26×26, stroke 2, dot ámbar 7×7 con
 * borde de contraste según modo).
 */

const ALERT_DOT = "#F59E0B";

export function MarketClosedIcon({
  session,
  instrumentLabel,
  size = 22,
}: Props) {
  const { mode } = useTheme();
  const [open, setOpen] = useState(false);

  if (session.open) return null;

  const dotBorder = mode === "dark" ? "#0E0F0C" : "#FFFFFF";

  return (
    <View>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setOpen(true);
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Mercado cerrado — ver horario"
      >
        <Svg width={size} height={size} viewBox="0 0 26 26">
          <G
            transform="translate(0 2)"
            fill="none"
            stroke={brand.green}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Circle cx={12} cy={12} r={9} />
            <Path d="M12 7v5l3 2" />
          </G>
          <Circle
            cx={22}
            cy={4}
            r={3.5}
            fill={ALERT_DOT}
            stroke={dotBorder}
            strokeWidth={1.5}
          />
        </Svg>
      </Pressable>
      <MarketClosedSheet
        visible={open}
        instrumentLabel={instrumentLabel ?? session.instrumentLabel}
        session={session}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
