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
  /** Color del stroke del reloj. Default brand.green. Permite que el
   *  icono se acomode al estado cromático contextual (ej: rojo cuando
   *  el chart del activo está en losses). El dot ámbar no cambia. */
  color?: string;
}

/**
 * Icono "mercado cerrado" — reloj con un dot de aviso en la esquina
 * sup-derecha. Pequeño (22 px default), pensado para inline al lado
 * de un título o nombre de activo. Tap → abre el bottom sheet
 * `MarketClosedSheet` con la ilustración de Alamos + candado y el
 * horario del mercado.
 *
 * El dot es el mismo color/forma que el dot del icono de
 * notificaciones del Home — rojo `#FF5C5C` con stroke `c.bg` para
 * punchear limpio sobre el botón en ambos modos. Coherencia visual
 * a través de la app: "punto rojo arriba a la derecha = algo
 * requiere atención".
 */

const ALERT_DOT = "#FF5C5C";

export function MarketClosedIcon({
  session,
  instrumentLabel,
  size = 22,
  color,
}: Props) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);

  if (session.open) return null;

  const stroke = color ?? brand.green;

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
            stroke={stroke}
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
            stroke={c.bg}
            strokeWidth={2}
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
