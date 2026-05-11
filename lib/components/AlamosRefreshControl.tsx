import { useEffect, useState } from "react";
import {
  Platform,
  RefreshControl,
  type ColorValue,
  type RefreshControlProps,
} from "react-native";

/**
 * Wrapper de RefreshControl que evita el bug
 * `facebook/react-native#56343` en iOS.
 *
 * BUG (RN 0.81 + Fabric + iOS). En el initial mount del
 * `UIRefreshControl`, `tintColor` (entre otros) NO se aplica porque
 * `RCTPullToRefreshViewComponentView.mm` compara `oldConcreteProps`
 * contra sí mismo (mismo puntero) en lugar de contra `oldProps`. La
 * comparación da igualdad y el prop nunca llega al nativo. Resultado:
 * el spinner toma el tint default del sistema (`~#8E8E93` con
 * `userInterfaceStyle: "light"` forzado en `app.json`), que sobre el
 * `c.bg = #000000` del tema dark queda casi invisible.
 *
 * En updates posteriores al primer mount el path funciona normal:
 * `oldProps !== newProps` y la prop sí se propaga.
 *
 * WORKAROUND. En iOS arrancamos `tintColor={undefined}` y seteamos el
 * valor real en el siguiente tick. Eso convierte el initial mount
 * bugueado en un update donde el diff sí funciona y el `tintColor`
 * llega al nativo. Patrón citado por la comunidad en los issues
 * #48502 y #53987 para el mismo stack (RN 0.81 + Expo 54 + Fabric).
 *
 * En Android el bug no aplica (es un bug de UIKit/Fabric específico)
 * → el wrapper hace passthrough directo sin defer, evitando el flash
 * del color default por 1 frame.
 *
 * Cuando RN publique el fix upstream, este wrapper se puede eliminar
 * y volver a usar `RefreshControl` directo.
 */
export function AlamosRefreshControl(props: RefreshControlProps) {
  const target = props.tintColor;
  const [tint, setTint] = useState<ColorValue | undefined>(
    Platform.OS === "ios" ? undefined : target,
  );

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setTint(target);
      return;
    }
    /* Delay 100ms: 0 ms quedaba batcheado por React 18 + Fabric en el
     * mismo commit del initial mount, lo que reactivaba el bug. 100 ms
     * es imperceptible al usuario (el spinner no existe hasta que tira
     * del scroll) y queda holgadamente fuera del batching window. */
    const id = setTimeout(() => setTint(target), 100);
    return () => clearTimeout(id);
  }, [target]);

  return (
    <RefreshControl
      {...props}
      tintColor={tint}
      colors={tint != null ? [tint] : props.colors}
    />
  );
}
