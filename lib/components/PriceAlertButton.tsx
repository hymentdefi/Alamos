import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Tap } from "./Tap";
import { useTheme, radius } from "../theme";
import { useAlerts } from "../alerts/context";
import { useAssetColorOptional } from "../asset-color/context";

/**
 * Botón de alerta de precio para el header de la pantalla de detalle.
 *
 * Visual (de la spec):
 *   - Sin alertas activas: campana con "+"
 *   - Con alertas activas: campana con dot indicador (sin "+")
 *
 * Color: contextual del AssetColorContext si existe, fallback c.text.
 *
 * Comportamiento: tap → abre la AlertSheet (controlado por el padre
 * vía onPress). El botón en sí no tiene sheet — la sheet vive a nivel
 * pantalla porque comparte estado con la lista de alertas activas.
 */
interface Props {
  /** ID del activo. Determina las alertas activas a mostrar. */
  ticker: string;
  size?: number;
  onPress: () => void;
}

const DEFAULT_SIZE = 28;

export const PriceAlertButton = memo(function PriceAlertButton({
  ticker,
  size = DEFAULT_SIZE,
  onPress,
}: Props) {
  const { c } = useTheme();
  const { hasActiveForAsset } = useAlerts();
  const assetColor = useAssetColorOptional();
  const hasAlerts = hasActiveForAsset(ticker);
  const stroke = assetColor ? assetColor.color : c.text;

  return (
    <Tap
      style={s.btn}
      hitSlop={12}
      haptic="selection"
      onPress={onPress}
      accessibilityLabel={
        hasAlerts ? "Ver alertas de precio" : "Crear alerta de precio"
      }
      accessibilityRole="button"
    >
      <View style={s.iconWrap}>
        <Svg width={size} height={size} viewBox="0 0 28 28">
          {/* Campana — geometría simplificada (cuerpo + base + badajo).
              Stroke uniforme, sin fill, para alinear visualmente con
              el WatchlistButton (también stroke-only). */}
          <Path
            d="M14 4.5 C18 4.5 20.5 7.5 20.5 11.5 L20.5 14.8 L22 18.5 L6 18.5 L7.5 14.8 L7.5 11.5 C7.5 7.5 10 4.5 14 4.5 Z"
            stroke={stroke}
            strokeWidth={1.7}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          {/* Badajo / lengüeta abajo. */}
          <Path
            d="M12.2 21 C12.4 22 13.1 22.5 14 22.5 C14.9 22.5 15.6 22 15.8 21"
            stroke={stroke}
            strokeWidth={1.7}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          {hasAlerts ? null : (
            // "+" en la esquina superior derecha (encima del cuerpo
            // de la campana) para indicar acción "agregar". Cuando
            // ya hay alertas, lo escondemos y mostramos un dot.
            <>
              <Circle
                cx={21}
                cy={6.5}
                r={4}
                fill={c.bg}
                stroke={stroke}
                strokeWidth={1.4}
              />
              <Path
                d="M21 4.7 L21 8.3 M19.2 6.5 L22.8 6.5"
                stroke={stroke}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </>
          )}
          {hasAlerts ? (
            // Dot indicador — relleno con el color contextual,
            // mismo lugar que el "+" para coherencia visual.
            <Circle cx={21} cy={6.5} r={3.4} fill={stroke} />
          ) : null}
        </Svg>
      </View>
    </Tap>
  );
});

const s = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export type { Props as PriceAlertButtonProps };
