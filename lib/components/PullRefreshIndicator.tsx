import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../theme";

/**
 * Indicador visible de pull-to-refresh.
 *
 * CONTEXTO. El `RefreshControl` nativo de iOS, cuando vive dentro de
 * un `Animated.ScrollView` de Reanimated v3 (o, en algunos casos,
 * tras cambios de tema), NO re-aplica su `tintColor` al UIKit
 * UIRefreshControl subyacente. El spinner queda transparente —
 * pasaron 4 iteraciones y los workarounds (key={mode}, rgba, offsets,
 * etc.) no resolvieron el problema en dark mode. Ver decisiones
 * previas en los comentarios "CAUSA RAÍZ" de los archivos de pantalla.
 *
 * SOLUCIÓN. Mantenemos el `RefreshControl` nativo para la mecánica
 * del gesto (pull, threshold, release, sticky-during-refresh), pero
 * superponemos este indicador visual GARANTIZADO visible — un
 * `ActivityIndicator` con color explícito, posicionado absoluto y
 * arriba del scroll, que aparece sólo mientras `refreshing=true`.
 *
 * El indicador no captura toques (`pointerEvents="none"`), así que
 * conviven sin interferir con el gesto del scroll.
 *
 * Uso típico:
 *
 *   <View style={{ flex: 1 }}>
 *     <ScrollView refreshControl={<RefreshControl ... />}>
 *       ...
 *     </ScrollView>
 *     <PullRefreshIndicator
 *       refreshing={refreshing}
 *       topOffset={insets.top + 56}
 *     />
 *   </View>
 */
interface Props {
  /** Si true, el indicador se muestra y gira. */
  refreshing: boolean;
  /** Distancia desde el TOP del contenedor padre. Pasale el offset
   *  de la safe area + alto del topBar para que el spinner caiga
   *  justo debajo del header. */
  topOffset: number;
  /** Override de color. Por default usa blanco en dark, textMuted
   *  en light — los mismos contrastes del native tintColor anterior. */
  color?: string;
  /** Estilos adicionales para el contenedor (por si necesitás
   *  ajustar zIndex / alineación en algún caso particular). */
  style?: StyleProp<ViewStyle>;
}

export function PullRefreshIndicator({
  refreshing,
  topOffset,
  color,
  style,
}: Props) {
  const { c, mode } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  /* Fade + scale-in al activar; fade-out rápido al desactivar.
   * Las dos animaciones corren juntas; useNativeDriver=true para
   * que no compitan con el JS thread durante el refetch.
   * Timings cortos (140 / 180 ms) — el spinner debe aparecer
   * RÁPIDO porque el usuario ya soltó el pull y espera feedback. */
  useEffect(() => {
    if (refreshing) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [refreshing, opacity, scale]);

  const tint = color ?? (mode === "dark" ? "#FFFFFF" : c.textMuted);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.wrap,
        { top: topOffset, opacity, transform: [{ scale }] },
        style,
      ]}
    >
      <View style={s.spinnerHolder}>
        <ActivityIndicator size="large" color={tint} />
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    /* zIndex alto — el indicador debe quedar SOBRE el scroll y
     * cualquier sticky overlay que tenga la pantalla. */
    zIndex: 50,
    /* Elevation Android — equivalente al zIndex en iOS para que el
     * View no sea ocultado por elementos que vengan después en el
     * orden del JSX. */
    elevation: 50,
  },
  spinnerHolder: {
    /* 40×40 para envolver el ActivityIndicator size="large"
     * (~37 px en iOS, 36-48 px en Android) con un toque de aire. */
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
