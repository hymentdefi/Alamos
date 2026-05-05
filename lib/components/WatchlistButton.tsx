import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Tap } from "./Tap";
import { useWatchlist } from "../watchlist/context";
import { useAssetColorOptional } from "../asset-color/context";
import { useTheme } from "../theme";

interface Props {
  ticker: string;
  size?: number;
}

/**
 * Botón circular de watchlist para el header del detalle de activo.
 * Estados:
 *   - NO en watchlist: ícono "+" en círculo
 *   - En watchlist:    ícono "✓" en círculo
 *
 * Color: usa el estado cromático del activo (verde/naranja según
 * performance del rango actual). Si no hay AssetColorProvider en el
 * árbol, fallback al color de texto del theme.
 */
export function WatchlistButton({ ticker, size = 36 }: Props) {
  const { c } = useTheme();
  const { isWatched, toggle } = useWatchlist();
  const chromatic = useAssetColorOptional();
  const watched = isWatched(ticker);
  const tint = chromatic ? chromatic.color : c.text;
  return (
    <Tap
      style={[s.btn, { width: size, height: size, borderColor: tint }]}
      onPress={() => toggle(ticker)}
      hitSlop={10}
      haptic="none"
    >
      <Feather
        name={watched ? "check" : "plus"}
        size={Math.round(size * 0.5)}
        color={tint}
      />
    </Tap>
  );
}

const s = StyleSheet.create({
  btn: {
    borderCurve: "continuous",
    borderRadius: 999,
    borderWidth: 1.4,
    alignItems: "center",
    justifyContent: "center",
  },
});
